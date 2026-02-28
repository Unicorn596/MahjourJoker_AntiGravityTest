import { GamePhase } from '../types/enums';
import type { IGameState, ITile, ISparrow, ITalisman, IScoreBreakdown } from '../types/interfaces';
import { globalBus } from '../utils/EventBus';
import { DeckManager } from './DeckManager';
import { HandEvaluator } from './HandEvaluator';

export class GameStateManager {
    private state: IGameState;
    private deckManager: DeckManager;
    private evaluator: HandEvaluator;

    /** 基础目标分，每回合递增 */
    private baseTargetScore = 1500;
    /** 目标分数增长系数 */
    private targetScoreMultiplier = 1.3;

    constructor(seed: number = Date.now()) {
        this.deckManager = new DeckManager(seed);
        this.evaluator = new HandEvaluator();

        this.state = {
            phase: GamePhase.Draw,
            ante: 1,
            round: 1,
            money: 0,
            deck: this.deckManager.getDeck(),
            discardPile: this.deckManager.getDiscardPile() as ITile[],
            hand: [],
            sparrows: [],
            talismans: [],
            cumulativeScore: 0,
            targetScore: this.baseTargetScore,
            submissionPile: {
                settlementMeldSlots: [],
                pairSlot: { area: 0 as any, acceptType: 'pair', meld: null, filled: false },
                kongSlots: [],
                kongCount: 0,
                isSevenPairsMode: false,
                sevenPairSlots: []
            },
            submitCount: 0,
            maxSubmitCount: 3,
            discardCount: 0,
            maxDiscardCount: 3
        } as unknown as IGameState & { discardPile: readonly ITile[], score: number };

        (this.state as any).score = 0;
    }

    /** 获取当前状态副本 (避免外部直接修改) */
    public getState(): IGameState & { discardPile: readonly ITile[] } {
        return {
            ...this.state,
            hand: [...this.state.hand],
            sparrows: [...this.state.sparrows],
            talismans: [...this.state.talismans],
            deck: [...this.deckManager.getDeck()],
            discardPile: [...this.deckManager.getDiscardPile()],
        };
    }

    // ─── 阶段流转控制 ──────────────────────────────────────────

    /** 新回合开始 (发首发手牌 14 张) */
    public startRound(): void {
        this.state.phase = GamePhase.Draw;
        (this.state as any).score = 0; // 重置本局得分
        // 游戏核心：抽出初始 14 张牌作为起手
        this.state.hand = this.deckManager.draw(14);

        globalBus.emit('game:roundStarted', {
            round: this.state.round,
            targetScore: this.state.targetScore
        });

        this.advancePhase(GamePhase.Select);
    }

    /** 提交手牌以算分 (只验证是否为合法牌型，实际打哪几张交由 UI 传参) */
    public submitHand(selectedTileIds: string[]): boolean {
        if (this.state.phase !== GamePhase.Select) return false;

        // 从手牌中找到对应的牌对象
        const selectedTiles = this.state.hand.filter(t => selectedTileIds.includes(t.id));
        if (selectedTiles.length === 0) return false;

        const result = this.evaluator.evaluate(selectedTiles);
        if (!result) {
            // 不合法牌型，提示玩家
            globalBus.emit('game:invalidHand');
            return false;
        }

        // 切换到算分阶段
        this.advancePhase(GamePhase.Score);

        // 构建详细的计分明细 (准备好交由 Sparrow/Talisman 系统进一步加成)
        const scoreBreakdown: IScoreBreakdown = {
            baseChips: result.baseChips,
            chipBonuses: [],
            baseMult: result.baseMult,
            multBonuses: [],
            wildcardPenalty: 0,
            kongMultipliers: [],
            finalChips: result.baseChips,
            finalMult: result.baseMult,
            totalScore: result.totalScore
        };

        // 触发算分事件，系统层 (SparrowSystem 等) 可以监听后修改 breakdown
        globalBus.emit('game:scoring', {
            result,
            breakdown: scoreBreakdown
        });

        // 最终结算
        (this.state as any).score += scoreBreakdown.totalScore;
        globalBus.emit('game:scored', {
            score: (this.state as any).score,
            breakdown: scoreBreakdown
        });

        // 将选中的牌放入弃牌堆，保留未选中的牌 (残局玩法?)
        // 麻将肉鸽通常是提交 14 张，打完就全弃，重新发 14 张。
        // 为了支持连续打出多手牌，我们把刚才打掉的牌移除，把剩下的牌和新抽的牌补齐。
        this.processDiscardAndDraw(selectedTileIds);

        return true;
    }

    /** 手动弃牌 (使用弃牌次数或直接弃一张) */
    public discardTiles(selectedTileIds: string[]): boolean {
        if (this.state.phase !== GamePhase.Select) return false;

        const discarded = this.state.hand.filter(t => selectedTileIds.includes(t.id));
        if (discarded.length === 0) return false;

        this.processDiscardAndDraw(selectedTileIds);
        globalBus.emit('game:tilesDiscarded', { count: discarded.length });

        return true;
    }

    /** 弃牌并自动补牌到 14 张 */
    private processDiscardAndDraw(tileIdsToRemove: string[]): void {
        // 1. 移出打掉/弃掉的牌
        const removedTiles = this.state.hand.filter(t => tileIdsToRemove.includes(t.id));
        this.state.hand = this.state.hand.filter(t => !tileIdsToRemove.includes(t.id));

        // 2. 放入弃牌堆
        this.deckManager.discard(removedTiles);

        // 3. 补齐手牌到最低 14 张 (考虑可能有强力 buff 增加了手牌上限也可以动态调整)
        const targetHandSize = 14;
        const missingCount = targetHandSize - this.state.hand.length;

        if (missingCount > 0) {
            const newTiles = this.deckManager.draw(missingCount);
            this.state.hand.push(...newTiles);
        }

        // 4. 重回选择阶段
        this.advancePhase(GamePhase.Select);
    }

    public endRound(): void {
        const score = (this.state as any).score || 0;
        if (score >= this.state.targetScore) {
            // 过关，发放金币奖励
            const baseReward = 5;
            const extraReward = Math.floor((score - this.state.targetScore) / 1000); // 溢出分转金币
            const totalReward = baseReward + extraReward;

            this.addMoney(totalReward);
            globalBus.emit('game:roundWon', { reward: totalReward });

            // 进入商店或下一轮
            this.advancePhase(GamePhase.Shop);
        } else {
            // 失败
            this.advancePhase(GamePhase.Event);
            globalBus.emit('game:gameOver');
        }
    }

    /** 离开商店，进入下一回合 */
    public nextRound(): void {
        if (this.state.phase !== GamePhase.Shop) return;

        this.state.round++;
        this.state.targetScore = Math.floor(this.state.targetScore * this.targetScoreMultiplier);

        // 重新洗整副牌
        (this.deckManager as any).reset?.() || this.deckManager.shuffle();

        this.startRound();
    }

    // ─── 经济与系统接口 ──────────────────────────────────────────

    public addMoney(amount: number): void {
        this.state.money += amount;
        globalBus.emit('game:moneyChanged', { current: this.state.money, delta: amount });
    }

    public spendMoney(amount: number): boolean {
        if (this.state.money >= amount) {
            this.state.money -= amount;
            globalBus.emit('game:moneyChanged', { current: this.state.money, delta: -amount });
            return true;
        }
        return false;
    }

    private advancePhase(nextPhase: GamePhase): void {
        this.state.phase = nextPhase;
        globalBus.emit('game:phaseChanged', { phase: nextPhase });
    }
}
