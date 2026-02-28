/**
 *  《雀神牌》收藏图鉴
 *
 *  职责:
 *   - 记录已发现的雀鸟
 *   - 记录已达成的最高牌型与分数
 *   - 计算图鉴完成率
 *
 *  纯逻辑层 —— 不引用任何 Phaser 代码
 */

import { HandPattern } from '../types/enums';
import type { IPlayerProfile } from '../types/interfaces';

export class CollectionCodex {

    /** 记录发现一只雀鸟 (去重) */
    static discoverSparrow(profile: IPlayerProfile, sparrowId: string): boolean {
        if (profile.discoveredSparrows.includes(sparrowId)) return false;
        profile.discoveredSparrows.push(sparrowId);
        return true;
    }

    /** 更新最高牌型分数，若新分数更高则更新 */
    static updateHighestPattern(profile: IPlayerProfile, pattern: HandPattern, score: number): boolean {
        const current = profile.highestPatterns[pattern] ?? 0;
        if (score > current) {
            profile.highestPatterns[pattern] = score;
            return true;
        }
        return false;
    }

    /** 图鉴完成率 (0-1) */
    static getCompletionRate(profile: IPlayerProfile, totalSparrows: number): number {
        if (totalSparrows === 0) return 0;
        return profile.discoveredSparrows.length / totalSparrows;
    }

    /** 图鉴概要 */
    static getCodexSummary(profile: IPlayerProfile, totalSparrows: number): {
        discoveredCount: number;
        totalSparrows: number;
        completionRate: number;
        patternsAchieved: number;
        highestPatterns: Record<string, number>;
    } {
        const allPatterns = Object.values(HandPattern);
        const patternsAchieved = allPatterns.filter(p => profile.highestPatterns[p] != null).length;

        return {
            discoveredCount: profile.discoveredSparrows.length,
            totalSparrows,
            completionRate: CollectionCodex.getCompletionRate(profile, totalSparrows),
            patternsAchieved,
            highestPatterns: { ...profile.highestPatterns },
        };
    }
}

// ═══════════════════════════════════════════════════════════
//  内联测试
// ═══════════════════════════════════════════════════════════

export function runCollectionCodexTests(): void {
    console.log('══════ CollectionCodex 测试 ══════\n');

    const profile: IPlayerProfile = {
        totalExp: 0, level: 1, starDust: 0,
        talents: [],
        discoveredSparrows: [],
        highestPatterns: {},
        unlockedRarity: 1, language: 'zh' as any, totalRuns: 0,
    };

    // 测试 1: 发现雀鸟
    const r1 = CollectionCodex.discoverSparrow(profile, 'bird_1');
    const r2 = CollectionCodex.discoverSparrow(profile, 'bird_2');
    const r3 = CollectionCodex.discoverSparrow(profile, 'bird_1'); // 重复
    console.log('测试 1: 发现雀鸟');
    console.log('  首次 bird_1:', r1);
    console.log('  首次 bird_2:', r2);
    console.log('  重复 bird_1:', r3);
    console.log('  发现数:', profile.discoveredSparrows.length);
    console.log('  通过:', r1 && r2 && !r3 && profile.discoveredSparrows.length === 2, '\n');

    // 测试 2: 最高牌型
    CollectionCodex.updateHighestPattern(profile, HandPattern.PingHu, 500);
    CollectionCodex.updateHighestPattern(profile, HandPattern.PingHu, 300); // 不应覆盖
    CollectionCodex.updateHighestPattern(profile, HandPattern.QingYiSe, 1200);
    console.log('测试 2: 最高牌型');
    console.log('  平胡:', profile.highestPatterns[HandPattern.PingHu]);
    console.log('  清一色:', profile.highestPatterns[HandPattern.QingYiSe]);
    console.log('  通过:', profile.highestPatterns[HandPattern.PingHu] === 500 && profile.highestPatterns[HandPattern.QingYiSe] === 1200, '\n');

    // 测试 3: 完成率
    const rate = CollectionCodex.getCompletionRate(profile, 14);
    console.log('测试 3: 完成率');
    console.log('  完成率:', (rate * 100).toFixed(1) + '%');
    console.log('  通过:', Math.abs(rate - 2 / 14) < 0.001, '\n');

    // 测试 4: 概要
    const summary = CollectionCodex.getCodexSummary(profile, 14);
    console.log('测试 4: 概要');
    console.log('  发现:', summary.discoveredCount, '/', summary.totalSparrows);
    console.log('  牌型达成:', summary.patternsAchieved);
    console.log('  通过:', summary.discoveredCount === 2 && summary.patternsAchieved === 2, '\n');
}
