import * as Phaser from 'phaser';
import { globalBus } from '../utils/EventBus';
import type { IGameState, IScoreBreakdown } from '../types/interfaces';

export class HUD extends Phaser.GameObjects.Container {
    private scoreText: Phaser.GameObjects.Text;
    private targetText: Phaser.GameObjects.Text;
    private moneyText: Phaser.GameObjects.Text;
    private roundText: Phaser.GameObjects.Text;

    // 计分板展现
    private multText: Phaser.GameObjects.Text;
    private chipsText: Phaser.GameObjects.Text;

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
        bg.fillRoundedRect(0, 0, 300, 400, 10);
        bg.lineStyle(2, 0x444444, 1);
        bg.strokeRoundedRect(0, 0, 300, 400, 10);
        this.add(bg);

        // 回合数
        this.roundText = scene.add.text(20, 20, '回合: 1', { ...textStyle, fontSize: '28px', color: '#ffcc00' });

        // 目标分数
        scene.add.text(20, 70, '目标得分', titleStyle);
        this.targetText = scene.add.text(20, 95, '0', textStyle);

        // 当前总得分
        scene.add.text(20, 140, '当前得分', titleStyle);
        this.scoreText = scene.add.text(20, 165, '0', { ...textStyle, fontSize: '32px', color: '#4caf50' });

        // 金币
        scene.add.text(20, 220, '金币', titleStyle);
        this.moneyText = scene.add.text(20, 245, '💰 0', { ...textStyle, color: '#ffd700' });

        // 单局计分 (Chips x Mult)
        scene.add.text(20, 300, '上次出牌', titleStyle);
        this.chipsText = scene.add.text(20, 325, '基础分: 0', { ...textStyle, fontSize: '20px', color: '#64b5f6' });
        this.multText = scene.add.text(20, 355, '倍率: x1', { ...textStyle, fontSize: '20px', color: '#e57373' });

        this.add([this.roundText, this.targetText, this.scoreText, this.moneyText, this.chipsText, this.multText]);

        scene.add.existing(this);

        // 绑定事件更新
        this.setupListeners();
    }

    private setupListeners(): void {
        globalBus.on<{ round: number, targetScore: number }>('game:roundStarted', (data) => {
            if (data) {
                this.roundText.setText(`回合: ${data.round}`);
                this.targetText.setText(`${data.targetScore}`);
                this.scoreText.setText('0');
                this.resetTurnScore();
            }
        });

        globalBus.on<{ score: number, breakdown: IScoreBreakdown }>('game:scored', (data) => {
            if (data) {
                this.animateScore(this.scoreText, data.score);
                this.animateScoreDetail(data.breakdown);
            }
        });

        globalBus.on<{ current: number, delta: number }>('game:moneyChanged', (data) => {
            if (data) {
                this.moneyText.setText(`💰 ${data.current}`);
                // 可外加数字弹跳动画
                this.scene.tweens.add({
                    targets: this.moneyText,
                    y: this.moneyText.y - 10,
                    yoyo: true,
                    duration: 150
                });
            }
        });
    }

    private resetTurnScore(): void {
        this.chipsText.setText('基础分: 0');
        this.multText.setText('倍率: x1');
    }

    private animateScore(targetObj: Phaser.GameObjects.Text, newScore: number): void {
        const currentScore = parseInt(targetObj.text) || 0;
        this.scene.tweens.addCounter({
            from: currentScore,
            to: newScore,
            duration: 800,
            ease: 'Power2',
            onUpdate: (tween) => {
                targetObj.setText(Math.floor(tween.getValue()).toString());
            }
        });
    }

    private animateScoreDetail(breakdown: IScoreBreakdown): void {
        this.chipsText.setText(`基础分: ${breakdown.finalChips}`);
        this.multText.setText(`倍率: x${breakdown.finalMult}`);

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
