/**
 *  《雀神牌》符咒管理器
 *
 *  职责:
 *   - 执行符咒使用逻辑 (点金符/琉璃符/镜像符/净化符/延寿符)
 *   - 校验使用条件 (目标牌选择、次数)
 *   - 返回使用结果供 UI 层展示
 *
 *  纯逻辑层 —— 不引用任何 Phaser 代码
 */

import { TalismanEffectType, TileAttribute, TalismanCategory } from '../types/enums';
import type { ITalisman, ITalismanUseContext, ITalismanUseResult, ITile } from '../types/interfaces';
import { DeckManager } from '../core/DeckManager';
import { RNG } from '../utils/RNG';

let _talismanUid = 0;

export class TalismanManager {

    /**
     * 使用一张符咒。
     * 成功后自动扣减 uses; uses 归零后由调用方移除。
     */
    useTalisman(talisman: ITalisman, ctx: ITalismanUseContext): ITalismanUseResult {
        if (talisman.uses <= 0) {
            return { success: false, affectedTiles: [], message: '符咒次数已用尽' };
        }

        let result: ITalismanUseResult;

        switch (talisman.effectType) {
            case TalismanEffectType.ChangeAttribute:
                result = this.applyChangeAttribute(talisman, ctx);
                break;
            case TalismanEffectType.CopyTile:
                result = this.applyCopyTile(talisman, ctx);
                break;
            case TalismanEffectType.RemoveFromDeck:
                result = this.applyRemoveFromDeck(talisman, ctx);
                break;
            case TalismanEffectType.AddSubmit:
                result = this.applyAddSubmit(talisman, ctx);
                break;
            default:
                result = { success: false, affectedTiles: [], message: `未实现的符咒效果: ${talisman.effectType}` };
        }

        if (result.success) {
            talisman.uses--;
        }
        return result;
    }

    // ─── 点金符 / 琉璃符 (ChangeAttribute) ─────────────────

    private applyChangeAttribute(talisman: ITalisman, ctx: ITalismanUseContext): ITalismanUseResult {
        if (ctx.targetTileIds.length === 0) {
            return { success: false, affectedTiles: [], message: '请选择一张手牌' };
        }

        const targetId = ctx.targetTileIds[0];
        const tile = ctx.hand.find(t => t.id === targetId);
        if (!tile) {
            return { success: false, affectedTiles: [], message: '目标牌不在手牌中' };
        }

        // value 映射属性: 1 = Gold (点金符), 2 = Glass (琉璃符)
        const attrMap: Record<number, TileAttribute> = {
            1: TileAttribute.Gold,
            2: TileAttribute.Glass,
        };
        const newAttr = attrMap[talisman.value] ?? TileAttribute.Gold;
        const oldAttr = tile.attribute;
        tile.attribute = newAttr;

        const attrNames: Record<string, string> = {
            gold: '点金',
            glass: '琉璃',
        };
        return {
            success: true,
            affectedTiles: [tile],
            message: `将 ${tile.suit}${tile.rank} 的属性从 ${oldAttr} 变为 ${attrNames[newAttr] || newAttr}`,
        };
    }

    // ─── 镜像符 (CopyTile) ─────────────────────────────────

    private applyCopyTile(_talisman: ITalisman, ctx: ITalismanUseContext): ITalismanUseResult {
        if (ctx.targetTileIds.length === 0) {
            return { success: false, affectedTiles: [], message: '请选择一张要复制的手牌' };
        }

        const targetId = ctx.targetTileIds[0];
        const original = ctx.hand.find(t => t.id === targetId);
        if (!original) {
            return { success: false, affectedTiles: [], message: '目标牌不在手牌中' };
        }

        // 深拷贝 + 标记为符咒生成
        const copy: ITile = {
            ...original,
            id: `talisman_gen_${++_talismanUid}`,
            isGeneratedByTalisman: true,
        };
        ctx.hand.push(copy);

        return {
            success: true,
            affectedTiles: [copy],
            message: `复制了 ${original.suit}${original.rank}，新牌已加入手牌 (标记为符咒生成)`,
        };
    }

    // ─── 净化符 (RemoveFromDeck) ───────────────────────────

    private applyRemoveFromDeck(_talisman: ITalisman, ctx: ITalismanUseContext): ITalismanUseResult {
        if (ctx.targetTileIds.length === 0) {
            return { success: false, affectedTiles: [], message: '请选择要移除的牌 (最多 3 张)' };
        }

        // 限制最多 3 张
        const ids = ctx.targetTileIds.slice(0, 3);
        const removed = ctx.deckManager.removeTiles(ids);

        if (removed.length === 0) {
            return { success: false, affectedTiles: [], message: '牌库中未找到指定的牌' };
        }

        return {
            success: true,
            affectedTiles: removed,
            message: `从牌库中永久移除了 ${removed.length} 张牌`,
        };
    }

    // ─── 延寿符 (AddSubmit) ────────────────────────────────

    private applyAddSubmit(_talisman: ITalisman, ctx: ITalismanUseContext): ITalismanUseResult {
        ctx.roundConfig.maxSubmitCount += 1;
        return {
            success: true,
            affectedTiles: [],
            message: `提交次数上限 +1 (当前: ${ctx.roundConfig.maxSubmitCount})`,
        };
    }
}

// ═══════════════════════════════════════════════════════════
//  内联测试
// ═══════════════════════════════════════════════════════════

import { TileSuit, TileRank } from '../types/enums';
import type { IRoundConfig } from '../types/interfaces';

function createTestTile(suit: TileSuit, rank: TileRank, id?: string): ITile {
    return {
        id: id || `test_${++_talismanUid}`,
        suit,
        rank,
        attribute: TileAttribute.Normal,
        isWildcard: false,
        isGeneratedByTalisman: false,
    };
}

function createTestTalisman(
    effectType: TalismanEffectType,
    category: TalismanCategory,
    value: number = 1,
    uses: number = 1,
): ITalisman {
    return {
        id: `test_tal_${++_talismanUid}`,
        name: '测试符咒',
        description: '测试用',
        category,
        effectType,
        value,
        uses,
    };
}

export function runTalismanManagerTests(): void {
    console.log('══════ TalismanManager 测试 ══════\n');

    const mgr = new TalismanManager();

    // ─── 测试 1: 点金符 — 修改属性为 Gold ───
    {
        const tile = createTestTile(TileSuit.Wan, TileRank.Five, 'gold_target');
        const hand = [tile];
        const talisman = createTestTalisman(TalismanEffectType.ChangeAttribute, TalismanCategory.Talisman, 1);
        const ctx: ITalismanUseContext = {
            hand,
            deckManager: new DeckManager(1),
            targetTileIds: ['gold_target'],
            roundConfig: { targetScore: 100, maxSubmitCount: 3, maxDiscardCount: 3, maxDiscardTiles: 3, initialHandSize: 8 },
            rng: new RNG(1),
        };
        const result = mgr.useTalisman(talisman, ctx);
        console.log('测试 1: 点金符');
        console.log('  属性:', tile.attribute);
        console.log('  uses:', talisman.uses);
        console.log('  通过:', result.success && tile.attribute === TileAttribute.Gold && talisman.uses === 0, '\n');
    }

    // ─── 测试 2: 琉璃符 — 修改属性为 Glass ───
    {
        const tile = createTestTile(TileSuit.Tiao, TileRank.Three, 'glass_target');
        const hand = [tile];
        const talisman = createTestTalisman(TalismanEffectType.ChangeAttribute, TalismanCategory.Talisman, 2);
        const ctx: ITalismanUseContext = {
            hand,
            deckManager: new DeckManager(2),
            targetTileIds: ['glass_target'],
            roundConfig: { targetScore: 100, maxSubmitCount: 3, maxDiscardCount: 3, maxDiscardTiles: 3, initialHandSize: 8 },
            rng: new RNG(2),
        };
        const result = mgr.useTalisman(talisman, ctx);
        console.log('测试 2: 琉璃符');
        console.log('  属性:', tile.attribute);
        console.log('  通过:', result.success && tile.attribute === TileAttribute.Glass, '\n');
    }

    // ─── 测试 3: 镜像符 — 复制牌 ───
    {
        const tile = createTestTile(TileSuit.Wan, TileRank.Five, 'copy_target');
        const hand = [tile];
        const talisman = createTestTalisman(TalismanEffectType.CopyTile, TalismanCategory.Spirit);
        const ctx: ITalismanUseContext = {
            hand,
            deckManager: new DeckManager(3),
            targetTileIds: ['copy_target'],
            roundConfig: { targetScore: 100, maxSubmitCount: 3, maxDiscardCount: 3, maxDiscardTiles: 3, initialHandSize: 8 },
            rng: new RNG(3),
        };
        const result = mgr.useTalisman(talisman, ctx);
        const newTile = result.affectedTiles[0];
        console.log('测试 3: 镜像符');
        console.log('  手牌数:', hand.length);
        console.log('  新牌 isGeneratedByTalisman:', newTile?.isGeneratedByTalisman);
        console.log('  花色/点数:', newTile?.suit, newTile?.rank);
        console.log('  通过:', result.success
            && hand.length === 2
            && newTile?.isGeneratedByTalisman === true
            && newTile?.suit === TileSuit.Wan
            && newTile?.rank === TileRank.Five, '\n');
    }

    // ─── 测试 4: 净化符 — 从牌库移除牌 ───
    {
        const dm = new DeckManager(42);
        const deckBefore = dm.getRemaining();
        // 取出前 3 张牌的 ID 作为移除目标
        const deck = dm.getDeck();
        const idsToRemove = [deck[0].id, deck[1].id, deck[2].id];
        const talisman = createTestTalisman(TalismanEffectType.RemoveFromDeck, TalismanCategory.Spirit);
        const ctx: ITalismanUseContext = {
            hand: [],
            deckManager: dm,
            targetTileIds: idsToRemove,
            roundConfig: { targetScore: 100, maxSubmitCount: 3, maxDiscardCount: 3, maxDiscardTiles: 3, initialHandSize: 8 },
            rng: new RNG(42),
        };
        const result = mgr.useTalisman(talisman, ctx);
        console.log('测试 4: 净化符');
        console.log('  移除前:', deckBefore, '  移除后:', dm.getRemaining());
        console.log('  移除数:', result.affectedTiles.length);
        console.log('  通过:', result.success
            && dm.getRemaining() === deckBefore - 3
            && result.affectedTiles.length === 3, '\n');
    }

    // ─── 测试 5: 延寿符 — +1 提交次数 ───
    {
        const roundConfig: IRoundConfig = {
            targetScore: 100, maxSubmitCount: 3, maxDiscardCount: 3, maxDiscardTiles: 3, initialHandSize: 8,
        };
        const talisman = createTestTalisman(TalismanEffectType.AddSubmit, TalismanCategory.Seal);
        const ctx: ITalismanUseContext = {
            hand: [],
            deckManager: new DeckManager(5),
            targetTileIds: [],
            roundConfig,
            rng: new RNG(5),
        };
        const result = mgr.useTalisman(talisman, ctx);
        console.log('测试 5: 延寿符');
        console.log('  maxSubmitCount:', roundConfig.maxSubmitCount);
        console.log('  通过:', result.success && roundConfig.maxSubmitCount === 4, '\n');
    }

    // ─── 测试 6: 边界 — 不存在的目标牌 ───
    {
        const tile = createTestTile(TileSuit.Wan, TileRank.One, 'real_tile');
        const hand = [tile];
        const talisman = createTestTalisman(TalismanEffectType.ChangeAttribute, TalismanCategory.Talisman, 1);
        const ctx: ITalismanUseContext = {
            hand,
            deckManager: new DeckManager(6),
            targetTileIds: ['nonexistent_id'],
            roundConfig: { targetScore: 100, maxSubmitCount: 3, maxDiscardCount: 3, maxDiscardTiles: 3, initialHandSize: 8 },
            rng: new RNG(6),
        };
        const result = mgr.useTalisman(talisman, ctx);
        console.log('测试 6: 不存在的目标牌');
        console.log('  success:', result.success);
        console.log('  uses 未扣减:', talisman.uses === 1);
        console.log('  通过:', !result.success && talisman.uses === 1, '\n');
    }
}
