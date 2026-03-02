import { SparrowEffectType } from '../types/enums';
import type { ISparrow, IScoreBreakdown } from '../types/interfaces';
import { globalBus } from '../utils/EventBus';

export class SparrowSystem {
    private activeSparrows: ISparrow[] = [];
    private maxSparrows: number;

    constructor(maxCapacity = 5) {
        this.maxSparrows = maxCapacity;

        // 监听算分事件，自动叠加被动增益
        globalBus.on<{ result: any }>('round:completedHand', () => {
            // TODO: GDD v2 下的分数 breakdown 正在重构，这里暂时不抛错以便主流程跑通
            /*
            if (payload && payload.breakdown) {
                this.applyAll(payload.breakdown);
            }
            */
        });

        // 监听回合胜利发钱事件（经济类雀鸟）
        globalBus.on<{ score: number, reward?: number }>('round:victory', (payload) => {
            if (payload) {
                // 如果后续有实际派发的金币可以累加
                payload.reward = payload.reward || 0;
                this.applyEconomy(payload as any);
            }
        });
    }

    /**
     * 添加一只雀鸟 (被动技能)
     * @returns 是否添加成功 (超过上限则失败)
     */
    public addSparrow(sparrow: ISparrow): boolean {
        if (this.activeSparrows.length >= this.maxSparrows) {
            return false;
        }
        this.activeSparrows.push(sparrow);
        globalBus.emit('sparrow:added', { sparrow, currentTotal: this.activeSparrows.length });
        return true;
    }

    /** 移除指定的雀鸟 */
    public removeSparrow(sparrowId: string): boolean {
        const index = this.activeSparrows.findIndex(s => s.id === sparrowId);
        if (index !== -1) {
            const removed = this.activeSparrows.splice(index, 1)[0];
            globalBus.emit('sparrow:removed', { sparrow: removed, currentTotal: this.activeSparrows.length });
            return true;
        }
        return false;
    }

    public getActiveSparrows(): readonly ISparrow[] {
        return this.activeSparrows;
    }

    /**
     * 遍历所有生效的雀鸟，根据其效果类型修改计分结构。
     * 计分公式: (BaseChips + 雀鸟加成) * (BaseMult + 雀鸟加成) * 雀鸟乘算
     */
    public applyAll(breakdown: IScoreBreakdown): void {
        let multMultiplier = 1;

        for (const sparrow of this.activeSparrows) {
            let triggered = false;

            switch (sparrow.effectType) {
                case SparrowEffectType.AddChips:
                    breakdown.chipBonuses.push(sparrow.value);
                    breakdown.finalChips += sparrow.value;
                    triggered = true;
                    break;

                case SparrowEffectType.AddMult:
                    breakdown.multBonuses.push(sparrow.value);
                    breakdown.finalMult += sparrow.value;
                    triggered = true;
                    break;

                case SparrowEffectType.MultMult:
                    multMultiplier *= sparrow.value;
                    triggered = true;
                    break;

                // 经济类在算分时不触发
                case SparrowEffectType.Economy:
                    break;
            }

            if (triggered) {
                globalBus.emit('sparrow:triggered', { sparrow });
            }
        }

        // 应用乘算倍率
        if (multMultiplier !== 1) {
            breakdown.finalMult *= multMultiplier;
        }

        // 重新计算总分
        breakdown.totalScore = breakdown.finalChips * breakdown.finalMult;
    }

    /** 处理过关时的经济类雀鸟加成 */
    private applyEconomy(payload: { reward: number }): void {
        let extraMoney = 0;
        for (const sparrow of this.activeSparrows) {
            if (sparrow.effectType === SparrowEffectType.Economy) {
                extraMoney += sparrow.value;
                globalBus.emit('sparrow:triggered', { sparrow });
            }
        }

        if (extraMoney > 0) {
            // 通过事件通知 GameStateManager 发放额外金币
            payload.reward += extraMoney;
        }
    }
}
