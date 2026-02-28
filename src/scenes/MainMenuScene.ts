import * as Phaser from 'phaser';
import type { GameFlowController } from '../meta/GameFlowController';
import { CodexPanel } from './components/CodexPanel';
import { TalentPanel } from './components/TalentPanel';

export class MainMenuScene extends Phaser.Scene {
    private flowController!: GameFlowController;

    constructor() {
        super({ key: 'MainMenuScene' });
    }

    init() {
        this.flowController = this.registry.get('flowController');
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.cameras.main.setBackgroundColor('#1a1025');

        // ==== 标题 ====
        const title = this.add.text(width / 2, height / 3, '雀神牌', {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '80px', color: '#ffd700',
            fontStyle: 'bold', stroke: '#ff8c00', strokeThickness: 6,
            shadow: { offsetX: 0, offsetY: 0, color: '#ff8c00', blur: 20, stroke: true, fill: true }
        }).setOrigin(0.5);

        this.tweens.add({ targets: title, scale: 1.05, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        // ==== 玩家信息 (左上角) ====
        const profile = this.flowController.profile;
        const expReq = 100 * profile.level * (1 + profile.level * 0.5);
        this.add.text(40, 40, `玩家等级: ${profile.level}\n经验值: ${profile.totalExp} / ${expReq}\n✨星尘: ${profile.starDust}`, {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '24px', color: '#eeeeee', lineSpacing: 10
        });

        // ==== 主菜单按钮区域 ====
        const btnY = height / 2 + 50;

        // 开始游戏
        this.createButton(width / 2, btnY, '开始新征程', 0x2196f3, () => {
            this.flowController.startNewRun();
            this.scene.start('ShopScene', { flowController: this.flowController });
        });

        // 收藏图鉴
        this.createButton(width / 2 - 150, btnY + 100, '收藏图鉴', 0x4caf50, () => {
            const panel = new CodexPanel(this, width / 2, height / 2, this.flowController);
            this.add.existing(panel);
            panel.on('close', () => panel.destroy());
        });

        // 永久天赋
        this.createButton(width / 2 + 150, btnY + 100, '永久天赋', 0x9c27b0, () => {
            const panel = new TalentPanel(this, width / 2, height / 2, this.flowController);
            this.add.existing(panel);
            panel.on('close', () => {
                panel.destroy();
                this.scene.restart({ flowController: this.flowController }); // 重新加载以刷新星尘显示
            });
        });
    }

    private createButton(x: number, y: number, text: string, color: number, onClick: () => void) {
        const bg = this.add.graphics();
        bg.fillStyle(color, 1);
        bg.fillRoundedRect(-100, -30, 200, 60, 10);

        const txt = this.add.text(0, 0, text, {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '24px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        const zone = this.add.zone(0, 0, 200, 60).setInteractive({ useHandCursor: true });
        const container = this.add.container(x, y, [bg, txt, zone]);

        zone.on('pointerover', () => this.tweens.add({ targets: container, scale: 1.1, duration: 200 }));
        zone.on('pointerout', () => this.tweens.add({ targets: container, scale: 1, duration: 200 }));
        zone.on('pointerdown', onClick);
    }
}

