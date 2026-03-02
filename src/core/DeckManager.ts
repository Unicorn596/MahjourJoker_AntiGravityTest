/**
 *  《雀神牌》牌库 & 弃牌堆管理器
 *
 *  功能:
 *   - 生成标准 136 张麻将牌库
 *   - 抽牌 (牌库空时自动洗回弃牌堆)
 *   - 弃牌堆管理
 *   - 剩余牌数查询
 *
 *  纯逻辑层 —— 不引用任何 Phaser 代码
 */

import { TileSuit, TileRank, TileAttribute, DeckMode } from '../types/enums';
import type { ITile } from '../types/interfaces';
import { RNG } from '../utils/RNG';
import { globalBus } from '../utils/EventBus';

export class DeckManager {
    private deck: ITile[] = [];
    private _discardPile: ITile[] = [];
    private rng: RNG;
    private uidCounter = 0;

    constructor(seed: number, mode: DeckMode = DeckMode.Standard) {
        this.rng = new RNG(seed);
        this.deck = this.createDeck(mode);
        this.shuffle();
    }

    /** 洗牌并派发事件 */
    public shuffle(): void {
        this.rng.shuffle(this.deck);
        globalBus.emit('deck:shuffled', { remaining: this.deck.length });
    }

    // ─── 牌库操作 ──────────────────────────────────────────

    /** 从牌库抽 n 张牌。牌库不够时自动将弃牌堆洗回。 */
    draw(n: number): ITile[] {
        const drawn: ITile[] = [];
        for (let i = 0; i < n; i++) {
            if (this.deck.length === 0) {
                this.reshuffleDiscardPile();
            }
            if (this.deck.length === 0) {
                // 牌库和弃牌堆都空了，无牌可抽
                globalBus.emit('deck:empty');
                break;
            }
            drawn.push(this.deck.pop()!);
        }
        if (drawn.length > 0) {
            globalBus.emit('deck:drawn', { drawn, remaining: this.deck.length });
        }
        return drawn;
    }

    /** 将牌放入弃牌堆 */
    discard(tiles: ITile[]): void {
        this._discardPile.push(...tiles);
    }

    /** 将弃牌堆洗回牌库 */
    private reshuffleDiscardPile(): void {
        if (this._discardPile.length === 0) return;
        this.deck.push(...this._discardPile);
        this._discardPile = [];
        this.shuffle();
    }

    // ─── 查询 ──────────────────────────────────────────────

    /** 牌库剩余张数 */
    getRemaining(): number {
        return this.deck.length;
    }



    /** 获取当前弃牌堆内容 (只读备份) */
    getDiscardPile(): readonly ITile[] {
        return this._discardPile;
    }

    /** 获取牌库引用 (供 IGameState 同步) */
    getDeck(): ITile[] {
        return this.deck;
    }

    /** 从弃牌堆中选取指定的牌 (用于贪婪符效果) */
    pickFromDiscardPile(tileIds: string[]): ITile[] {
        const picked: ITile[] = [];
        for (const id of tileIds) {
            const idx = this._discardPile.findIndex(t => t.id === id);
            if (idx !== -1) {
                picked.push(this._discardPile.splice(idx, 1)[0]);
            }
        }
        return picked;
    }

    /** 从牌库中永久移除指定 ID 的牌 (净化符效果) */
    removeTiles(tileIds: string[]): ITile[] {
        const removed: ITile[] = [];
        for (const id of tileIds) {
            const idx = this.deck.findIndex(t => t.id === id);
            if (idx !== -1) {
                removed.push(this.deck.splice(idx, 1)[0]);
            }
        }
        return removed;
    }

    // ─── 牌库生成 ──────────────────────────────────────────

    /** 根据模式生成牌库 */
    private createDeck(mode: DeckMode): ITile[] {
        const tiles: ITile[] = [];

        if (mode === DeckMode.Bamboo) {
            // 纯条子模式: 只有条子和字牌
            this.addSuitTiles(tiles, [TileSuit.Tiao], 1, 9, 4);
            this.addWindTiles(tiles, 4);
            this.addDragonTiles(tiles, 4);
        } else if (mode === DeckMode.Simples) {
            // 断幺九模式: 只有万、条、饼的 2~8
            this.addSuitTiles(tiles, [TileSuit.Wan, TileSuit.Tiao, TileSuit.Bing], 2, 8, 4);
        } else {
            // 标准模式
            this.addSuitTiles(tiles, [TileSuit.Wan, TileSuit.Tiao, TileSuit.Bing], 1, 9, 4);
            this.addWindTiles(tiles, 4);
            this.addDragonTiles(tiles, 4);
        }

        return tiles;
    }

    private addSuitTiles(tiles: ITile[], suits: TileSuit[], minRank: number, maxRank: number, copies: number) {
        for (const suit of suits) {
            for (let rank = minRank; rank <= maxRank; rank++) {
                for (let c = 0; c < copies; c++) {
                    tiles.push(this.createTile(suit, rank as any));
                }
            }
        }
    }

    private addWindTiles(tiles: ITile[], copies: number) {
        const windRanks = [TileRank.East, TileRank.South, TileRank.West, TileRank.North];
        for (const rank of windRanks) {
            for (let c = 0; c < copies; c++) {
                tiles.push(this.createTile(TileSuit.Wind, rank));
            }
        }
    }

    private addDragonTiles(tiles: ITile[], copies: number) {
        const dragonRanks = [TileRank.Zhong, TileRank.Fa, TileRank.Bai];
        for (const rank of dragonRanks) {
            for (let c = 0; c < copies; c++) {
                tiles.push(this.createTile(TileSuit.Dragon, rank));
            }
        }
    }

    private createTile(suit: TileSuit, rank: TileRank): ITile {
        return {
            id: `tile_${++this.uidCounter}`,
            suit,
            rank,
            attribute: TileAttribute.Normal,
            isWildcard: false,
            isGeneratedByTalisman: false,
        };
    }
}

// ═══════════════════════════════════════════════════════════
//  内联测试
// ═══════════════════════════════════════════════════════════

export function runDeckManagerTests(): void {
    console.log('══════ DeckManager 测试 ══════\n');

    const dm = new DeckManager(42);

    // 测试 1: 牌库初始 136 张
    console.log('测试 1: 牌库初始数量');
    console.log('  剩余:', dm.getRemaining());
    console.log('  通过:', dm.getRemaining() === 136, '\n');

    // 测试 2: 抽牌
    const hand = dm.draw(8);
    console.log('测试 2: 抽 8 张');
    console.log('  手牌数量:', hand.length);
    console.log('  剩余:', dm.getRemaining());
    console.log('  通过:', hand.length === 8 && dm.getRemaining() === 128, '\n');

    // 测试 3: 弃牌后洗回
    dm.discard(hand);
    console.log('测试 3: 弃牌堆');
    console.log('  弃牌堆数量:', dm.getDiscardPile().length);
    console.log('  通过:', dm.getDiscardPile().length === 8, '\n');

    // 测试 4: 抽完牌库后自动洗回弃牌堆
    const bigDraw = dm.draw(128); // 抽完剩余
    console.log('测试 4: 抽完后自动洗回');
    console.log('  bigDraw 数量:', bigDraw.length);
    console.log('  剩余:', dm.getRemaining()); // 弃牌堆应洗回
    const afterReshuffle = dm.draw(5);
    console.log('  洗回后再抽:', afterReshuffle.length);
    console.log('  通过:', bigDraw.length === 128 && afterReshuffle.length === 5, '\n');
}
