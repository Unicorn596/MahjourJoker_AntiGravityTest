import * as Phaser from 'phaser';
import { globalBus } from '../utils/EventBus';

export class HUD extends Phaser.GameObjects.Container {
    private scoreText: Phaser.GameObjects.Text;
    private targetText: Phaser.GameObjects.Text;
    private moneyText: Phaser.GameObjects.Text;
    private deckText: Phaser.GameObjects.Text;
    private discardText: Phaser.GameObjects.Text;

    // 计分板展现
    private multText: Phaser.GameObjects.Text;
    private chipsText: Phaser.GameObjects.Text;
    private patternText: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);

        const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
            fontFamily: '"Noto Sans SC", sans-serif',
            fontSize: '24px',
            color: '#eeeeee'
        };

        const titleStyle: Phaser.Types.GameObjects.Text.TextStyle = {
            ...textStyle,
            fontSize: '20px',
            color: '#aaaaaa'
        };

        // 背景版
        const bg = scene.add.graphics();
        bg.fillStyle(0x222222, 0.9);
        bg.fillRoundedRect(0, 0, 300, 500, 10);
        bg.lineStyle(2, 0x444444, 1);
        bg.strokeRoundedRect(0, 0, 300, 500, 10);
        this.add(bg);

        // 目标分数
        const title1 = scene.add.text(20, 20, '目标得分', titleStyle);
        this.targetText = scene.add.text(20, 45, '0', textStyle);

        // 当前总得分
        const title2 = scene.add.text(20, 90, '当前得分', titleStyle);
        this.scoreText = scene.add.text(20, 115, '0', { ...textStyle, fontSize: '32px', color: '#4caf50' });

        // 行动力提醒
        this.deckText = scene.add.text(20, 175, '牌山剩余: 136', { ...textStyle, fontSize: '20px', color: '#ffca28' });
        this.discardText = scene.add.text(20, 205, '换牌机会: 0', { ...textStyle, fontSize: '20px', color: '#ff7043' });

        // 金币
        const title3 = scene.add.text(20, 250, '金币', titleStyle);
        this.moneyText = scene.add.text(20, 275, '💰 0', { ...textStyle, color: '#ffd700' });

        // 单局计分 (Chips x Mult)
        const title4 = scene.add.text(20, 330, '上次出牌结算', titleStyle);
        this.patternText = scene.add.text(20, 355, '牌型: 无', { ...textStyle, fontSize: '20px', color: '#ab47bc' });
        this.chipsText = scene.add.text(20, 385, '基础分: 0', { ...textStyle, fontSize: '20px', color: '#64b5f6' });
        this.multText = scene.add.text(20, 415, '倍率: x1', { ...textStyle, fontSize: '20px', color: '#e57373' });

        this.add([
            title1, this.targetText,
            title2, this.scoreText,
            this.deckText, this.discardText,
            title3, this.moneyText,
            title4, this.patternText, this.chipsText, this.multText
        ]);

        scene.add.existing(this);

        // 绑定事件更新
        this.setupListeners();
    }

    private setupListeners(): void {
        globalBus.on('gameState:changed', (state: any) => {
            if (state) {
                this.targetText.setText(`${state.targetScore}`);
                this.scoreText.setText(`${state.cumulativeScore}`);

                const remDiscard = state.maxDiscardCount - state.discardCount;
                this.deckText.setText(`牌山剩余: ${state.deckSize}`);
                this.discardText.setText(`换牌机会: ${remDiscard} / ${state.maxDiscardCount}`);

                this.moneyText.setText(`💰 ${state.money}`);
            }
        });

        globalBus.on<{ result: any, currentScore: number }>('round:completedHand', (data) => {
            if (data && data.result) {
                this.animateScore(this.scoreText, data.currentScore);
                this.animateScoreDetail(data.result);
            }
        });
    }

    private animateScore(targetObj: Phaser.GameObjects.Text, newScore: number): void {
        const currentScore = parseInt(targetObj.text) || 0;
        this.scene.tweens.addCounter({
            from: currentScore,
            to: newScore,
            duration: 800,
            ease: 'Power2',
            onUpdate: (tween) => {
                targetObj.setText(Math.floor(tween.getValue() || 0).toString());
            }
        });
    }

    private animateScoreDetail(result: any): void {
        this.patternText.setText(`牌型: ${result.pattern}`);
        this.chipsText.setText(`基础分: ${result.baseChips}`);
        this.multText.setText(`倍率: x${result.baseMult}`);

        // 数字爆点效果
        this.scene.tweens.add({
            targets: [this.chipsText, this.multText],
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 200,
            yoyo: true
        });
    }
}
