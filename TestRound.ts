import { RoundManager } from './src/core/RoundManager.js';
import { KongType, MetaPhase, MeldType } from './src/types/enums.js';
import { globalBus } from './src/utils/EventBus.js';

/**
 * 测试完整的对局管理器流程
 */
function runTestRound() {
    console.log('--- 开始测试 RoundManager 完整单局循环 ---');

    const rm = new RoundManager();

    // 监听事件
    globalBus.on('round:started', (data: any) => console.log('\n🌟 [事件] round:started', data));
    globalBus.on('gameState:changed', (state: any) => console.log(`🔄 [事件] gameState:changed (手牌=${state.hand.length}, 次数=${state.submitCount}/${state.maxSubmitCount})`));
    globalBus.on('round:completedHand', (data: any) => console.log(`🎯 [事件] round:completedHand (完成一手, 番种=${data.result.pattern}, 得分=${data.result.totalScore})`));
    globalBus.on('round:victory', (data: any) => console.log(`✅ [事件] round:victory (过关! 总分=${data.score})`));
    globalBus.on('round:defeat', (data: any) => console.log(`❌ [事件] round:defeat (失败! 总分=${data.score})`));

    // 1. 初始化
    rm.startRound({
        targetScore: 200,
        maxSubmitCount: 7,
        maxDiscardCount: 3,
        maxDiscardTiles: 5,
        initialHandSize: 8
    }, 12345);

    let state = rm.getGameState();
    console.log(`\n[初始状态] 目标分: ${state.targetScore}, 提交次数: ${state.maxSubmitCount}, 手牌: ${state.hand.length}`);

    // 2. 第一次操作：换牌 (Discard)
    console.log('\n[玩家操作] 决定废弃前 3 张手牌 (Discard)');
    const discardIds = state.hand.slice(0, 3).map(t => t.id);
    const discardRes = rm.discardTiles(discardIds);
    console.log(`  -> 换牌结果: `, discardRes);

    state = rm.getGameState();
    console.log(`  -> 剩余换牌次数: ${state.maxDiscardCount - state.discardCount}`);

    // 3. 第二次操作：提交一组明杠
    console.log('\n[玩家操作] 决定提交一个 【杠牌】');
    // 假装前4张是同一个牌拼成的杠
    const kongTiles = state.hand.slice(0, 4);
    const kongRes = rm.submitGroup(kongTiles.map(t => t.id), 'kong', KongType.LightKong);
    console.log(`  -> 杠牌提交结果: `, kongRes);
    state = rm.getGameState();
    console.log(`  -> 提交后结算槽面子位容量: ${state.submissionPile.settlementMeldSlots.length}`);

    // 4. 继续提交剩下的面子和雀头
    // 提交 3 个面子 (容量仅剩3)
    console.log('\n[玩家操作] 连续提交 3 个面子...');
    for (let i = 0; i < 3; i++) {
        const meldTiles = state.hand.slice(0, 3);
        rm.submitGroup(meldTiles.map(t => t.id), 'meld');
        state = rm.getGameState();
    }
    console.log(`  -> 面子填满情况: ${state.submissionPile.settlementMeldSlots.filter(s => s.filled).length} / 3`);

    // 提交雀头 (此时触发结算)
    console.log('\n[玩家操作] 提交 1 个雀头对子');
    const pairTiles = state.hand.slice(0, 2);
    rm.submitGroup(pairTiles.map(t => t.id), 'pair');

    // 此时应当触发了 event!
    state = rm.getGameState();
    console.log(`\n[一手结束] 累计分数: ${state.cumulativeScore} / ${state.targetScore}`);
    if ((state.phase as any) === MetaPhase.Shop) {
        console.log('✅ 测试结论：胜利流转正常！');
    } else {
        console.log('❌ 测试结论：状态不对', state.phase);
    }
}

runTestRound();
