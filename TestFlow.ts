import { DeckManager } from './src/core/DeckManager.js';
import { SubmissionPile } from './src/core/SubmissionPile.js';
import { TileSuit, TileRank, MeldType, KongType } from './src/types/enums.js';
import type { ITile, IMeld } from './src/types/interfaces.js';

/**
 * 这是一个简化的测试流程脚本，用来验证 GDD v2 中描述的核心单局循环:
 *  - 抽 8 张
 *  - 提交一个面子 (剩余手牌5)
 *  - 补齐到 8 张
 *  - 提交一个杠 (面子槽减1, 剩余手牌4)
 *  - 满槽判定
 */
function runTestFlow() {
    console.log('--- 开始测试单局循环 (GDD v2 提交制) ---');

    // 1. 初始化
    const deckManager = new DeckManager(12345);
    const pile = new SubmissionPile();

    let hand: ITile[] = [];
    let submitCount = 7; // 本局可提交次数
    let targetScore = 300;
    let currentScore = 0;

    console.log(`[初始化] 牌库剩余: ${deckManager.getRemaining()} 张`);
    console.log(`[初始化] 提交次数: ${submitCount}, 目标分: ${targetScore}`);

    // 2. 初始抽牌
    hand = deckManager.draw(8);
    console.log(`\n[回合开始] 抽取 8 张手牌, 当前手牌数: ${hand.length}`);
    console.log(`[牌库状态] 剩余: ${deckManager.getRemaining()}`);

    // 3. 模拟玩家操作 1：提交一个明杠
    console.log('\n[玩家操作] 决定提交一个 【杠牌】进杠槽');
    // 我们手动构造一个杠 (这在真实游戏中是由手牌选出来的)
    const kongMeld: IMeld = {
        type: MeldType.Gangzi,
        tiles: hand.splice(0, 4), // 假装前4张是相同的
        wildcardCount: 0
    };

    const kongSuccess = pile.submitToKong(kongMeld, KongType.LightKong);
    submitCount--;
    console.log(`  -> 提交杠牌: 成功=${kongSuccess} (消耗 1 次提交)`);

    const state1 = pile.getState();
    console.log(`  -> 杠槽状态: 已用=${state1.kongCount}/4`);
    console.log(`  -> 结算槽面子位被自动排挤，现在只剩 ${state1.settlementMeldSlots.length} 个空位`);
    console.log(`  -> 当前手牌数: ${hand.length}`);

    // 补齐手牌
    const draw1 = deckManager.draw(8 - hand.length);
    hand.push(...draw1);
    console.log(`[系统补牌] 抽取 ${draw1.length} 张，手牌补齐至 ${hand.length} 张`);


    // 4. 模拟玩家操作 2, 3, 4：提交剩下的 3 个面子 (因为其中1个被杠挤掉了，只需要3个)
    console.log('\n[玩家操作] 连续提交 3 个顺子/刻子到结算槽...');
    for (let i = 0; i < 3; i++) {
        const meld: IMeld = {
            type: MeldType.Shunzi,
            tiles: hand.splice(0, 3), // 随便拿3张
            wildcardCount: 0
        };
        const ok = pile.submitToSettlement(meld);
        submitCount--;
        console.log(`  -> 提交面子${i + 1}: 成功=${ok}`);

        // 每次提交完理论上也要补牌
        const d = deckManager.draw(8 - hand.length);
        hand.push(...d);
    }

    const state2 = pile.getState();
    const meldsFilled = state2.settlementMeldSlots.filter(s => s.filled).length;
    console.log(`  -> 结算槽状态: 已填面子位=${meldsFilled}/${state2.settlementMeldSlots.length}`);


    // 5. 模拟玩家操作 5：提交 1 个雀头
    console.log('\n[玩家操作] 提交最后 1 个雀头对子');
    const pairMeld: IMeld = {
        type: MeldType.Pair,
        tiles: hand.splice(0, 2),
        wildcardCount: 0
    };
    const pairOk = pile.submitToSettlement(pairMeld);
    submitCount--;
    console.log(`  -> 提交雀头: 成功=${pairOk} (剩余总提交次数: ${submitCount})`);

    // 6. 自动胡牌判定
    console.log('\n[系统判定] 检查提交堆是否已满 (isComplete)');
    const isDone = pile.isComplete();
    console.log(`  -> isComplete(): ${isDone}`);

    if (isDone) {
        console.log('\n🎉 【触发胡牌结算】 —— 假设 HandEvaluator 返回了 500 分!');
        currentScore += 500;
        pile.clear();
        console.log('  -> 提交堆已清空');
    }

    // 7. 胜负结算
    console.log(`\n[单局结束] 累计总分: ${currentScore} / 目标: ${targetScore}`);
    if (currentScore >= targetScore) {
        console.log('✅ 结果：【胜利】 过关！');
    } else {
        console.log('❌ 结果：【失败】 分数未达标！');
    }
}

runTestFlow();
