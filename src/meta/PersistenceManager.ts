/**
 *  《雀神牌》持久化管理器
 *
 *  职责:
 *   - 封装 localStorage 读写
 *   - 管理 IPlayerProfile 的序列化 / 反序列化
 *   - 提供默认初始存档
 *
 *  纯逻辑层 —— 不引用任何 Phaser 代码
 */

import { Language, PermanentTalentType, Rarity } from '../types/enums';
import type { IPlayerProfile, IPermanentTalent } from '../types/interfaces';

const STORAGE_KEY = 'sparrow_god_profile';

/** 创建默认天赋列表 */
function createDefaultTalents(): IPermanentTalent[] {
    return [
        { type: PermanentTalentType.InitialMoney, level: 0, maxLevel: 5, costPerLevel: 10, effectPerLevel: 1 },
        { type: PermanentTalentType.MaxDiscard, level: 0, maxLevel: 3, costPerLevel: 15, effectPerLevel: 1 },
        { type: PermanentTalentType.MaxSparrowSlots, level: 0, maxLevel: 2, costPerLevel: 25, effectPerLevel: 1 },
        { type: PermanentTalentType.ShopDiscount, level: 0, maxLevel: 4, costPerLevel: 12, effectPerLevel: 5 },
    ];
}

export class PersistenceManager {

    /** 获取默认初始存档 */
    static getDefaultProfile(): IPlayerProfile {
        return {
            totalExp: 0,
            level: 1,
            starDust: 0,
            talents: createDefaultTalents(),
            discoveredSparrows: [],
            highestPatterns: {},
            unlockedRarity: Rarity.Common,
            language: Language.ZH,
            totalRuns: 0,
        };
    }

    /** 加载存档 (不存在时返回默认存档) */
    static loadProfile(): IPlayerProfile {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return PersistenceManager.getDefaultProfile();
            const parsed = JSON.parse(raw) as Partial<IPlayerProfile>;
            // 合并默认值，防止存档字段缺失
            return { ...PersistenceManager.getDefaultProfile(), ...parsed };
        } catch {
            return PersistenceManager.getDefaultProfile();
        }
    }

    /** 保存存档 */
    static saveProfile(profile: IPlayerProfile): void {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    }

    /** 重置存档为默认值 */
    static resetProfile(): void {
        localStorage.removeItem(STORAGE_KEY);
    }
}

// ═══════════════════════════════════════════════════════════
//  内联测试
// ═══════════════════════════════════════════════════════════

export function runPersistenceManagerTests(): void {
    console.log('══════ PersistenceManager 测试 ══════\n');

    // 测试 1: 默认存档
    const def = PersistenceManager.getDefaultProfile();
    console.log('测试 1: 默认存档');
    console.log('  level:', def.level);
    console.log('  talents 数量:', def.talents.length);
    console.log('  通过:', def.level === 1 && def.talents.length === 4, '\n');

    // 测试 2: 保存 & 加载
    const profile = PersistenceManager.getDefaultProfile();
    profile.totalExp = 999;
    profile.starDust = 42;
    profile.discoveredSparrows = ['bird_1', 'bird_2'];
    PersistenceManager.saveProfile(profile);
    const loaded = PersistenceManager.loadProfile();
    console.log('测试 2: 保存 & 加载');
    console.log('  totalExp:', loaded.totalExp);
    console.log('  starDust:', loaded.starDust);
    console.log('  discoveredSparrows:', loaded.discoveredSparrows.length);
    console.log('  通过:', loaded.totalExp === 999 && loaded.starDust === 42 && loaded.discoveredSparrows.length === 2, '\n');

    // 测试 3: 重置
    PersistenceManager.resetProfile();
    const afterReset = PersistenceManager.loadProfile();
    console.log('测试 3: 重置');
    console.log('  totalExp:', afterReset.totalExp);
    console.log('  通过:', afterReset.totalExp === 0 && afterReset.level === 1, '\n');

    // 清理
    PersistenceManager.resetProfile();
}
