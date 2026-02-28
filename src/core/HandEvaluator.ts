/**
 *  《雀神牌》 核心算番引擎
 *
 *  功能:
 *   - 支持 14~18 张动态牌数 (杠产生额外牌)
 *   - DFS + 回溯: 4面子+1雀头 / 七对子 / 国士无双
 *   - 万能牌: 可替代任意牌，每张扣 10% 基础分
 *   - 暗杠(x3) / 明杠(x2) 自动判定
 *   - 自动选择 baseChips * baseMult 最高的最优解
 *
 *  纯逻辑层 —— 不引用任何 Phaser 代码
 */

import { TileSuit, TileRank, MeldType, HandPattern } from '../types/enums';
import type { ITile, IMeld, IHandResult } from '../types/interfaces';

// ─── 常量 ──────────────────────────────────────────────────

/** 34 种牌:  万1-9(0-8)  条1-9(9-17)  饼1-9(18-26)  风E/S/W/N(27-30)  箭Z/F/B(31-33) */
const TILE_KIND_COUNT = 34;

/** 国士无双需要的 13 种幺九字牌索引 */
const THIRTEEN_ORPHAN_INDICES = [
    0, 8,       // 万1, 万9
    9, 17,      // 条1, 条9
    18, 26,     // 饼1, 饼9
    27, 28, 29, 30,  // 东南西北
    31, 32, 33,      // 中发白
];

// ─── 索引 ↔ 花色/点数 映射 ────────────────────────────────

function tileToIndex(suit: TileSuit, rank: TileRank): number {
    switch (suit) {
        case TileSuit.Wan: return rank - 1;
        case TileSuit.Tiao: return 9 + rank - 1;
        case TileSuit.Bing: return 18 + rank - 1;
        case TileSuit.Wind: return 27 + (rank - TileRank.East);
        case TileSuit.Dragon: return 31 + (rank - TileRank.Zhong);
    }
}

function indexToSuitRank(idx: number): { suit: TileSuit; rank: TileRank } {
    if (idx < 9) return { suit: TileSuit.Wan, rank: (idx + 1) as TileRank };
    if (idx < 18) return { suit: TileSuit.Tiao, rank: (idx - 9 + 1) as TileRank };
    if (idx < 27) return { suit: TileSuit.Bing, rank: (idx - 18 + 1) as TileRank };
    if (idx < 31) return { suit: TileSuit.Wind, rank: (TileRank.East + idx - 27) as TileRank };
    return { suit: TileSuit.Dragon, rank: (TileRank.Zhong + idx - 31) as TileRank };
}

/** 能否以此索引为起点组成顺子 (数牌 1-7 位置) */
function canStartSequence(idx: number): boolean {
    if (idx >= 27) return false;           // 字牌不能组顺子
    return (idx % 9) <= 6;                 // 在花色内 0-6 (对应牌面 1-7)
}

/** 单张牌的基础分: 字牌 20, 1/9 为 10, 2-8 为 5 */
function chipsForIndex(idx: number): number {
    if (idx >= 27) return 20;              // 风/箭
    const pos = idx % 9;                   // 0-8 对应 1-9
    return (pos === 0 || pos === 8) ? 10 : 5;
}

// ─── DFS 内部数据结构 ─────────────────────────────────────

interface RawMeld {
    type: MeldType;
    startIndex: number;   // 刻/杠 = 该牌索引, 顺子 = 起始牌索引
    regularUsed: number;  // 消耗的普通牌张数
    wildcardUsed: number; // 消耗的万能牌张数
}

interface RawDecomp {
    melds: RawMeld[];
    pair: { index: number; regularUsed: number; wildcardUsed: number };
}

interface ScoredResult {
    decomp: RawDecomp;
    chips: number;
    mult: number;
    total: number;
}

// ─── 核心算法 ──────────────────────────────────────────────

/**
 * 将剩余的纯万能牌拆分成 meldsNeeded 个面子。
 * wildcards = 3*a + 4*b, a+b = meldsNeeded, a≥0, b≥0
 */
function resolveWildcardMelds(
    wildcards: number,
    meldsNeeded: number,
    existing: RawMeld[],
): RawMeld[][] {
    // b = wildcards - 3 * meldsNeeded
    const b = wildcards - 3 * meldsNeeded;
    const a = meldsNeeded - b;
    if (b < 0 || a < 0) return [];

    const out = [...existing];
    for (let i = 0; i < a; i++)
        out.push({ type: MeldType.Kezi, startIndex: -1, regularUsed: 0, wildcardUsed: 3 });
    for (let i = 0; i < b; i++)
        out.push({ type: MeldType.Gangzi, startIndex: -1, regularUsed: 0, wildcardUsed: 4 });
    return [out];
}

/**
 *  DFS: 从 startIdx 开始，在 counts + wildcards 中恰好拆出 meldsNeeded 个面子。
 *  counts 是可变的——进入时修改，回溯时还原。
 */
function findMelds(
    counts: Int8Array,
    wildcards: number,
    meldsNeeded: number,
    current: RawMeld[],
    startIdx: number,
): RawMeld[][] {
    // 找到第一个非零位置
    let i = startIdx;
    while (i < TILE_KIND_COUNT && counts[i] === 0) i++;

    // 所有普通牌已用完
    if (i >= TILE_KIND_COUNT) {
        if (meldsNeeded === 0 && wildcards === 0) return [[...current]];
        if (meldsNeeded > 0 && wildcards > 0) return resolveWildcardMelds(wildcards, meldsNeeded, current);
        return [];
    }
    if (meldsNeeded === 0) return [];   // 面子已够但还有牌剩余 → 失败

    // 剪枝: 剩余牌数不可能凑够
    let remainReg = 0;
    for (let k = i; k < TILE_KIND_COUNT; k++) remainReg += counts[k];
    const remainAll = remainReg + wildcards;
    if (remainAll < meldsNeeded * 3) return [];            // 最少每面子 3 张
    if (remainAll > meldsNeeded * 4) return [];            // 最多每面子 4 张

    const results: RawMeld[][] = [];

    // ① 杠 (4 张同一种牌)
    {
        const maxReg = Math.min(counts[i], 4);
        const wcNeed = 4 - maxReg;
        if (wcNeed <= wildcards) {
            counts[i] -= maxReg;
            current.push({ type: MeldType.Gangzi, startIndex: i, regularUsed: maxReg, wildcardUsed: wcNeed });
            results.push(...findMelds(counts, wildcards - wcNeed, meldsNeeded - 1, current, i));
            current.pop();
            counts[i] += maxReg;
        }
    }

    // ② 刻子 (3 张同一种牌)
    {
        const maxReg = Math.min(counts[i], 3);
        const wcNeed = 3 - maxReg;
        if (wcNeed <= wildcards) {
            counts[i] -= maxReg;
            current.push({ type: MeldType.Kezi, startIndex: i, regularUsed: maxReg, wildcardUsed: wcNeed });
            results.push(...findMelds(counts, wildcards - wcNeed, meldsNeeded - 1, current, i));
            current.pop();
            counts[i] += maxReg;
        }
    }

    // ③ 顺子 (3 张连续同花色数牌)
    if (canStartSequence(i)) {
        const positions = [i, i + 1, i + 2];
        let wcNeed = 0;
        for (const p of positions) { if (counts[p] === 0) wcNeed++; }

        if (wcNeed <= wildcards) {
            const consumed: number[] = [];
            for (const p of positions) {
                if (counts[p] > 0) { counts[p]--; consumed.push(p); }
            }
            current.push({ type: MeldType.Shunzi, startIndex: i, regularUsed: 3 - wcNeed, wildcardUsed: wcNeed });
            results.push(...findMelds(counts, wildcards - wcNeed, meldsNeeded - 1, current, i));
            current.pop();
            for (const p of consumed) counts[p]++;
        }
    }

    return results;
}

// ─── 算分 ──────────────────────────────────────────────────

/**
 * 对一个合法拆解计算 baseChips / baseMult / totalScore。
 * talismanFreeCount[i] 记录索引 i 处"非万能且非符咒生成"的牌数量。
 */
function scoreDecomp(
    decomp: RawDecomp,
    talismanFreeCount: Int8Array,
): ScoredResult {
    let chips = 0;
    let mult = 1;
    let totalWC = decomp.pair.wildcardUsed;

    // ── 雀头 ──
    const pairIdx = decomp.pair.index;
    if (pairIdx >= 0) {
        chips += chipsForIndex(pairIdx) * 2;
    } else if (pairIdx === -1) {
        // 纯万能牌雀头 → 选最高分 (字牌 20×2 = 40)
        chips += 40;
    }

    // ── 面子 ──
    for (const m of decomp.melds) {
        totalWC += m.wildcardUsed;

        if (m.type === MeldType.Gangzi) {
            // 杠的分值 = 4 张
            if (m.startIndex >= 0) {
                chips += chipsForIndex(m.startIndex) * 4;
                // 暗杠: 4张全用普通牌 & 全部为非符咒生成
                if (m.wildcardUsed === 0 && talismanFreeCount[m.startIndex] >= 4) {
                    mult *= 3;
                } else {
                    mult *= 2;
                }
            } else {
                // 纯万能牌杠 → 当做字牌 (20×4=80)，明杠 x2
                chips += 80;
                mult *= 2;
            }
        } else if (m.type === MeldType.Kezi) {
            if (m.startIndex >= 0) {
                chips += chipsForIndex(m.startIndex) * 3;
            } else {
                chips += 60; // 万能牌刻子 → 字牌 20×3
            }
        } else if (m.type === MeldType.Shunzi) {
            chips += chipsForIndex(m.startIndex)
                + chipsForIndex(m.startIndex + 1)
                + chipsForIndex(m.startIndex + 2);
        }
    }

    // 万能牌惩罚: 每张 -10% (乘 0.9^n)
    chips = Math.floor(chips * Math.pow(0.9, totalWC));

    return { decomp, chips, mult, total: chips * mult };
}

function tryPartial(
    countsArr: Int8Array,
    wildcardCount: number,
    talismanFreeCount: Int8Array,
    n: number
): ScoredResult[] {
    const results: ScoredResult[] = [];

    // Test combinations of at most 1 pair, and some number of melds.
    for (let pairCount = 0; pairCount <= 1; pairCount++) {
        for (let meldsNeeded = 0; meldsNeeded <= 4; meldsNeeded++) {
            const pairCandidates: number[] = [];
            if (pairCount === 1) {
                for (let i = 0; i < TILE_KIND_COUNT; i++) {
                    if (countsArr[i] >= 1) pairCandidates.push(i);
                }
                if (wildcardCount >= 2) pairCandidates.push(-1);
            } else {
                pairCandidates.push(-2); // -2 implies no pair
            }

            for (const pi of pairCandidates) {
                const pairReg = pi >= 0 ? Math.min(countsArr[pi], 2) : 0;
                const pairWC = pi === -2 ? 0 : 2 - Math.max(0, pairReg);
                if (pairWC > wildcardCount) continue;

                const counts = new Int8Array(countsArr);
                if (pi >= 0) counts[pi] -= pairReg;
                const remWC = wildcardCount - pairWC;

                let remReg = 0;
                for (let k = 0; k < TILE_KIND_COUNT; k++) remReg += counts[k];
                const remAll = remReg + remWC;
                if (remAll < meldsNeeded * 3 || remAll > meldsNeeded * 4) continue;

                const meldSets = findMelds(counts, remWC, meldsNeeded, [], 0);
                for (const melds of meldSets) {
                    let totalUsed = pairReg + pairWC;
                    for (const m of melds) totalUsed += m.regularUsed + m.wildcardUsed;
                    if (totalUsed === n) {
                        const d: RawDecomp = {
                            melds,
                            pair: { index: pi, regularUsed: pairReg, wildcardUsed: pairWC },
                        };
                        results.push(scoreDecomp(d, talismanFreeCount));
                    }
                }
            }
        }
    }
    return results;
}

// ─── 三大胡型检测 ──────────────────────────────────────────

function tryStandard(
    countsArr: Int8Array,
    wildcardCount: number,
    talismanFreeCount: Int8Array,
): ScoredResult[] {
    const results: ScoredResult[] = [];
    const NUM_MELDS = 4;

    // 枚举雀头位置 (-1 表示纯万能牌雀头)
    const pairCandidates: number[] = [];
    for (let i = 0; i < TILE_KIND_COUNT; i++) {
        if (countsArr[i] >= 1) pairCandidates.push(i);
    }
    if (wildcardCount >= 2) pairCandidates.push(-1); // 纯万能牌雀头

    for (const pi of pairCandidates) {
        const pairReg = pi >= 0 ? Math.min(countsArr[pi], 2) : 0;
        const pairWC = 2 - pairReg;
        if (pairWC > wildcardCount) continue;

        const counts = new Int8Array(countsArr);
        if (pi >= 0) counts[pi] -= pairReg;
        const remWC = wildcardCount - pairWC;

        // 剩余牌数检查
        let remReg = 0;
        for (let k = 0; k < TILE_KIND_COUNT; k++) remReg += counts[k];
        const remAll = remReg + remWC;
        if (remAll < NUM_MELDS * 3 || remAll > NUM_MELDS * 4) continue;

        const meldSets = findMelds(counts, remWC, NUM_MELDS, [], 0);
        for (const melds of meldSets) {
            const d: RawDecomp = {
                melds,
                pair: { index: pi, regularUsed: pairReg, wildcardUsed: pairWC },
            };
            results.push(scoreDecomp(d, talismanFreeCount));
        }
    }

    return results;
}

function trySevenPairs(
    countsArr: Int8Array,
    wildcardCount: number,
    talismanFreeCount: Int8Array,
): ScoredResult[] {
    // 七对子仅限 14 张 (外部已保证)
    // 尝试用万能牌补全 7 个对子
    let wcNeeded = 0;
    const pairs: { index: number; wildcardUsed: number }[] = [];

    // 先用普通牌配对
    const remaining = new Int8Array(countsArr);
    for (let i = 0; i < TILE_KIND_COUNT; i++) {
        while (remaining[i] >= 2) {
            pairs.push({ index: i, wildcardUsed: 0 });
            remaining[i] -= 2;
        }
    }

    // 剩余的单牌用万能牌配对
    for (let i = 0; i < TILE_KIND_COUNT; i++) {
        while (remaining[i] >= 1 && wcNeeded + 1 <= wildcardCount) {
            pairs.push({ index: i, wildcardUsed: 1 });
            remaining[i] -= 1;
            wcNeeded++;
        }
    }

    // 剩余万能牌两两配对
    let leftWC = wildcardCount - wcNeeded;
    while (leftWC >= 2 && pairs.length < 7) {
        pairs.push({ index: -1, wildcardUsed: 2 });
        leftWC -= 2;
    }

    if (pairs.length !== 7) return [];
    // 确认所有普通牌用完
    let leftReg = 0;
    for (let k = 0; k < TILE_KIND_COUNT; k++) leftReg += remaining[k];
    if (leftReg !== 0 || leftWC !== 0) return [];

    // 七对子视为 "0 面子 + 7 雀头" → 转换为标准输出格式: melds = 前6对, pair = 第7对
    const melds: RawMeld[] = pairs.slice(0, 6).map(p => ({
        type: MeldType.Pair,
        startIndex: p.index,
        regularUsed: 2 - p.wildcardUsed,
        wildcardUsed: p.wildcardUsed,
    }));
    const lastPair = pairs[6];
    const d: RawDecomp = {
        melds,
        pair: { index: lastPair.index, regularUsed: 2 - lastPair.wildcardUsed, wildcardUsed: lastPair.wildcardUsed },
    };

    // 计分: 七对子固定 baseMult = 2, chips 按正常逻辑
    const scored = scoreDecomp(d, talismanFreeCount);
    scored.mult = Math.max(scored.mult, 2);        // 七对子最低 x2
    scored.total = scored.chips * scored.mult;
    return [scored];
}

function tryThirteenOrphans(
    countsArr: Int8Array,
    wildcardCount: number,
    talismanFreeCount: Int8Array,
): ScoredResult[] {
    // 国士无双: 13 种幺九字牌各 1 张 + 其中任意一种多 1 张 (共 14 张)
    // 1) 统计缺失的幺九字牌种类数
    let missingCount = 0;
    for (const idx of THIRTEEN_ORPHAN_INDICES) {
        if (countsArr[idx] === 0) missingCount++;
    }
    // 万能牌至少要补齐缺失的种类
    if (missingCount > wildcardCount) return [];

    const results: ScoredResult[] = [];

    // 2) 枚举雀头选哪种幺九字牌
    for (const pairIdx of THIRTEEN_ORPHAN_INDICES) {
        // 这种牌需要 2 张 (1张用于"各1", 1张用于雀头第2张)
        // 其余 12 种各需要 1 张
        let wcUsed = 0;
        const melds: RawMeld[] = [];

        // 检查雀头: 需要 2 张 pairIdx
        const pairAvail = countsArr[pairIdx]; // 拥有的普通牌数
        const pairRegUsed = Math.min(pairAvail, 2);
        const pairWcUsed = 2 - pairRegUsed;
        wcUsed += pairWcUsed;

        // 检查其余 12 种: 各需要 1 张
        for (const idx of THIRTEEN_ORPHAN_INDICES) {
            if (idx === pairIdx) continue;
            if (countsArr[idx] >= 1) {
                melds.push({ type: MeldType.Kezi, startIndex: idx, regularUsed: 1, wildcardUsed: 0 });
            } else {
                wcUsed++;
                melds.push({ type: MeldType.Kezi, startIndex: idx, regularUsed: 0, wildcardUsed: 1 });
            }
        }

        if (wcUsed > wildcardCount) continue;

        // 确认总牌数 = 14 (前面已由调用方保证, 此处验证万能牌用量)
        // 已用: 雀头(2) + 12个单牌(12) = 14, 万能牌用量 = wcUsed
        // 剩余的普通牌和万能牌不能有多余
        let regUsedTotal = pairRegUsed;
        for (const m of melds) regUsedTotal += m.regularUsed;
        const totalReg = countsArr.reduce((a, b) => a + b, 0);
        if (regUsedTotal + wcUsed !== 14) continue;
        // 不能有多余的非幺九牌 (国士无双只能包含幺九字牌)
        if (totalReg - (regUsedTotal) !== 0) {
            // 有多余普通牌没用到 → 只有在多余牌也能参与时才行, 但国士无双不允许
            // 不过万能牌替换的是缺失的种类, 多余牌无法合入 → 跳过
            continue;
        }
        if (wcUsed !== wildcardCount) continue; // 所有万能牌必须被使用 (总共14张)

        const d: RawDecomp = {
            melds,
            pair: { index: pairIdx, regularUsed: pairRegUsed, wildcardUsed: pairWcUsed },
        };

        const scored = scoreDecomp(d, talismanFreeCount);
        // 国士无双固定倍率 x5
        scored.mult = Math.max(scored.mult, 5);
        scored.total = scored.chips * scored.mult;
        results.push(scored);
    }

    return results;
}

// ─── 结果构建 ──────────────────────────────────────────────

/** 按索引查找原始 ITile 对象 */
function pickTiles(
    pool: Map<number, ITile[]>,
    wildcardPool: ITile[],
    index: number,
    regularCount: number,
    wildcardCount: number,
): ITile[] {
    const out: ITile[] = [];
    const arr = pool.get(index) ?? [];
    for (let i = 0; i < regularCount && arr.length > 0; i++) out.push(arr.shift()!);
    for (let i = 0; i < wildcardCount && wildcardPool.length > 0; i++) out.push(wildcardPool.shift()!);
    return out;
}

function buildIMeld(
    type: MeldType,
    tiles: ITile[],
    wildcardCount: number,
): IMeld {
    return { type, tiles, wildcardCount };
}

function buildResult(
    scored: ScoredResult,
    pattern: HandPattern,
    tilesByIndex: Map<number, ITile[]>,
    wildcardTiles: ITile[],
): IHandResult {
    // 深拷贝池 (消耗性)
    const pool = new Map<number, ITile[]>();
    for (const [k, v] of tilesByIndex) pool.set(k, [...v]);
    const wcPool = [...wildcardTiles];

    const melds: IMeld[] = scored.decomp.melds.map(m => {
        const tiles = m.startIndex >= 0
            ? (m.type === MeldType.Shunzi
                ? [
                    ...pickTiles(pool, wcPool, m.startIndex, Math.min(1, m.regularUsed), 0),
                    ...pickTiles(pool, wcPool, m.startIndex + 1, Math.min(1, m.regularUsed > 1 ? 1 : 0), 0),
                    ...pickTiles(pool, wcPool, m.startIndex + 2, Math.min(1, m.regularUsed > 2 ? 1 : 0), 0),
                    // 不足的部分用万能牌
                    ...pickTiles(pool, wcPool, -1, 0, m.wildcardUsed),
                ]
                : pickTiles(pool, wcPool, m.startIndex, m.regularUsed, m.wildcardUsed))
            : pickTiles(pool, wcPool, -1, 0, m.wildcardUsed);
        return buildIMeld(m.type, tiles, m.wildcardUsed);
    });

    const pair = buildIMeld(
        MeldType.Pair,
        scored.decomp.pair.index >= 0
            ? pickTiles(pool, wcPool, scored.decomp.pair.index, scored.decomp.pair.regularUsed, scored.decomp.pair.wildcardUsed)
            : (scored.decomp.pair.index === -1 ? pickTiles(pool, wcPool, -1, 0, scored.decomp.pair.wildcardUsed) : []),
        scored.decomp.pair.wildcardUsed,
    );

    return {
        pattern,
        melds,
        pair,
        baseChips: scored.chips,
        baseMult: scored.mult,
        totalScore: scored.total,
    };
}

// ─── 公共 API ──────────────────────────────────────────────

export class HandEvaluator {
    /**
     * 算番入口: 传入手牌，返回最优胡牌拆解 (baseChips * baseMult 最大)。
     * 如果不能胡牌返回 null。
     */
    evaluate(tiles: ITile[]): IHandResult | null {
        const n = tiles.length;
        if (n < 2 || n > 18) return null;

        // ── 分离万能牌 ──
        const regulars = tiles.filter(t => !t.isWildcard);
        const wildcards = tiles.filter(t => t.isWildcard);
        const wcCount = wildcards.length;

        // ── 构建计数 & 符咒标记 ──
        const counts = new Int8Array(TILE_KIND_COUNT);
        const talismanFree = new Int8Array(TILE_KIND_COUNT);
        const tilesByIndex = new Map<number, ITile[]>();

        for (const t of regulars) {
            const idx = tileToIndex(t.suit, t.rank);
            counts[idx]++;
            if (!t.isGeneratedByTalisman) talismanFree[idx]++;
            if (!tilesByIndex.has(idx)) tilesByIndex.set(idx, []);
            tilesByIndex.get(idx)!.push(t);
        }

        // ── 收集所有合法拆解得分 ──
        const allScored: { scored: ScoredResult; pattern: HandPattern }[] = [];

        // 1) 标准胡 (4面子+1雀头) — 任意牌数
        for (const s of tryStandard(counts, wcCount, talismanFree)) {
            allScored.push({ scored: s, pattern: HandPattern.PingHu });
        }

        // 2) 七对子 / 国士无双 — 仅 14 张
        if (n === 14) {
            for (const s of trySevenPairs(counts, wcCount, talismanFree)) {
                allScored.push({ scored: s, pattern: HandPattern.QiDuiZi });
            }
            for (const s of tryThirteenOrphans(counts, wcCount, talismanFree)) {
                allScored.push({ scored: s, pattern: HandPattern.GuoShiWuShuang });
            }
        }

        // 3) Partial Hand (Incremental Submission)
        if (n < 14) {
            for (const s of tryPartial(counts, wcCount, talismanFree, n)) {
                allScored.push({ scored: s, pattern: HandPattern.Partial });
            }
        }

        if (allScored.length === 0) return null;

        // ── 选最优解 ──
        allScored.sort((a, b) => b.scored.total - a.scored.total);
        const best = allScored[0];

        return buildResult(best.scored, best.pattern, tilesByIndex, wildcards);
    }
}

// ═══════════════════════════════════════════════════════════
//  测试用例 (文件底部)
// ═══════════════════════════════════════════════════════════

/* ────────── 辅助: 快速创建牌 ────────── */

let _uid = 0;
function tile(
    suit: TileSuit,
    rank: TileRank,
    opts?: { wild?: boolean; talisman?: boolean },
): ITile {
    return {
        id: `t${++_uid}`,
        suit,
        rank,
        attribute: 'normal' as ITile['attribute'],
        isWildcard: opts?.wild ?? false,
        isGeneratedByTalisman: opts?.talisman ?? false,
    };
}
function W(suit: TileSuit, rank: TileRank) { return tile(suit, rank); }
function WILD() { return tile(TileSuit.Wan, TileRank.One, { wild: true }); }
function TALIS(suit: TileSuit, rank: TileRank) { return tile(suit, rank, { talisman: true }); }

function runTests() {
    const ev = new HandEvaluator();
    console.log('══════ 《雀神牌》HandEvaluator 测试 ══════\n');

    // ─── 测试 1: 含 2 个暗杠的标准胡牌 (16 张) ───
    // 暗杠: 万1×4, 条9×4  顺子: 饼123  刻子: 中×3  雀头: 白×2
    {
        _uid = 0;
        const hand = [
            ...Array.from({ length: 4 }, () => W(TileSuit.Wan, TileRank.One)),     // 暗杠 万1
            ...Array.from({ length: 4 }, () => W(TileSuit.Tiao, TileRank.Nine)),   // 暗杠 条9
            W(TileSuit.Bing, TileRank.One), W(TileSuit.Bing, TileRank.Two), W(TileSuit.Bing, TileRank.Three),  // 顺子
            ...Array.from({ length: 3 }, () => W(TileSuit.Dragon, TileRank.Zhong)),  // 刻子 中
            W(TileSuit.Dragon, TileRank.Bai), W(TileSuit.Dragon, TileRank.Bai),     // 雀头 白
        ];
        const result = ev.evaluate(hand);
        console.log('测试 1: 2个暗杠 + 顺子 + 刻子 + 雀头 (16张)');
        console.log('  牌型:', result?.pattern);
        console.log('  基础分:', result?.baseChips, '  倍率:', result?.baseMult);
        console.log('  总分 (Chips×Mult):', result?.totalScore);
        console.log('  预期: 暗杠x2 → mult=9, chips含4×10+4×10+10+5+5+3×20+2×20 = 40+40+20+60+40=200');
        console.log('  预期总分: 200 × 9 = 1800');
        console.log('  通过:', result !== null && result.baseMult === 9, '\n');
    }

    // ─── 测试 2: 用 2 张万能牌凑国士无双 (14 张) ───
    // 有 11 种幺九字牌 + 2 万能牌, 条1作雀头 (条1×2)
    // 缺: 中, 发 → 万能牌补
    // 拥有: 万1,万9,条1×2,条9,饼1,饼9,东,南,西,北,白 = 12 普通 + 2 万能 = 14
    {
        _uid = 0;
        const hand = [
            W(TileSuit.Wan, TileRank.One),
            W(TileSuit.Wan, TileRank.Nine),
            W(TileSuit.Tiao, TileRank.One),
            W(TileSuit.Tiao, TileRank.One),   // 重复: 雀头
            W(TileSuit.Tiao, TileRank.Nine),
            W(TileSuit.Bing, TileRank.One),
            W(TileSuit.Bing, TileRank.Nine),
            W(TileSuit.Wind, TileRank.East),
            W(TileSuit.Wind, TileRank.South),
            W(TileSuit.Wind, TileRank.West),
            W(TileSuit.Wind, TileRank.North),
            W(TileSuit.Dragon, TileRank.Bai),  // 白
            // 缺: 中, 发 → 用万能牌
            WILD(), WILD(),
        ]; // 12 普通 + 2 万能 = 14 张
        const result = ev.evaluate(hand);
        console.log('测试 2: 2张万能牌凑国士无双 (14张)');
        console.log('  牌型:', result?.pattern);
        console.log('  基础分:', result?.baseChips, '  倍率:', result?.baseMult);
        console.log('  总分:', result?.totalScore);
        console.log('  预期: 牌型=国士无双, mult≥5, 万能牌惩罚 2张 → chips×0.81');
        console.log('  通过:', result !== null && result.pattern === HandPattern.GuoShiWuShuang, '\n');
    }

    // ─── 测试 3: 含明杠 (万能牌补杠) + 暗杠的混合 (15 张) ───
    // 暗杠: 饼9×4   明杠: 万5×3 + 万能牌×1   刻子: 条3×3  顺子: 饼123  雀头: 东×2
    // 总: 4 + 4 + 3 + 2 = 13 for melds + 2 pair = 15 张  ← 需要 4 面子
    // 15 tiles = pair(2) + 4melds → numKongs = 15-14 = 1
    // 但: 暗杠(4) + 明杠(4) = 2 kongs → need 15-14=1 kong only
    // 所以实际应该是 15 = 2 + 4 + 3 + 3 + 3 = 2 kong + 2 triplet? No: 2+4+4+3+3=16≠15
    // 正确: 15 = 2 + 4 + 3 + 3 + 3 (1 kong + 3 triplets) → 只能有 1 个杠
    // 那我们测: 暗杠饼9(4) + 刻子万5(3) + 刻子条3(3) + 刻子中(3) + 雀头东(2) = 15
    // 万能牌充当了第 4 个刻子中的一张
    {
        _uid = 0;
        const hand = [
            ...Array.from({ length: 4 }, () => W(TileSuit.Bing, TileRank.Nine)),   // 暗杠 饼9
            ...Array.from({ length: 3 }, () => W(TileSuit.Wan, TileRank.Five)),     // 刻子 万5
            ...Array.from({ length: 3 }, () => W(TileSuit.Tiao, TileRank.Three)),   // 刻子 条3
            W(TileSuit.Dragon, TileRank.Zhong), W(TileSuit.Dragon, TileRank.Zhong), WILD(), // 刻子 中 (2普通+1万能)
            W(TileSuit.Wind, TileRank.East), W(TileSuit.Wind, TileRank.East),      // 雀头 东
        ]; // 4+3+3+3+2 = 15 张
        const result = ev.evaluate(hand);
        console.log('测试 3: 暗杠饼9 + 刻子万5 + 刻子条3 + 刻子中(含万能) + 雀头东 (15张)');
        console.log('  牌型:', result?.pattern);
        console.log('  基础分:', result?.baseChips, '  倍率:', result?.baseMult);
        console.log('  总分:', result?.totalScore);
        console.log('  预期: 暗杠×3 → mult=3, 万能牌1张 → chips×0.9');
        console.log('  通过:', result !== null && result.baseMult === 3, '\n');
    }

    // ─── 测试 4: 纯万能牌七对子 (14 张, 全部万能牌) ───
    {
        _uid = 0;
        const hand = Array.from({ length: 14 }, () => WILD());
        const result = ev.evaluate(hand);
        console.log('测试 4: 14张全万能牌');
        console.log('  牌型:', result?.pattern);
        console.log('  基础分:', result?.baseChips, '  倍率:', result?.baseMult);
        console.log('  总分:', result?.totalScore);
        console.log('  预期: 非null (可组任意合法牌型), chips 受 14 张万能牌惩罚');
        console.log('  通过:', result !== null, '\n');
    }

    // ─── 测试 5: 含符咒生成牌的杠 → 明杠而非暗杠 ───
    // 杠: 条7×3(普通) + 条7×1(符咒生成) → 明杠  刻子: 万2×3  顺子: 饼456  雀头: 南×2
    // 总: 4+3+3+2 = 12 面子 + 2 雀头 → 但那是 14 张 (3 melds + pair), 需要 4 melds
    // 正确 15 张: 杠条7(4) + 刻万2(3) + 顺饼456(3) + 刻中(3) + 雀南(2) = 15
    {
        _uid = 0;
        const hand = [
            W(TileSuit.Tiao, TileRank.Seven), W(TileSuit.Tiao, TileRank.Seven),
            W(TileSuit.Tiao, TileRank.Seven), TALIS(TileSuit.Tiao, TileRank.Seven),  // 明杠 (含符咒牌)
            ...Array.from({ length: 3 }, () => W(TileSuit.Wan, TileRank.Two)),       // 刻子 万2
            W(TileSuit.Bing, TileRank.Four), W(TileSuit.Bing, TileRank.Five), W(TileSuit.Bing, TileRank.Six),  // 顺子
            ...Array.from({ length: 3 }, () => W(TileSuit.Dragon, TileRank.Zhong)),  // 刻子 中
            W(TileSuit.Wind, TileRank.South), W(TileSuit.Wind, TileRank.South),      // 雀头 南
        ]; // 4+3+3+3+2 = 15 张
        const result = ev.evaluate(hand);
        console.log('测试 5: 符咒生成牌导致明杠 (非暗杠)');
        console.log('  牌型:', result?.pattern);
        console.log('  基础分:', result?.baseChips, '  倍率:', result?.baseMult);
        console.log('  总分:', result?.totalScore);
        console.log('  预期: 条7杠=明杠(x2) 而非暗杠(x3), talismanFree[条7]=3<4, mult=2');
        console.log('  通过:', result !== null && result.baseMult === 2, '\n');
    }
}

// 在模块加载时自动运行测试 (仅开发阶段)
runTests();
