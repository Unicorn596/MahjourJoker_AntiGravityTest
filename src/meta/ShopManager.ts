/**
 *  《雀神牌》杂货铺管理器
 *
 *  职责:
 *   - 生成杂货铺商品列表 (雀鸟 / 符咒 / 卡包)
 *   - 处理购买逻辑 (含资金检查、栏位上限)
 *   - 开包三选一
 *   - 刷新商品
 *
 *  纯逻辑层 —— 不引用任何 Phaser 代码
 */

import { PackType, TalismanEffectType } from '../types/enums';
import type { ISparrow, ITalisman, IShopItem, IShopState, IRunState, IPlayerProfile } from '../types/interfaces';
import { SparrowRegistry, createDefaultSparrows } from './SparrowRegistry';
import { RNG } from '../utils/RNG';

/** 基础刷新费用 */
const BASE_REFRESH_COST = 5;
/** 每次刷新费用增量 */
const REFRESH_COST_INCREMENT = 2;
/** 杂货铺中商品数量 */
const SHOP_ITEM_COUNT = 5;
/** 雀鸟栏默认上限 */
const DEFAULT_MAX_SPARROWS = 5;

let _shopUid = 0;

export class ShopManager {
    private registry: SparrowRegistry;

    constructor(registry: SparrowRegistry) {
        this.registry = registry;
    }

    /** 计算天赋折扣率 (0-1, 例如 0.9 = 9折) */
    private getDiscountRate(profile: IPlayerProfile): number {
        const discountTalent = profile.talents.find(t => t.type === 'shopDiscount');
        if (!discountTalent) return 1;
        return 1 - (discountTalent.level * discountTalent.effectPerLevel) / 100;
    }

    /** 计算雀鸟栏上限 (含天赋加成) */
    getMaxSparrows(profile: IPlayerProfile): number {
        const slotTalent = profile.talents.find(t => t.type === 'maxSparrowSlots');
        const bonus = slotTalent ? slotTalent.level * slotTalent.effectPerLevel : 0;
        return DEFAULT_MAX_SPARROWS + bonus;
    }

    /** 生成杂货铺商品列表 */
    generateShopItems(rng: RNG, profile: IPlayerProfile, ante: number): IShopState {
        const pool = this.registry.getAvailablePool(profile.unlockedRarity);
        const discountRate = this.getDiscountRate(profile);
        const items: IShopItem[] = [];

        // 生成 SHOP_ITEM_COUNT 个商品，混合雀鸟、符咒、卡包
        for (let i = 0; i < SHOP_ITEM_COUNT; i++) {
            const roll = rng.next();

            if (roll < 0.5 && pool.length > 0) {
                // 50% 概率: 雀鸟
                const sparrows = this.registry.getRandomSparrows(pool, 1, rng);
                if (sparrows.length > 0) {
                    const sparrow = sparrows[0];
                    items.push({
                        id: `shop_${++_shopUid}`,
                        type: 'sparrow',
                        item: { ...sparrow },
                        cost: Math.max(1, Math.round(sparrow.cost * discountRate * (1 + ante * 0.1))),
                        sold: false,
                    });
                    continue;
                }
            }

            if (roll < 0.8) {
                // 30% 概率: 卡包
                const packType = rng.next() < 0.5 ? PackType.SparrowPack : PackType.TalismanPack;
                const packCost = packType === PackType.SparrowPack ? 4 : 3;
                items.push({
                    id: `shop_${++_shopUid}`,
                    type: 'pack',
                    item: null,
                    packType,
                    cost: Math.max(1, Math.round(packCost * discountRate * (1 + ante * 0.1))),
                    sold: false,
                });
            } else {
                // 20% 概率: 符咒
                const talisman = this.generateRandomTalisman(rng, ante);
                items.push({
                    id: `shop_${++_shopUid}`,
                    type: 'talisman',
                    item: talisman,
                    cost: Math.max(1, Math.round(3 * discountRate)),
                    sold: false,
                });
            }
        }

        return {
            items,
            refreshCost: BASE_REFRESH_COST,
            refreshCount: 0,
        };
    }

    /** 购买雀鸟 */
    buySparrow(shopState: IShopState, itemId: string, runState: IRunState, profile: IPlayerProfile): { success: boolean; reason?: string } {
        const shopItem = shopState.items.find(i => i.id === itemId);
        if (!shopItem) return { success: false, reason: '商品不存在' };
        if (shopItem.sold) return { success: false, reason: '商品已售出' };
        if (shopItem.type !== 'sparrow') return { success: false, reason: '商品类型不匹配' };
        if (runState.money < shopItem.cost) return { success: false, reason: '资金不足' };

        const maxSlots = this.getMaxSparrows(profile);
        if (runState.sparrows.length >= maxSlots) return { success: false, reason: `雀鸟栏已满 (上限 ${maxSlots})` };

        // 扣费 & 添加
        runState.money -= shopItem.cost;
        runState.sparrows.push(shopItem.item as ISparrow);
        shopItem.sold = true;

        return { success: true };
    }

    /** 购买卡包，返回 3 个候选供三选一 */
    buyPack(
        shopState: IShopState,
        itemId: string,
        runState: IRunState,
        rng: RNG,
        profile: IPlayerProfile,
    ): { success: boolean; candidates?: (ISparrow | ITalisman)[]; packType?: PackType; reason?: string } {
        const shopItem = shopState.items.find(i => i.id === itemId);
        if (!shopItem) return { success: false, reason: '商品不存在' };
        if (shopItem.sold) return { success: false, reason: '商品已售出' };
        if (shopItem.type !== 'pack') return { success: false, reason: '商品类型不匹配' };
        if (runState.money < shopItem.cost) return { success: false, reason: '资金不足' };

        runState.money -= shopItem.cost;
        shopItem.sold = true;

        const packType = shopItem.packType!;
        if (packType === PackType.SparrowPack) {
            const pool = this.registry.getAvailablePool(profile.unlockedRarity);
            const candidates = this.registry.getRandomSparrows(pool, 3, rng);
            return { success: true, candidates, packType };
        } else {
            const candidates = [
                this.generateRandomTalisman(rng, runState.ante),
                this.generateRandomTalisman(rng, runState.ante),
                this.generateRandomTalisman(rng, runState.ante),
            ];
            return { success: true, candidates, packType };
        }
    }

    /** 刷新商品 */
    refreshShop(shopState: IShopState, runState: IRunState, rng: RNG, profile: IPlayerProfile): { success: boolean; reason?: string } {
        const cost = shopState.refreshCost + shopState.refreshCount * REFRESH_COST_INCREMENT;
        if (runState.money < cost) return { success: false, reason: '资金不足' };

        runState.money -= cost;
        shopState.refreshCount++;

        // 重新生成新商品
        const newState = this.generateShopItems(rng, profile, runState.ante);
        shopState.items = newState.items;
        shopState.refreshCost = cost + REFRESH_COST_INCREMENT;

        return { success: true };
    }

    /** 生成随机符咒 */
    private generateRandomTalisman(rng: RNG, ante: number): ITalisman {
        const effects = [
            TalismanEffectType.ChangeAttribute,
            TalismanEffectType.TempMult,
            TalismanEffectType.Draw,
            TalismanEffectType.UndoDiscard,
            TalismanEffectType.PickFromDiscard,
        ];
        const effectType = effects[rng.nextInt(0, effects.length - 1)];
        const names: Record<string, string> = {
            changeAttribute: '点金符',
            tempMult: '强化符',
            draw: '天牌符',
            undoDiscard: '回旋符',
            pickFromDiscard: '贪婪符',
        };
        const values: Record<string, number> = {
            changeAttribute: 1,
            tempMult: 2 + ante,
            draw: 2,
            undoDiscard: 1,
            pickFromDiscard: 2,
        };

        return {
            id: `talisman_${++_shopUid}`,
            name: names[effectType] || '符咒',
            description: `${names[effectType]} 效果`,
            effectType,
            value: values[effectType] || 1,
            uses: effectType === TalismanEffectType.TempMult ? 1 : 2,
        };
    }
}

// ═══════════════════════════════════════════════════════════
//  内联测试
// ═══════════════════════════════════════════════════════════

export function runShopManagerTests(): void {
    console.log('══════ ShopManager 测试 ══════\n');

    // 准备
    const registry = new SparrowRegistry();
    const defaults = createDefaultSparrows();
    registry.registerAll(defaults);
    const shop = new ShopManager(registry);
    const rng = new RNG(42);
    const profile = _testDefaultProfile();
    const runState = _testRunState();

    // 测试 1: 生成商品
    const shopState = shop.generateShopItems(rng, profile, 1);
    console.log('测试 1: 商品生成');
    console.log('  商品数量:', shopState.items.length);
    console.log('  通过:', shopState.items.length === SHOP_ITEM_COUNT, '\n');

    // 测试 2: 购买雀鸟
    const sparrowItem = shopState.items.find(i => i.type === 'sparrow');
    if (sparrowItem) {
        const moneyBefore = runState.money;
        const result = shop.buySparrow(shopState, sparrowItem.id, runState, profile);
        console.log('测试 2: 购买雀鸟');
        console.log('  结果:', result.success);
        console.log('  扣费:', moneyBefore - runState.money);
        console.log('  雀鸟数:', runState.sparrows.length);
        console.log('  通过:', result.success && runState.sparrows.length === 1, '\n');
    } else {
        console.log('测试 2: (跳过 - 无雀鸟商品)\n');
    }

    // 测试 3: 资金不足
    const poorRunState = _testRunState();
    poorRunState.money = 0;
    const poorResult = shop.buySparrow(shopState, shopState.items[0]?.id || '', poorRunState, profile);
    console.log('测试 3: 资金不足');
    console.log('  通过:', !poorResult.success, '\n');

    // 测试 4: 刷新商品
    const richRunState = _testRunState();
    richRunState.money = 100;
    const refreshResult = shop.refreshShop(shopState, richRunState, rng, profile);
    console.log('测试 4: 刷新商品');
    console.log('  结果:', refreshResult.success);
    console.log('  通过:', refreshResult.success, '\n');
}

// ─── 测试辅助 (避免循环依赖) ─────────────────────────────────

function _testDefaultProfile(): IPlayerProfile {
    return {
        totalExp: 0, level: 1, starDust: 0,
        talents: [
            { type: 'initialMoney' as any, level: 0, maxLevel: 5, costPerLevel: 10, effectPerLevel: 1 },
            { type: 'maxDiscard' as any, level: 0, maxLevel: 3, costPerLevel: 15, effectPerLevel: 1 },
            { type: 'maxSparrowSlots' as any, level: 0, maxLevel: 2, costPerLevel: 25, effectPerLevel: 1 },
            { type: 'shopDiscount' as any, level: 0, maxLevel: 4, costPerLevel: 12, effectPerLevel: 5 },
        ],
        discoveredSparrows: [], highestPatterns: {},
        unlockedRarity: 1, language: 'zh' as any, totalRuns: 0,
    };
}

function _testRunState(): IRunState {
    return {
        seed: 42, ante: 1, round: 1, money: 20,
        sparrows: [], talismans: [],
        earnedStarDust: 0, earnedExp: 0, clearedStages: 0,
    };
}
