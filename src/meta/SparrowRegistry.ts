/**
 *  《雀神牌》雀鸟注册表
 *
 *  职责:
 *   - 全局雀鸟模板注册
 *   - 按稀有度过滤商店池
 *   - 随机抽取雀鸟
 *   - 内置 ~14 只示例雀鸟数据
 *
 *  纯逻辑层 —— 不引用任何 Phaser 代码
 */

import { SparrowEffectType, Rarity } from '../types/enums';
import type { ISparrow } from '../types/interfaces';
import { RNG } from '../utils/RNG';

export class SparrowRegistry {
    private sparrows: Map<string, ISparrow> = new Map();

    /** 注册一只雀鸟模板 */
    registerSparrow(sparrow: ISparrow): void {
        this.sparrows.set(sparrow.id, sparrow);
    }

    /** 批量注册 */
    registerAll(sparrows: ISparrow[]): void {
        for (const s of sparrows) {
            this.sparrows.set(s.id, s);
        }
    }

    /** 获取所有已注册雀鸟 */
    getAllSparrows(): ISparrow[] {
        return Array.from(this.sparrows.values());
    }

    /** 按稀有度上限过滤可用池 */
    getAvailablePool(unlockedRarity: number): ISparrow[] {
        return this.getAllSparrows().filter(s => s.rarity <= unlockedRarity);
    }

    /** 从池中随机抽取 count 只 (不重复) */
    getRandomSparrows(pool: ISparrow[], count: number, rng: RNG): ISparrow[] {
        if (pool.length <= count) return [...pool];
        const shuffled = [...pool];
        rng.shuffle(shuffled);
        return shuffled.slice(0, count);
    }

    /** 按 ID 获取雀鸟模板 */
    getById(id: string): ISparrow | undefined {
        return this.sparrows.get(id);
    }

    /** 已注册总数 */
    getTotal(): number {
        return this.sparrows.size;
    }
}

// ─── 示例雀鸟数据 ───────────────────────────────────────────

/** 创建预置雀鸟模板 */
export function createDefaultSparrows(): ISparrow[] {
    return [
        // ── Priority 1-3: 基础分 (Chips) 加成 ──
        {
            id: 'sparrow_chip_basic', name: '啄木鸟', description: '每次结算 +15 基础分',
            effectType: SparrowEffectType.AddChips, value: 15,
            rarity: Rarity.Common, priority: 1, cost: 3,
        },
        {
            id: 'sparrow_chip_seq', name: '燕子', description: '含顺子时 +25 基础分',
            effectType: SparrowEffectType.AddChips, value: 25,
            rarity: Rarity.Common, priority: 2, cost: 4,
        },
        {
            id: 'sparrow_chip_honor', name: '喜鹊', description: '含字牌刻子时 +30 基础分',
            effectType: SparrowEffectType.AddChips, value: 30,
            rarity: Rarity.Uncommon, priority: 3, cost: 5,
        },

        // ── Priority 4-6: 倍率加法 (Mult Adders) ──
        {
            id: 'sparrow_mult_basic', name: '麻雀', description: '每次结算 +3 倍率',
            effectType: SparrowEffectType.AddMult, value: 3,
            rarity: Rarity.Common, priority: 4, cost: 4,
        },
        {
            id: 'sparrow_mult_pair', name: '鹦鹉', description: '含对子时 +5 倍率',
            effectType: SparrowEffectType.AddMult, value: 5,
            rarity: Rarity.Common, priority: 5, cost: 5,
        },
        {
            id: 'sparrow_mult_kezi', name: '猫头鹰', description: '含刻子时 +8 倍率',
            effectType: SparrowEffectType.AddMult, value: 8,
            rarity: Rarity.Uncommon, priority: 5, cost: 6,
        },
        {
            id: 'sparrow_mult_flush', name: '翠鸟', description: '清一色/混一色时 +12 倍率',
            effectType: SparrowEffectType.AddMult, value: 12,
            rarity: Rarity.Rare, priority: 6, cost: 8,
        },

        // ── Priority 7-9: 倍率乘法 (Multipliers) ──
        {
            id: 'sparrow_x_basic', name: '老鹰', description: '×1.5 倍率',
            effectType: SparrowEffectType.MultMult, value: 1.5,
            rarity: Rarity.Uncommon, priority: 7, cost: 7,
        },
        {
            id: 'sparrow_x_kong', name: '凤凰', description: '含杠时 ×2 倍率',
            effectType: SparrowEffectType.MultMult, value: 2,
            rarity: Rarity.Rare, priority: 8, cost: 10,
        },
        {
            id: 'sparrow_x_seven', name: '朱雀', description: '七对子时 ×2.5 倍率',
            effectType: SparrowEffectType.MultMult, value: 2.5,
            rarity: Rarity.Rare, priority: 8, cost: 12,
        },
        {
            id: 'sparrow_x_orphans', name: '青龙鸟', description: '国士无双时 ×3 倍率',
            effectType: SparrowEffectType.MultMult, value: 3,
            rarity: Rarity.Legendary, priority: 9, cost: 20,
        },

        // ── Priority 10: 经济类 ──
        {
            id: 'sparrow_econ_basic', name: '拾荒鸟', description: '通关后 +2 资金',
            effectType: SparrowEffectType.Economy, value: 2,
            rarity: Rarity.Common, priority: 10, cost: 4,
        },
        {
            id: 'sparrow_econ_rich', name: '金丝雀', description: '通关后 +4 资金',
            effectType: SparrowEffectType.Economy, value: 4,
            rarity: Rarity.Uncommon, priority: 10, cost: 7,
        },
        {
            id: 'sparrow_econ_king', name: '孔雀', description: '通关后 +8 资金, 但 -2 倍率',
            effectType: SparrowEffectType.Economy, value: 8,
            rarity: Rarity.Rare, priority: 10, cost: 12,
        },
    ];
}

// ═══════════════════════════════════════════════════════════
//  内联测试
// ═══════════════════════════════════════════════════════════

export function runSparrowRegistryTests(): void {
    console.log('══════ SparrowRegistry 测试 ══════\n');

    const registry = new SparrowRegistry();
    const defaults = createDefaultSparrows();
    registry.registerAll(defaults);

    // 测试 1: 注册数量
    console.log('测试 1: 注册数量');
    console.log('  总数:', registry.getTotal());
    console.log('  通过:', registry.getTotal() === defaults.length, '\n');

    // 测试 2: 按稀有度过滤
    const commonPool = registry.getAvailablePool(Rarity.Common);
    const uncommonPool = registry.getAvailablePool(Rarity.Uncommon);
    const allPool = registry.getAvailablePool(Rarity.Legendary);
    console.log('测试 2: 稀有度过滤');
    console.log('  Common 池:', commonPool.length);
    console.log('  Uncommon 池:', uncommonPool.length);
    console.log('  全部池:', allPool.length);
    console.log('  通过:', commonPool.length < uncommonPool.length && uncommonPool.length < allPool.length, '\n');

    // 测试 3: 随机抽取
    const rng = new RNG(42);
    const picked = registry.getRandomSparrows(allPool, 3, rng);
    console.log('测试 3: 随机抽取 3 只');
    console.log('  抽取数量:', picked.length);
    const uniqueIds = new Set(picked.map(s => s.id));
    console.log('  不重复:', uniqueIds.size === picked.length);
    console.log('  通过:', picked.length === 3 && uniqueIds.size === 3, '\n');

    // 测试 4: ID 查找
    const found = registry.getById('sparrow_chip_basic');
    console.log('测试 4: ID 查找');
    console.log('  名称:', found?.name);
    console.log('  通过:', found?.name === '啄木鸟', '\n');
}
