/**
 *  《雀神牌》Meta 进度管理器
 *
 *  职责:
 *   - 经验 & 等级系统 (对局累积经验 → 解锁更高稀有度)
 *   - 永久天赋升级 (消耗星尘)
 *   - 天赋效果应用 (返回 RunState 修正参数)
 *
 *  纯逻辑层 —— 不引用任何 Phaser 代码
 */

import { PermanentTalentType, Rarity } from '../types/enums';
import type { IPlayerProfile, IPermanentTalent } from '../types/interfaces';

/** 基础游戏配置 (受天赋影响) */
export interface ITalentModifiers {
    initialMoney: number;
    maxDiscardBonus: number;
    maxSparrowSlots: number;
    shopDiscountPercent: number;
}

// ─── 等级 → 稀有度解锁 映射表 ──────────────────────────────
const RARITY_UNLOCK_TABLE: { level: number; rarity: Rarity }[] = [
    { level: 1, rarity: Rarity.Common },
    { level: 3, rarity: Rarity.Uncommon },
    { level: 6, rarity: Rarity.Rare },
    { level: 10, rarity: Rarity.Legendary },
];

export class MetaProgressionManager {

    /** 指定等级所需累计经验: 100 × level × (1 + level × 0.5) */
    static getExpForLevel(level: number): number {
        return Math.floor(100 * level * (1 + level * 0.5));
    }

    /** 增加经验并自动检查升级 */
    static addExp(profile: IPlayerProfile, exp: number): { leveledUp: boolean; newLevel: number; rarityUnlocked: boolean } {
        profile.totalExp += exp;
        let leveledUp = false;
        let rarityUnlocked = false;

        // 持续检查升级
        while (profile.totalExp >= MetaProgressionManager.getExpForLevel(profile.level + 1)) {
            profile.level++;
            leveledUp = true;

            // 检查稀有度解锁
            for (const entry of RARITY_UNLOCK_TABLE) {
                if (profile.level >= entry.level && profile.unlockedRarity < entry.rarity) {
                    profile.unlockedRarity = entry.rarity;
                    rarityUnlocked = true;
                }
            }
        }

        return { leveledUp, newLevel: profile.level, rarityUnlocked };
    }

    /** 消耗星尘升级天赋 */
    static upgradeTalent(profile: IPlayerProfile, talentType: PermanentTalentType): { success: boolean; reason?: string } {
        const talent = profile.talents.find(t => t.type === talentType);
        if (!talent) return { success: false, reason: '天赋不存在' };
        if (talent.level >= talent.maxLevel) return { success: false, reason: '已达最大等级' };

        const cost = talent.costPerLevel;
        if (profile.starDust < cost) return { success: false, reason: `星尘不足 (需要 ${cost}, 拥有 ${profile.starDust})` };

        profile.starDust -= cost;
        talent.level++;
        return { success: true };
    }

    /** 计算天赋对游戏参数的修正 */
    static applyTalents(profile: IPlayerProfile): ITalentModifiers {
        const mods: ITalentModifiers = {
            initialMoney: 4, // 默认初始资金
            maxDiscardBonus: 0,
            maxSparrowSlots: 5,
            shopDiscountPercent: 0,
        };

        for (const talent of profile.talents) {
            const bonus = talent.level * talent.effectPerLevel;
            switch (talent.type) {
                case PermanentTalentType.InitialMoney:
                    mods.initialMoney += bonus;
                    break;
                case PermanentTalentType.MaxDiscard:
                    mods.maxDiscardBonus += bonus;
                    break;
                case PermanentTalentType.MaxSparrowSlots:
                    mods.maxSparrowSlots += bonus;
                    break;
                case PermanentTalentType.ShopDiscount:
                    mods.shopDiscountPercent += bonus;
                    break;
            }
        }

        return mods;
    }

    /** 查看天赋信息 */
    static getTalentInfo(talent: IPermanentTalent): {
        currentBonus: number;
        nextCost: number | null;
        isMaxed: boolean;
    } {
        return {
            currentBonus: talent.level * talent.effectPerLevel,
            nextCost: talent.level < talent.maxLevel ? talent.costPerLevel : null,
            isMaxed: talent.level >= talent.maxLevel,
        };
    }
}

// ═══════════════════════════════════════════════════════════
//  内联测试
// ═══════════════════════════════════════════════════════════

export function runMetaProgressionTests(): void {
    console.log('══════ MetaProgressionManager 测试 ══════\n');

    // 测试辅助
    function makeProfile(): IPlayerProfile {
        return {
            totalExp: 0, level: 1, starDust: 100,
            talents: [
                { type: PermanentTalentType.InitialMoney, level: 0, maxLevel: 5, costPerLevel: 10, effectPerLevel: 1 },
                { type: PermanentTalentType.MaxDiscard, level: 0, maxLevel: 3, costPerLevel: 15, effectPerLevel: 1 },
                { type: PermanentTalentType.MaxSparrowSlots, level: 0, maxLevel: 2, costPerLevel: 25, effectPerLevel: 1 },
                { type: PermanentTalentType.ShopDiscount, level: 0, maxLevel: 4, costPerLevel: 12, effectPerLevel: 5 },
            ],
            discoveredSparrows: [], highestPatterns: {},
            unlockedRarity: Rarity.Common, language: 'zh' as any, totalRuns: 0,
        };
    }

    // 测试 1: 经验公式
    const exp2 = MetaProgressionManager.getExpForLevel(2);
    const exp5 = MetaProgressionManager.getExpForLevel(5);
    console.log('测试 1: 经验公式');
    console.log('  Level 2 需要:', exp2, '(期望: 400)');
    console.log('  Level 5 需要:', exp5, '(期望: 1750)');
    console.log('  通过:', exp2 === 400 && exp5 === 1750, '\n');

    // 测试 2: 升级
    const p2 = makeProfile();
    p2.totalExp = 395; // 差 5 点
    const r2a = MetaProgressionManager.addExp(p2, 5);
    console.log('测试 2: 升级检测');
    console.log('  升级:', r2a.leveledUp, ', 等级:', r2a.newLevel);
    console.log('  通过:', r2a.leveledUp && r2a.newLevel === 2, '\n');

    // 测试 3: 稀有度解锁
    const p3 = makeProfile();
    p3.totalExp = 0;
    // 升到 Level 3 应解锁 Uncommon
    MetaProgressionManager.addExp(p3, 2000);
    console.log('测试 3: 稀有度解锁');
    console.log('  等级:', p3.level, ', 稀有度:', p3.unlockedRarity);
    console.log('  通过:', p3.unlockedRarity >= Rarity.Uncommon, '\n');

    // 测试 4: 天赋升级
    const p4 = makeProfile();
    p4.starDust = 30;
    const r4a = MetaProgressionManager.upgradeTalent(p4, PermanentTalentType.InitialMoney);
    const r4b = MetaProgressionManager.upgradeTalent(p4, PermanentTalentType.InitialMoney);
    console.log('测试 4: 天赋升级');
    console.log('  第一次:', r4a.success, ', 剩余星尘:', p4.starDust);
    console.log('  第二次:', r4b.success, ', 剩余星尘:', p4.starDust);
    console.log('  通过:', r4a.success && r4b.success && p4.starDust === 10, '\n');

    // 测试 5: 天赋效果
    const p5 = makeProfile();
    p5.talents[0].level = 3; // +3 初始资金
    p5.talents[3].level = 2; // 10% 折扣
    const mods = MetaProgressionManager.applyTalents(p5);
    console.log('测试 5: 天赋效果');
    console.log('  初始资金:', mods.initialMoney, '(期望: 7)');
    console.log('  折扣%:', mods.shopDiscountPercent, '(期望: 10)');
    console.log('  通过:', mods.initialMoney === 7 && mods.shopDiscountPercent === 10, '\n');
}
