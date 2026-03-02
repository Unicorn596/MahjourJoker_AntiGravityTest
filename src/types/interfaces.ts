import {
    TileSuit, TileRank, TileAttribute, MeldType, KongType,
    HandPattern, GamePhase, SlotArea,
    SparrowEffectType, TalismanEffectType, TalismanCategory,
    Rarity, PermanentTalentType, PackType, Language, DeckMode
} from './enums';
import type { DeckManager } from '../core/DeckManager';
import type { RNG } from '../utils/RNG';

// ─── 牌与面子 ───────────────────────────────────────────────

/** 单张麻将牌 */
export interface ITile {
    id: string;
    suit: TileSuit;
    rank: TileRank;
    attribute: TileAttribute;
    isWildcard: boolean;
    /** 是否由符咒生成 (影响暗杠/明杠判定) */
    isGeneratedByTalisman: boolean;
}

/** 一个面子 (顺子/刻子/杠子/雀头) */
export interface IMeld {
    type: MeldType;
    tiles: ITile[];
    wildcardCount: number;
}

// ─── 提交堆：双区系统 ──────────────────────────────────────

/** 提交堆中的一个槽位 */
export interface ISubmissionSlot {
    /** 所属区域 */
    area: SlotArea;
    /** 接受的面子类型: Settlement 面子位接受 Shunzi/Kezi, 雀头位接受 Pair, Kong 区接受 Gangzi */
    acceptType: 'meld' | 'pair';
    /** 已填入的面子 (null = 空槽) */
    meld: IMeld | null;
    /** 是否已填充 */
    filled: boolean;
}

/** 杠槽中的一个槽位 */
export interface IKongSlot {
    /** 杠牌面子 (null = 空槽) */
    meld: IMeld | null;
    /** 杠类型 */
    kongType: KongType | null;
    /** 是否已填充 */
    filled: boolean;
}

/** 提交堆整体结构 */
export interface ISubmissionPileState {
    /** 结算槽 - 面子位 (数量 = 4 - 已提交杠数) */
    settlementMeldSlots: ISubmissionSlot[];
    /** 结算槽 - 雀头位 (固定 1 个) */
    pairSlot: ISubmissionSlot;
    /** 杠槽 (最多 4 个) */
    kongSlots: IKongSlot[];
    /** 当前已提交的杠数量 */
    kongCount: number;
    /** 是否处于七对子模式 */
    isSevenPairsMode: boolean;
    /** 七对子模式下的 7 个对子槽 */
    sevenPairSlots: ISubmissionSlot[];
}

/** 预算分 (提交过程中实时显示) */
export interface IScorePreview {
    /** 当前已提交牌面的基础分 */
    estimatedChips: number;
    /** 当前可识别的倍率 */
    estimatedMult: number;
    /** 预估总分 = chips × mult */
    estimatedTotal: number;
    /** 已识别的牌型列表 */
    recognizedPatterns: HandPattern[];
    /** 提交堆是否完成 */
    isComplete: boolean;
}

// ─── 算分结果 ───────────────────────────────────────────────

/** 番种识别 + 算分结果 */
export interface IHandResult {
    /** 最优番种 */
    pattern: HandPattern;
    /** 所有匹配的番种 (取倍率最高的) */
    matchedPatterns: HandPattern[];
    /** 结算槽中的面子列表 */
    melds: IMeld[];
    /** 雀头 */
    pair: IMeld;
    /** 杠槽中的杠列表 */
    kongs: IMeld[];
    /** 基础分 (牌面分之和, 含万能牌惩罚) */
    baseChips: number;
    /** 最终倍率 (番种倍率 × 杠倍率) */
    baseMult: number;
    /** 总分 = baseChips × baseMult */
    totalScore: number;
}

/** 分数拆解明细 */
export interface IScoreBreakdown {
    baseChips: number;
    chipBonuses: number[];
    baseMult: number;
    multBonuses: number[];
    wildcardPenalty: number;
    kongMultipliers: { kongType: KongType; mult: number }[];
    finalChips: number;
    finalMult: number;
    totalScore: number;
}

// ─── 道具与商店 ─────────────────────────────────────────────

/** 雀鸟 (被动增益) */
export interface ISparrow {
    id: string;
    name: string;
    description: string;
    effectType: SparrowEffectType;
    value: number;
    rarity: Rarity;
    /** 触发优先级 (1-10): 1-3 基础分, 4-6 倍率加法, 7-9 倍率乘法, 10 经济 */
    priority: number;
    /** 商店售价 */
    cost: number;
}

/** 符咒 (消耗品) */
export interface ITalisman {
    id: string;
    name: string;
    description: string;
    /** 符咒分类 (符箓/星宿/灵符/道印) */
    category: TalismanCategory;
    effectType: TalismanEffectType;
    value: number;
    uses: number;
}

/** 使用符咒时的上下文 */
export interface ITalismanUseContext {
    /** 玩家手牌 (可变引用) */
    hand: ITile[];
    /** 牌库管理器 */
    deckManager: DeckManager;
    /** 选中的目标牌 ID 列表 */
    targetTileIds: string[];
    /** 当前局配置 (用于修改提交次数等) */
    roundConfig: IRoundConfig;
    /** RNG 实例 (用于琉璃符碎裂判定等) */
    rng: RNG;
}

/** 符咒使用结果 */
export interface ITalismanUseResult {
    success: boolean;
    /** 影响到的牌 */
    affectedTiles: ITile[];
    /** 日志消息 */
    message: string;
}

/** 强敌挑战 (Debuff) */
export interface ITribulation {
    id: string;
    name: string;
    description: string;
    effectKey: string;
}

// ─── 全局游戏状态 ───────────────────────────────────────────

/** 单局配置 */
export interface IRoundConfig {
    /** 目标分数 */
    targetScore: number;
    /** 最大换牌次数 */
    maxDiscardCount: number;
    /** 每次换牌上限张数 */
    maxDiscardTiles: number;
    /** 初始手牌数 */
    initialHandSize: number;
    /** 牌组模式 */
    deckMode?: DeckMode;
}

/** 全局游戏状态 */
export interface IGameState {
    phase: GamePhase;
    /** 当前重 (Ante) */
    ante: number;
    /** 当前小局 (1-3) */
    round: number;
    /** 资金 */
    money: number;

    /** 牌库 */
    deck: ITile[];
    /** 牌库剩余数量 */
    deckSize: number;
    /** 弃牌堆 */
    discardPile: ITile[];
    /** 手牌 (标准 8 张) */
    hand: ITile[];

    /** 提交堆状态 */
    submissionPile: ISubmissionPileState;

    /** 已用换牌次数 */
    discardCount: number;
    /** 最大换牌次数 */
    maxDiscardCount: number;

    /** 当前累计总分 */
    cumulativeScore: number;
    /** 本局目标分数 */
    targetScore: number;

    /** 携带的雀鸟 (上限 5) */
    sparrows: ISparrow[];
    /** 携带的符咒 */
    talismans: ITalisman[];

    /** 当前分数预测 */
    scorePreview: IScorePreview;
    /** 单局配置 */
    roundConfig: IRoundConfig;
}

// ─── Meta: 对局外流程 ───────────────────────────────────────

/** 永久天赋 */
export interface IPermanentTalent {
    type: PermanentTalentType;
    level: number;
    maxLevel: number;
    costPerLevel: number;
    effectPerLevel: number;
}

/** 玩家永久存档 (localStorage) */
export interface IPlayerProfile {
    /** 累计经验 */
    totalExp: number;
    /** 当前等级 */
    level: number;
    /** 星尘 (永久天赋货币) */
    starDust: number;
    /** 永久天赋 */
    talents: IPermanentTalent[];
    /** 收藏图鉴: 已发现的雀鸟 ID 集合 */
    discoveredSparrows: string[];
    /** 收藏图鉴: 已达成的最高牌型 -> 最高分 */
    highestPatterns: Record<string, number>;
    /** 解锁的稀有度上限 */
    unlockedRarity: number;
    /** 语言 */
    language: Language;
    /** 累计对局次数 */
    totalRuns: number;
    /** 已解锁的牌组模式 */
    unlockedDecks?: DeckMode[];
}

/** 杂货铺商品 */
export interface IShopItem {
    id: string;
    type: 'sparrow' | 'talisman' | 'pack';
    item: ISparrow | ITalisman | null;
    packType?: PackType;
    cost: number;
    sold: boolean;
}

/** 杂货铺状态 */
export interface IShopState {
    items: IShopItem[];
    /** 刷新费用 */
    refreshCost: number;
    /** 已刷新次数 */
    refreshCount: number;
}

/** 单次运行状态 (Run State) */
export interface IRunState {
    seed: number;
    ante: number;
    round: number;
    deckMode?: DeckMode;
    money: number;
    sparrows: ISparrow[];
    talismans: ITalisman[];
    /** 本次运行获得的星尘 */
    earnedStarDust: number;
    /** 本次运行获得的经验 */
    earnedExp: number;
    /** 已通过的关卡数 */
    clearedStages: number;
}
