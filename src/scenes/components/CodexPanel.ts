import * as Phaser from 'phaser';
import type { GameFlowController } from '../../meta/GameFlowController';

export class CodexPanel extends Phaser.GameObjects.Container {
    private flowController: GameFlowController;

    constructor(scene: Phaser.Scene, x: number, y: number, flowController: GameFlowController) {
        super(scene, x, y);
        this.flowController = flowController;
        this.createUI();
    }

    private createUI() {
        const width = 800;
        const height = 500;

        // 背景版
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x222222, 0.95);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, 16);
        bg.lineStyle(4, 0xffd700, 1);
        bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 16);

        // 标题
        const title = this.scene.add.text(0, -height / 2 + 40, '收藏图鉴', {
            fontFamily: '"Noto Sans SC", sans-serif',
            fontSize: '36px',
            color: '#ffd700',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // 进度
        const sum = this.flowController.getCodexSummary();
        const progress = this.scene.add.text(0, -height / 2 + 90,
            `已发现雀鸟: ${sum.discoveredCount} / ${sum.totalSparrows}  (${Math.round(sum.completionRate * 100)}%)\n已解锁牌型: ${sum.patternsAchieved}`, {
            fontFamily: '"Noto Sans SC", sans-serif',
            fontSize: '20px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);

        // 关闭按钮
        const closeBtn = this.scene.add.text(width / 2 - 40, -height / 2 + 40, '✖', {
            fontFamily: 'Arial', fontSize: '30px', color: '#ff3333'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => this.emit('close'));

        this.add([bg, title, progress, closeBtn]);

        // 图册内容 (简易展示: 遍历所有雀鸟, 发现显示彩色, 未发现显示暗色)
        const sparrows = this.flowController.registry.getAllSparrows();
        const startX = -width / 2 + 80;
        const startY = -height / 2 + 150;
        const cols = 5;

        sparrows.forEach((sparrow, idx) => {
            const isDiscovered = this.flowController.profile.discoveredSparrows.includes(sparrow.id);
            const x = startX + (idx % cols) * 160;
            const y = startY + Math.floor(idx / cols) * 80;

            const iconBg = this.scene.add.graphics();
            iconBg.fillStyle(isDiscovered ? 0x4caf50 : 0x555555, 1);
            iconBg.fillRoundedRect(x - 60, y - 30, 120, 60, 8);

            const nameText = this.scene.add.text(x, y, isDiscovered ? sparrow.name : '???', {
                fontFamily: '"Noto Sans SC", sans-serif',
                fontSize: '18px',
                color: isDiscovered ? '#ffffff' : '#aaaaaa',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            this.add([iconBg, nameText]);

            // 简单的 Tooltip 交互
            if (isDiscovered) {
                const zone = this.scene.add.zone(x, y, 120, 60).setInteractive();
                zone.on('pointerover', () => nameText.setText(sparrow.value.toString())); // 简易显示数值
                zone.on('pointerout', () => nameText.setText(sparrow.name));
                this.add(zone);
            }
        });

        // 拦截点击事件以防止穿透
        const interceptor = this.scene.add.zone(0, 0, width, height).setInteractive();
        this.add(interceptor);
        this.sendToBack(interceptor);
    }
}
