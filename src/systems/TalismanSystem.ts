import { TalismanEffectType, TileAttribute } from '../types/enums';
import type { ITalisman, ITile } from '../types/interfaces';
import { globalBus } from '../utils/EventBus';

export class TalismanSystem {
    private talismans: ITalisman[] = [];
    private maxCapacity: number;

    constructor(maxCapacity = 3) {
        this.maxCapacity = maxCapacity;
    }

    /** 获得一张符咒 */
    public addTalisman(talisman: ITalisman): boolean {
        if (this.talismans.length >= this.maxCapacity) {
            return false;
        }
        this.talismans.push(talisman);
        globalBus.emit('talisman:added', { talisman, currentTotal: this.talismans.length });
        return true;
    }

    /** 对目标生效符咒 (如选中的某张牌) */
    public useTalisman(talismanId: string, targetTile?: ITile): boolean {
        const index = this.talismans.findIndex(t => t.id === talismanId);
        if (index === -1) return false;

        const talisman = this.talismans[index];
        let success = false;

        switch (talisman.effectType) {
            case TalismanEffectType.ChangeAttribute:
                if (targetTile) {
                    // 点金符或琉璃符
                    targetTile.attribute = talisman.value === 1 ? TileAttribute.Gold : TileAttribute.Glass;
                    // 标记这张牌是由符咒强化的 (影响明暗杠判定)
                    targetTile.isGeneratedByTalisman = true;
                    success = true;
                }
                break;

            case TalismanEffectType.TempMult:
                // 触发一个全局事件，GameStateManager 或者评分系统可以监听到临时加倍率
                globalBus.emit('talisman:effect:tempMult', { multBonus: talisman.value });
                success = true;
                break;

            case TalismanEffectType.Draw:
                globalBus.emit('talisman:effect:draw', { count: talisman.value });
                success = true;
                break;
        }

        if (success) {
            talisman.uses--;
            globalBus.emit('talisman:used', { talisman, target: targetTile });

            // 次数耗尽则移除
            if (talisman.uses <= 0) {
                this.talismans.splice(index, 1);
                globalBus.emit('talisman:depleted', { talisman });
            }
            return true;
        }

        return false;
    }

    public getTalismans(): readonly ITalisman[] {
        return this.talismans;
    }
}
