import { RoundManager } from './src/core/RoundManager.js';
import { KongType, MetaPhase, MeldType, TileSuit, TileRank } from './src/types/enums.js';
import type { ITile } from './src/types/interfaces.js';
import { globalBus } from './src/utils/EventBus.js';

function getTileKey(t: ITile) {
    return `${t.suit}_${t.rank}_${t.isWildcard ? 'W' : 'N'}`;
}

/** 简单全自动 Bot：在随机抽到的手牌中寻找面子/雀头出牌 */
class SimpleBot {
    private rm: RoundManager;

    constructor(rm: RoundManager) {
        this.rm = rm;
    }

    public playRound() {
        let loopCount = 0;
        let state = this.rm.getGameState();

        while (state.phase !== MetaPhase.Shop && state.phase !== MetaPhase.GameOver && loopCount < 50) {
            loopCount++;
            state = this.rm.getGameState();
            const hand = state.hand;
            console.log(`\n[回合 ${loopCount}] 手牌 (${hand.length}张):`, hand.map(getTileKey).join(', '));
            console.log(`  剩余提交次数: ${state.maxSubmitCount - state.submitCount}, 剩余换牌次数: ${state.maxDiscardCount - state.discardCount}`);
            console.log(`  结算槽: ${state.submissionPile.settlementMeldSlots.filter(s => s.filled).length}/${state.submissionPile.settlementMeldSlots.length}, 雀头槽: ${state.submissionPile.pairSlot.filled ? 1 : 0}/1`);

            // 寻找操作
            let acted = false;

            // 1. 尝试找雀头 (如果还没交)
            if (!state.submissionPile.pairSlot.filled) {
                const pair = this.findPair(hand);
                if (pair) {
                    console.log('🤖 Bot 提交雀头:', pair.map(getTileKey).join(', '));
                    const res = this.rm.submitGroup(pair.map(t => t.id), 'pair');
                    if (res.success) acted = true;
                    if (acted) continue;
                }
            }

            // 2. 尝试找杠牌 (仅当且有剩余提交流程及空闲杠槽)
            if (!acted && state.submissionPile.kongSlots.some(s => !s.filled)) {
                const kong = this.findKong(hand);
                if (kong) {
                    console.log('🤖 Bot 提交暗杠:', kong.map(getTileKey).join(', '));
                    const res = this.rm.submitGroup(kong.map(t => t.id), 'kong', KongType.DarkKong);
                    if (res.success) acted = true;
                    if (acted) continue;
                }
            }

            // 3. 尝试找刻子/顺子
            if (!acted && state.submissionPile.settlementMeldSlots.some(s => !s.filled)) {
                const meld = this.findKezi(hand) || this.findShunzi(hand);
                if (meld) {
                    console.log('🤖 Bot 提交面子:', meld.map(getTileKey).join(', '));
                    const res = this.rm.submitGroup(meld.map(t => t.id), 'meld');
                    if (res.success) acted = true;
                    if (acted) continue;
                }
            }

            // 4. 如果找不到能交的，只能换牌
            if (!acted) {
                if (state.discardCount < state.maxDiscardCount) {
                    // 随便把没组上的前 3 张扔掉
                    const drop = hand.slice(0, 3);
                    console.log('🤖 Bot 决定换牌 (丢弃):', drop.map(getTileKey).join(', '));
                    const res = this.rm.discardTiles(drop.map(t => t.id));
                    if (res.success) acted = true;
                } else {
                    console.log('🤖 Bot 卡手了，没有换牌次数，只能被迫认输 (实际游戏可能会允许强行交非法组退回，直到次数耗尽)');
                    // 为了防止死循环，我们随便拿一张模拟错误的动作耗掉提交次数
                    console.log('🤖 (模拟错误提交以消耗次数...)');
                    this.rm.submitGroup([hand[0].id, hand[1].id], 'meld');
                }
            }
        }

        console.log(`\n=== 游戏结束 ===`);
        state = this.rm.getGameState();
        console.log(`最终状态: ${state.phase}, 累计得分: ${state.cumulativeScore} / ${state.targetScore}`);
    }

    private findPair(hand: ITile[]): ITile[] | null {
        for (let i = 0; i < hand.length - 1; i++) {
            for (let j = i + 1; j < hand.length; j++) {
                if (hand[i].suit === hand[j].suit && hand[i].rank === hand[j].rank && !hand[i].isWildcard && !hand[j].isWildcard) {
                    return [hand[i], hand[j]];
                }
            }
        }
        return null;
    }

    private findKong(hand: ITile[]): ITile[] | null {
        // 先按 rank, suit 归类
        const counts = new Map<string, ITile[]>();
        for (const t of hand) {
            const k = `${t.suit}_${t.rank}`;
            if (!counts.has(k)) counts.set(k, []);
            counts.get(k)!.push(t);
        }
        for (const [k, arr] of counts.entries()) {
            if (arr.length >= 4) return arr.slice(0, 4);
        }
        return null;
    }

    private findKezi(hand: ITile[]): ITile[] | null {
        const counts = new Map<string, ITile[]>();
        for (const t of hand) {
            const k = `${t.suit}_${t.rank}`;
            if (!counts.has(k)) counts.set(k, []);
            counts.get(k)!.push(t);
        }
        for (const [k, arr] of counts.entries()) {
            if (arr.length >= 3) return arr.slice(0, 3);
        }
        return null;
    }

    private findShunzi(hand: ITile[]): ITile[] | null {
        const numbers = hand.filter(t => t.suit !== TileSuit.Wind && t.suit !== TileSuit.Dragon && !t.isWildcard);
        // 去重并且排序
        const mapBySuit = new Map<TileSuit, ITile[]>();
        for (const t of numbers) {
            if (!mapBySuit.has(t.suit)) mapBySuit.set(t.suit, []);
            mapBySuit.get(t.suit)!.push(t);
        }

        for (const [suit, arr] of mapBySuit.entries()) {
            // 对 rank 排序
            arr.sort((a, b) => a.rank - b.rank);
            // 去重
            const unique: ITile[] = [];
            for (const x of arr) {
                if (!unique.some(u => u.rank === x.rank)) unique.push(x);
            }
            if (unique.length >= 3) {
                for (let i = 0; i <= unique.length - 3; i++) {
                    if (unique[i + 1].rank === unique[i].rank + 1 && unique[i + 2].rank === unique[i].rank + 2) {
                        return [unique[i], unique[i + 1], unique[i + 2]];
                    }
                }
            }
        }
        return null;
    }
}

function startNormalBotTest() {
    console.log('>>> 初始化 RoundManager (正常状态) <<<');
    const rm = new RoundManager();

    globalBus.on('round:completedHand', (data: any) => console.log(`🎯 [事件] round:completedHand (完成一手, 番种=${data.result.pattern}, 获得积分=${data.result.totalScore})`));
    globalBus.on('round:victory', (data: any) => console.log(`✅ [事件] round:victory (过关! 总分=${data.score})`));
    globalBus.on('round:defeat', (data: any) => console.log(`❌ [事件] round:defeat (失败! 总分=${data.score})`));

    // 开始对局：因为是瞎玩Bot，目标分设低一点，让它随便胡一把就能赢
    rm.startRound({
        targetScore: 100,
        maxSubmitCount: 15,
        maxDiscardCount: 20, // 给它很多次换牌机会，确保证明正常能跑通
        maxDiscardTiles: 3,
        initialHandSize: 8
    }, Math.random() * 10000); // 随机种子

    const bot = new SimpleBot(rm);
    bot.playRound();
}

startNormalBotTest();
