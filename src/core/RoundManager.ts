import { DeckManager } from './DeckManager';
import { SubmissionPile } from './SubmissionPile';
import { HandEvaluator } from './HandEvaluator';
import { GamePhase, KongType, MetaPhase, MeldType, HandPattern, TileSuit, DeckMode } from '../types/enums';
import type { IGameState, IRoundConfig, ITile, IMeld } from '../types/interfaces';
import { globalBus } from '../utils/EventBus';

export class RoundManager {
    private state!: IGameState;
    private deckManager!: DeckManager;
    private submissionPile!: SubmissionPile;
    private evaluator: HandEvaluator;

    constructor() {
        this.evaluator = new HandEvaluator();
    }

    /** 开启一个新局 (Micro-Round) */
    public startRound(config: IRoundConfig, seed: number): void {
        const mode = config.deckMode || DeckMode.Standard;
        this.deckManager = new DeckManager(seed, mode);
        this.submissionPile = new SubmissionPile();

        this.state = {
            phase: GamePhase.Submit,
            ante: 1,
            round: 1,
            money: 0,
            deck: [],         // 占位
            discardPile: [],
            hand: [],
            submissionPile: this.submissionPile.getState(),
            scorePreview: { estimatedChips: 0, estimatedMult: 1, estimatedTotal: 0, recognizedPatterns: [], isComplete: false },
            deckSize: this.deckManager.getRemaining(),
            discardCount: 0,      // 累计用掉的
            maxDiscardCount: config.maxDiscardCount,
            cumulativeScore: 0,
            targetScore: config.targetScore,
            sparrows: [],
            talismans: [],
            roundConfig: config,
        };

        // 初始抽 8 张
        this.replenishHand();
        globalBus.emit('gameState:changed', this.state);
        globalBus.emit('round:started', { config });
    }

    /** 补齐手牌到目标上限 */
    private replenishHand(): void {
        const needed = this.state.roundConfig.initialHandSize - this.state.hand.length;
        if (needed > 0) {
            const drawn = this.deckManager.draw(needed);
            this.state.hand.push(...drawn);
            globalBus.emit('gameState:changed', this.state);
        }
    }

    /**
     * 玩家操作：提交一组牌
     * @returns 成功与否及失败原因
     */
    public submitGroup(selectedTileIds: string[], type: 'meld' | 'pair' | 'kong', kongType?: KongType): { success: boolean, reason?: string } {
        if (this.state.phase !== GamePhase.Submit && this.state.phase !== GamePhase.Discard) {
            return { success: false, reason: '当前阶段不可操作' };
        }

        const tiles: ITile[] = [];
        const indicesToRemove: number[] = [];

        // 验证牌是否在手牌中
        for (const id of selectedTileIds) {
            const idx = this.state.hand.findIndex(t => t.id === id);
            if (idx === -1) return { success: false, reason: '无效的牌ID' };
            tiles.push(this.state.hand[idx]);
            indicesToRemove.push(idx);
        }

        // 基础验证: 判断是否是合法的顺/刻/杠/雀头
        const inferredType = this.isValidMeld(tiles, type);
        if (!inferredType) {
            return { success: false, reason: '选中的牌无法组成合法牌型' };
        }

        const meld: IMeld = {
            type: inferredType,
            tiles,
            wildcardCount: tiles.filter(t => t.isWildcard).length
        };

        let success = false;
        if (type === 'kong') {
            success = this.submissionPile.submitToKong(meld, kongType || KongType.LightKong);
        } else {
            success = this.submissionPile.submitToSettlement(meld);
        }

        if (success) {
            // 从手牌移除
            indicesToRemove.sort((a, b) => b - a).forEach(idx => this.state.hand.splice(idx, 1));
            this.state.submissionPile = this.submissionPile.getState();
            this.replenishHand();
            this.state.deckSize = this.deckManager.getRemaining();

            // 每次提交后检查是否满槽
            const completed = this.checkCompletion();
            // 如果没满槽，检查是否提前卡死
            if (!completed) {
                this.checkEarlyGameOver();
            }
            return { success: true };
        } else {
            return { success: false, reason: '提交槽满或结构不允许' };
        }
    }

    /**
     * 玩家操作：换牌 (Discard)
     */
    public discardTiles(selectedTileIds: string[]): { success: boolean, reason?: string } {
        if (this.state.phase !== GamePhase.Submit && this.state.phase !== GamePhase.Discard) {
            return { success: false, reason: '当前阶段不可操作' };
        }
        if (this.state.discardCount >= this.state.maxDiscardCount) {
            return { success: false, reason: '换牌次数已耗尽' };
        }
        if (selectedTileIds.length > 5 || selectedTileIds.length === 0) {
            return { success: false, reason: '每次换牌需选择 1-5 张' };
        }

        const indicesToRemove: number[] = [];
        const discarded: ITile[] = [];

        for (const id of selectedTileIds) {
            const idx = this.state.hand.findIndex(t => t.id === id);
            if (idx === -1) return { success: false, reason: '无效的牌ID' };
            indicesToRemove.push(idx);
            discarded.push(this.state.hand[idx]);
        }

        // 丢弃并补牌
        indicesToRemove.sort((a, b) => b - a).forEach(idx => this.state.hand.splice(idx, 1));
        this.deckManager.discard(discarded);
        this.state.discardPile = [...this.deckManager.getDiscardPile()];
        this.state.discardCount++;

        this.replenishHand();
        this.state.deckSize = this.deckManager.getRemaining();
        globalBus.emit('gameState:changed', this.state);

        this.checkEarlyGameOver();

        return { success: true };
    }

    /**
     * 检查是否满槽触发胡牌
     */
    private checkCompletion(): boolean {
        if (this.submissionPile.isComplete()) {
            // 算分
            const result = this.evaluator.evaluateSubmission(this.state.submissionPile);

            // 加入二次拦截：如果没有匹配到合法番型，或者强制拦截 partial
            if (result && result.pattern && result.pattern !== HandPattern.Partial) {
                this.state.cumulativeScore += result.totalScore;
                globalBus.emit('round:completedHand', { result, currentScore: this.state.cumulativeScore });

                // 清空堆，进入下一手
                this.submissionPile.clear();
                this.state.submissionPile = this.submissionPile.getState();

                if (this.state.cumulativeScore >= this.state.targetScore) {
                    this.state.phase = MetaPhase.Shop as any;
                    globalBus.emit('round:victory', { score: this.state.cumulativeScore });
                } else {
                    this.state.phase = MetaPhase.GameOver as any;
                    globalBus.emit('round:defeat', { score: this.state.cumulativeScore, reason: `最终得分 ${this.state.cumulativeScore} 未达到目标 ${this.state.targetScore}` });
                }
            } else {
                // 满槽了但不是胡牌牌型，判负
                this.state.phase = MetaPhase.GameOver as any;
                globalBus.emit('round:defeat', { score: this.state.cumulativeScore, reason: '提交的组合无法构成胡牌' });
            }
            return true;
        } else {
            // 这里也可以做实时预览
            globalBus.emit('gameState:changed', this.state);
            return false;
        }
    }

    private checkEarlyGameOver() {
        if (this.state.phase === GamePhase.Submit || this.state.phase === GamePhase.Discard) {
            if (this.state.discardCount >= this.state.maxDiscardCount) {
                if (!this.canMakeAnyValidSubmission()) {
                    this.state.phase = MetaPhase.GameOver as any;
                    globalBus.emit('round:defeat', { score: this.state.cumulativeScore, reason: '无路可走：换牌耗尽且手牌无法组成任何面子/对子/杠' });
                }
            }
        }
    }

    private isValidMeld(tiles: ITile[], type: 'meld' | 'pair' | 'kong'): MeldType | null {
        if (type === 'pair') {
            if (tiles.length !== 2) return null;
            if (tiles[0].isWildcard || tiles[1].isWildcard) return MeldType.Pair;
            if (tiles[0].suit === tiles[1].suit && tiles[0].rank === tiles[1].rank) return MeldType.Pair;
            return null;
        }
        if (type === 'kong') {
            if (tiles.length < 4) return null;
            const nonWc = tiles.filter(t => !t.isWildcard);
            if (nonWc.length === 0) return MeldType.Gangzi;
            const first = nonWc[0];
            if (nonWc.every(t => t.suit === first.suit && t.rank === first.rank)) return MeldType.Gangzi;
            return null;
        }
        if (type === 'meld') {
            if (tiles.length !== 3) return null;
            const nonWc = tiles.filter(t => !t.isWildcard);
            if (nonWc.length === 0) return MeldType.Kezi;
            const first = nonWc[0];

            // Check Kezi
            if (nonWc.every(t => t.suit === first.suit && t.rank === first.rank)) return MeldType.Kezi;

            // Check Shunzi
            if (nonWc.some(t => t.suit === TileSuit.Wind || t.suit === TileSuit.Dragon)) return null;
            if (!nonWc.every(t => t.suit === first.suit)) return null;

            const ranks = nonWc.map(t => t.rank).sort((a, b) => a - b);
            const uniqueRanks = new Set(ranks);
            if (uniqueRanks.size !== ranks.length) return null;

            if (ranks.length === 1) return MeldType.Shunzi;
            if (ranks.length === 2 && (ranks[1] - ranks[0]) <= 2) return MeldType.Shunzi;
            if (ranks.length === 3 && ranks[2] - ranks[1] === 1 && ranks[1] - ranks[0] === 1) return MeldType.Shunzi;

            return null;
        }
        return null;
    }

    private canMakeAnyValidSubmission(): boolean {
        const hand = this.state.hand;
        const structure = this.submissionPile.getState();

        if (!structure.pairSlot.filled && this.hasValidGroup(hand, 2, 'pair')) return true;

        const needsMeld = structure.settlementMeldSlots.some(s => !s.filled);
        if (needsMeld && this.hasValidGroup(hand, 3, 'meld')) return true;

        const needsKong = structure.kongSlots.some(s => !s.filled);
        if (needsKong && this.hasValidGroup(hand, 4, 'kong')) return true;

        return false;
    }

    private hasValidGroup(hand: ITile[], size: number, type: 'pair' | 'meld' | 'kong'): boolean {
        if (hand.length < size) return false;

        // 简单组合枚举
        const getCombinations = (array: ITile[], k: number) => {
            const result: ITile[][] = [];
            const backtrack = (start: number, combo: ITile[]) => {
                if (combo.length === k) {
                    result.push([...combo]);
                    return;
                }
                for (let i = start; i < array.length; i++) {
                    combo.push(array[i]);
                    backtrack(i + 1, combo);
                    combo.pop();
                }
            };
            backtrack(0, []);
            return result;
        };

        const combinations = getCombinations(hand, size);
        for (const combo of combinations) {
            if (this.isValidMeld(combo, type)) return true;
        }
        return false;
    }

    public getGameState(): IGameState {
        return this.state;
    }
}
