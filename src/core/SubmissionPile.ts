import { SlotArea, KongType } from '../types/enums';
import type { IMeld, ISubmissionPileState } from '../types/interfaces';
import { globalBus } from '../utils/EventBus';

export class SubmissionPile {
    private state: ISubmissionPileState;

    constructor() {
        this.state = this.getEmptyState();
    }

    private getEmptyState(): ISubmissionPileState {
        return {
            settlementMeldSlots: [
                { area: SlotArea.Settlement, acceptType: 'meld', meld: null, filled: false },
                { area: SlotArea.Settlement, acceptType: 'meld', meld: null, filled: false },
                { area: SlotArea.Settlement, acceptType: 'meld', meld: null, filled: false },
                { area: SlotArea.Settlement, acceptType: 'meld', meld: null, filled: false },
            ],
            pairSlot: { area: SlotArea.Settlement, acceptType: 'pair', meld: null, filled: false },
            kongSlots: [
                { meld: null, kongType: null, filled: false },
                { meld: null, kongType: null, filled: false },
                { meld: null, kongType: null, filled: false },
                { meld: null, kongType: null, filled: false },
            ],
            kongCount: 0,
            isSevenPairsMode: false,
            sevenPairSlots: Array.from({ length: 7 }, () => ({
                area: SlotArea.Settlement, acceptType: 'pair', meld: null, filled: false,
            })),
        };
    }

    /** 清空提交堆 */
    public clear(): void {
        this.state = this.getEmptyState();
        globalBus.emit('submissionPile:cleared');
    }

    /**
     * 将一个面子/对子提交到结算槽
     * @returns 成功返回 true，槽位已满返回 false
     */
    public submitToSettlement(meld: IMeld): boolean {
        if (this.state.isSevenPairsMode) {
            return this.submitToSevenPairs(meld);
        }

        if (meld.type === 'pair') {
            if (!this.state.pairSlot.filled) {
                this.state.pairSlot.meld = meld;
                this.state.pairSlot.filled = true;
                globalBus.emit('submissionPile:updated', this.state);
                return true;
            }
            // 如果已有一个对子，且面子区和杠区为空，强制转换到七对子模式
            const hasMelds = this.state.settlementMeldSlots.some(s => s.filled);
            const hasKongs = this.state.kongSlots.some(s => s.filled);
            if (!hasMelds && !hasKongs) {
                const firstPair = this.state.pairSlot.meld!;
                this.enableSevenPairsMode();
                this.state.sevenPairSlots[0].meld = firstPair;
                this.state.sevenPairSlots[0].filled = true;
                return this.submitToSevenPairs(meld);
            }
            return false;
        }

        // 面子 (Shunzi / Kezi)
        for (const slot of this.state.settlementMeldSlots) {
            if (!slot.filled) {
                slot.meld = meld;
                slot.filled = true;
                globalBus.emit('submissionPile:updated', this.state);
                return true;
            }
        }
        return false;
    }

    /** 提交到七对子槽位 (特殊模式) */
    private submitToSevenPairs(meld: IMeld): boolean {
        if (meld.type !== 'pair') return false;
        for (const slot of this.state.sevenPairSlots) {
            if (!slot.filled) {
                slot.meld = meld;
                slot.filled = true;
                globalBus.emit('submissionPile:updated', this.state);
                return true;
            }
        }
        return false;
    }

    /**
     * 将一个杠提交到杠槽，自动减少结算槽容量
     */
    public submitToKong(meld: IMeld, kongType: KongType): boolean {
        if (this.state.isSevenPairsMode) return false; // 七对子不能杠

        for (const slot of this.state.kongSlots) {
            if (!slot.filled) {
                slot.meld = meld;
                slot.kongType = kongType;
                slot.filled = true;

                // 核心规则：杠减少结算槽面子数
                this.state.kongCount++;
                if (this.state.settlementMeldSlots.length > 0) {
                    // 移除最后一个未填充或已填充的面子位
                    // (如果玩家强行在面子已满4个时才杠，这里会覆盖掉已提交的面子，实际在UI层需禁止此操作)
                    this.state.settlementMeldSlots.pop();
                }

                globalBus.emit('submissionPile:updated', this.state);
                return true;
            }
        }
        return false;
    }

    /**
     * 检查当前提交堆是否已经满足结算条件
     */
    public isComplete(): boolean {
        if (this.state.isSevenPairsMode) {
            return this.state.sevenPairSlots.every(s => s.filled);
        }

        const meldsFull = this.state.settlementMeldSlots.every(s => s.filled);
        const pairFull = this.state.pairSlot.filled;
        return meldsFull && pairFull;
    }

    /** 开启七对子特殊模式 (清空当前结构) */
    public enableSevenPairsMode(): void {
        this.clear();
        this.state.isSevenPairsMode = true;
        globalBus.emit('submissionPile:updated', this.state);
    }

    public getState(): ISubmissionPileState {
        return this.state;
    }
}
