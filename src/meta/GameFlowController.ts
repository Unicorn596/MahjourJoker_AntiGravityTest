/**
 *  《雀神牌》对局外流程控制器
 *
 *  职责:
 *   - 对局外流程状态机 (MainMenu → NewRun → Shop → InGame → GameOver/Victory)
 *   - 串联所有 Meta 模块
 *   - 通过 EventBus 广播状态变化事件
 *
 *  状态流转:
 *   [MainMenu] → startNewRun → [Shop] → enterGame → [InGame]
 *   [InGame] → endRound(success) → [Shop]     (下一重)
 *   [InGame] → endRound(fail)    → [GameOver]  (失败)
 *   [InGame] → endRun(victory)   → [Victory]   (通关)
 *   [GameOver/Victory] → returnToMenu → [MainMenu]
 *
 *  纯逻辑层 —— 不引用任何 Phaser 代码
 */

import { MetaPhase, HandPattern, Language, Rarity, PermanentTalentType } from '../types/enums';
import type { IPlayerProfile, IRunState, IShopState } from '../types/interfaces';
import { PersistenceManager } from './PersistenceManager';
import { MetaProgressionManager } from './MetaProgressionManager';
import { CollectionCodex } from './CollectionCodex';
import { ShopManager } from './ShopManager';
import { SparrowRegistry, createDefaultSparrows } from './SparrowRegistry';
import { RNG } from '../utils/RNG';
import { globalBus } from '../utils/EventBus';

// ─── 事件名常量 ─────────────────────────────────────────────

export const META_EVENTS = {
    PHASE_CHANGED: 'meta:phaseChanged',
    RUN_STARTED: 'meta:runStarted',
    RUN_ENDED: 'meta:runEnded',
    SHOP_ENTERED: 'meta:shopEntered',
    ROUND_ENDED: 'meta:roundEnded',
    LEVEL_UP: 'meta:levelUp',
    RARITY_UNLOCKED: 'meta:rarityUnlocked',
    SPARROW_DISCOVERED: 'meta:sparrowDiscovered',
    TALENT_UPGRADED: 'meta:talentUpgraded',
    LANGUAGE_CHANGED: 'meta:languageChanged',
} as const;

/** 每次运行的奖励经验基数 */
const BASE_RUN_EXP = 50;
/** 每通过一重额外经验 */
const PER_STAGE_EXP = 30;
/** 胜利额外经验 */
const VICTORY_BONUS_EXP = 100;
/** 每重奖励星尘 */
const PER_STAGE_STARDUST = 2;
/** 胜利奖励星尘 */
const VICTORY_BONUS_STARDUST = 10;
/** 最大重数 */
const MAX_ANTE = 8;

export class GameFlowController {
    private _phase: MetaPhase = MetaPhase.MainMenu;
    private _profile: IPlayerProfile;
    private _runState: IRunState | null = null;
    private _shopState: IShopState | null = null;
    private _rng: RNG | null = null;

    readonly registry: SparrowRegistry;
    readonly shopManager: ShopManager;

    constructor() {
        // 初始化雀鸟注册表
        this.registry = new SparrowRegistry();
        this.registry.registerAll(createDefaultSparrows());

        // 初始化商店管理器
        this.shopManager = new ShopManager(this.registry);

        // 加载存档
        this._profile = PersistenceManager.loadProfile();
    }

    // ─── 只读访问器 ──────────────────────────────────────────

    get phase(): MetaPhase { return this._phase; }
    get profile(): IPlayerProfile { return this._profile; }
    get runState(): IRunState | null { return this._runState; }
    get shopState(): IShopState | null { return this._shopState; }

    // ─── 阶段切换 ────────────────────────────────────────────

    private setPhase(phase: MetaPhase): void {
        const prev = this._phase;
        this._phase = phase;
        globalBus.emit(META_EVENTS.PHASE_CHANGED, { prev, next: phase });
    }

    // ─── 主菜单操作 ──────────────────────────────────────────

    /** 开启新征程 */
    startNewRun(seed?: number): IRunState {
        const actualSeed = seed ?? Date.now();
        this._rng = new RNG(actualSeed);

        // 应用天赋
        const mods = MetaProgressionManager.applyTalents(this._profile);

        this._runState = {
            seed: actualSeed,
            ante: 1,
            round: 1,
            money: mods.initialMoney,
            sparrows: [],
            talismans: [],
            earnedStarDust: 0,
            earnedExp: 0,
            clearedStages: 0,
        };

        this._profile.totalRuns++;
        PersistenceManager.saveProfile(this._profile);

        this.setPhase(MetaPhase.Shop);
        globalBus.emit(META_EVENTS.RUN_STARTED, { runState: this._runState });

        return this._runState;
    }

    /** 切换语言 */
    switchLanguage(lang: Language): void {
        this._profile.language = lang;
        PersistenceManager.saveProfile(this._profile);
        globalBus.emit(META_EVENTS.LANGUAGE_CHANGED, { language: lang });
    }

    // ─── 杂货铺 ──────────────────────────────────────────────

    /** 进入杂货铺 */
    enterShop(): IShopState {
        if (!this._runState || !this._rng) throw new Error('No active run');

        this._shopState = this.shopManager.generateShopItems(
            this._rng, this._profile, this._runState.ante,
        );
        this.setPhase(MetaPhase.Shop);
        globalBus.emit(META_EVENTS.SHOP_ENTERED, { shopState: this._shopState });

        return this._shopState;
    }

    /** 离开杂货铺，进入对局 */
    leaveShop(): void {
        this.setPhase(MetaPhase.MapSelect);
    }

    // ─── 雀鸟栏管理 ──────────────────────────────────────────

    /** 查看雀鸟栏 (按优先级排序) */
    viewInventory(): void {
        this.setPhase(MetaPhase.Inventory);
    }

    /** 获取当前雀鸟 (按优先级排序) */
    getSortedSparrows(): typeof this._runState extends null ? never : typeof this._runState {
        if (!this._runState) return [] as any;
        return [...this._runState.sparrows].sort((a, b) => a.priority - b.priority) as any;
    }

    // ─── 对局结算 ────────────────────────────────────────────

    /** 小局结算 */
    endRound(success: boolean, score: number, pattern?: HandPattern): {
        nextPhase: MetaPhase;
        runContinues: boolean;
    } {
        if (!this._runState) throw new Error('No active run');

        // 更新图鉴
        if (pattern) {
            const updated = CollectionCodex.updateHighestPattern(this._profile, pattern, score);
            if (updated) {
                globalBus.emit(META_EVENTS.SPARROW_DISCOVERED, { pattern, score });
            }
        }

        // 记录本轮发现的雀鸟
        for (const sparrow of this._runState.sparrows) {
            const isNew = CollectionCodex.discoverSparrow(this._profile, sparrow.id);
            if (isNew) {
                globalBus.emit(META_EVENTS.SPARROW_DISCOVERED, { sparrowId: sparrow.id });
            }
        }

        globalBus.emit(META_EVENTS.ROUND_ENDED, { success, score, pattern });

        if (!success) {
            // 失败 → GameOver
            this.endRun(false);
            return { nextPhase: MetaPhase.GameOver, runContinues: false };
        }

        // 成功 → 进入下一重
        this._runState.clearedStages++;
        this._runState.ante++;

        if (this._runState.ante > MAX_ANTE) {
            // 通关
            this.endRun(true);
            return { nextPhase: MetaPhase.Victory, runContinues: false };
        }

        // 继续 → 商店
        this.enterShop();
        return { nextPhase: MetaPhase.Shop, runContinues: true };
    }

    /** 运行结束 (统一处理经验/星尘/存档) */
    private endRun(victory: boolean): void {
        if (!this._runState) return;

        // 计算经验
        const exp = BASE_RUN_EXP
            + this._runState.clearedStages * PER_STAGE_EXP
            + (victory ? VICTORY_BONUS_EXP : 0);

        // 计算星尘
        const stardust = this._runState.clearedStages * PER_STAGE_STARDUST
            + (victory ? VICTORY_BONUS_STARDUST : 0);

        this._runState.earnedExp = exp;
        this._runState.earnedStarDust = stardust;

        // 更新 Profile
        this._profile.starDust += stardust;
        const levelResult = MetaProgressionManager.addExp(this._profile, exp);

        if (levelResult.leveledUp) {
            globalBus.emit(META_EVENTS.LEVEL_UP, { newLevel: levelResult.newLevel });
        }
        if (levelResult.rarityUnlocked) {
            globalBus.emit(META_EVENTS.RARITY_UNLOCKED, { rarity: this._profile.unlockedRarity });
        }

        // 保存
        PersistenceManager.saveProfile(this._profile);

        const endPhase = victory ? MetaPhase.Victory : MetaPhase.GameOver;
        this.setPhase(endPhase);
        globalBus.emit(META_EVENTS.RUN_ENDED, {
            victory,
            earnedExp: exp,
            earnedStarDust: stardust,
            clearedStages: this._runState.clearedStages,
        });
    }

    /** 返回主菜单 */
    returnToMenu(): void {
        this._runState = null;
        this._shopState = null;
        this._rng = null;
        this.setPhase(MetaPhase.MainMenu);
    }

    // ─── 永久天赋 ────────────────────────────────────────────

    /** 升级天赋 */
    upgradeTalent(talentType: PermanentTalentType): { success: boolean; reason?: string } {
        const result = MetaProgressionManager.upgradeTalent(this._profile, talentType);
        if (result.success) {
            PersistenceManager.saveProfile(this._profile);
            globalBus.emit(META_EVENTS.TALENT_UPGRADED, { talentType });
        }
        return result;
    }

    // ─── 图鉴 ────────────────────────────────────────────────

    /** 获取图鉴概要 */
    getCodexSummary() {
        return CollectionCodex.getCodexSummary(this._profile, this.registry.getTotal());
    }
}

// ═══════════════════════════════════════════════════════════
//  内联测试
// ═══════════════════════════════════════════════════════════

export function runGameFlowControllerTests(): void {
    console.log('══════ GameFlowController 测试 ══════\n');

    // 先清理 localStorage
    PersistenceManager.resetProfile();

    const ctrl = new GameFlowController();

    // 测试 1: 初始阶段
    console.log('测试 1: 初始阶段');
    console.log('  phase:', ctrl.phase);
    console.log('  通过:', ctrl.phase === MetaPhase.MainMenu, '\n');

    // 测试 2: 开启新征程
    const run = ctrl.startNewRun(42);
    console.log('测试 2: 开启新征程');
    console.log('  phase:', ctrl.phase);
    console.log('  money:', run.money);
    console.log('  ante:', run.ante);
    console.log('  通过:', ctrl.phase === MetaPhase.Shop && run.ante === 1, '\n');

    // 测试 3: 商店生成
    const shop = ctrl.shopState;
    console.log('测试 3: 杂货铺');
    console.log('  商品数:', shop?.items.length);
    console.log('  通过:', (shop?.items.length ?? 0) > 0, '\n');

    // 测试 4: 离开商店
    ctrl.leaveShop();
    console.log('测试 4: 离开商店');
    console.log('  phase:', ctrl.phase);
    console.log('  通过:', ctrl.phase === MetaPhase.MapSelect, '\n');

    // 测试 5: 小局胜利 → 进入下一重商店
    const result5 = ctrl.endRound(true, 500, HandPattern.PingHu);
    console.log('测试 5: 小局胜利');
    console.log('  nextPhase:', result5.nextPhase);
    console.log('  runContinues:', result5.runContinues);
    console.log('  ante:', ctrl.runState?.ante);
    console.log('  通过:', result5.runContinues && ctrl.runState?.ante === 2, '\n');

    // 测试 6: 小局失败 → GameOver
    const ctrl2 = new GameFlowController();
    ctrl2.startNewRun(99);
    ctrl2.leaveShop();
    const result6 = ctrl2.endRound(false, 100);
    console.log('测试 6: 小局失败');
    console.log('  nextPhase:', result6.nextPhase);
    console.log('  runContinues:', result6.runContinues);
    console.log('  通过:', !result6.runContinues && result6.nextPhase === MetaPhase.GameOver, '\n');

    // 测试 7: 结算后经验和星尘
    const profile = ctrl2.profile;
    console.log('测试 7: 结算奖励');
    console.log('  totalExp:', profile.totalExp, '(期望 > 0)');
    console.log('  starDust:', profile.starDust, '(期望 >= 0)');
    console.log('  totalRuns:', profile.totalRuns);
    console.log('  通过:', profile.totalExp > 0 && profile.totalRuns > 0, '\n');

    // 测试 8: 返回主菜单
    ctrl2.returnToMenu();
    console.log('测试 8: 返回主菜单');
    console.log('  phase:', ctrl2.phase);
    console.log('  runState:', ctrl2.runState);
    console.log('  通过:', ctrl2.phase === MetaPhase.MainMenu && ctrl2.runState === null, '\n');

    // 测试 9: 语言切换
    ctrl2.switchLanguage(Language.EN);
    console.log('测试 9: 语言切换');
    console.log('  language:', ctrl2.profile.language);
    console.log('  通过:', ctrl2.profile.language === Language.EN, '\n');

    // 测试 10: 图鉴
    const codex = ctrl.getCodexSummary();
    console.log('测试 10: 图鉴概要');
    console.log('  totalSparrows:', codex.totalSparrows);
    console.log('  patternsAchieved:', codex.patternsAchieved);
    console.log('  通过:', codex.totalSparrows > 0, '\n');

    // 清理
    PersistenceManager.resetProfile();
}
