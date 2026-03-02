import * as Phaser from 'phaser';
import type { GameFlowController } from '../meta/GameFlowController';
import { CodexPanel } from './components/CodexPanel';
import { TalentPanel } from './components/TalentPanel';
import { SceneTransition } from '../utils/SceneTransition';
import { DeckMode } from '../types/enums';

export class MainMenuScene extends Phaser.Scene {
    private flowController!: GameFlowController;

    constructor() {
        super({ key: 'MainMenuScene' });
    }

    init() {
        this.flowController = this.registry.get('flowController');
    }

    create() {
        SceneTransition.fadeIn(this);

        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.cameras.main.setBackgroundColor('#160f24');

        // ==== 动态背景 (漂浮粒子/图块) ====
        this.createDynamicBackground(width, height);

        // ==== 标题 ====
        const title = this.add.text(width / 2, height / 3, '雀神牌', {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '90px', color: '#ffd700',
            fontStyle: 'bold', stroke: '#ff8c00', strokeThickness: 8,
            shadow: { offsetX: 0, offsetY: 4, color: '#ff8c00', blur: 15, stroke: true, fill: true }
        }).setOrigin(0.5);

        // 呼吸及轻微上下浮动特效
        this.tweens.add({ targets: title, scale: 1.05, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: title, y: title.y - 15, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 200 });

        // ==== 玩家信息 (左上角) ====
        const profile = this.flowController.profile;
        const expReq = 100 * profile.level * (1 + profile.level * 0.5);
        this.add.text(40, 40, `玩家等级: ${profile.level}\n经验值: ${profile.totalExp} / ${expReq}\n✨星尘: ${profile.starDust}`, {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '24px', color: '#eeeeee', lineSpacing: 10
        });

        // ==== 作弊模式: 卡组选择 (右上角) ====
        const cheatBtn = this.add.text(width - 40, 40, '🔧 作弊: 卡组模式', {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '18px', color: '#ff5252', fontStyle: 'bold',
            backgroundColor: '#333333', padding: { x: 10, y: 5 }
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

        cheatBtn.on('pointerover', () => cheatBtn.setBackgroundColor('#555555'));
        cheatBtn.on('pointerout', () => cheatBtn.setBackgroundColor('#333333'));
        cheatBtn.on('pointerdown', () => {
            this.tweens.add({ targets: cheatBtn, scale: 0.9, duration: 50, yoyo: true });
            this.showDeckSelection();
        });

        // ==== 主菜单按钮区域 ====
        const btnY = height / 2 + 50;

        // 开始游戏
        this.createButton(width / 2, btnY, '开始新征程', 0x2196f3, () => {
            this.flowController.startNewRun();
            SceneTransition.fadeTo(this, 'ShopScene', { flowController: this.flowController });
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
                SceneTransition.fadeTo(this, 'MainMenuScene', { flowController: this.flowController }); // 重新加载以刷新星尘显示
            });
        });
    }

    private createButton(x: number, y: number, text: string, color: number, onClick: () => void) {
        // 使用 9-slice 背景
        const bg = this.add.nineslice(0, 0, 'panel_bg', undefined, 200, 60, 24, 24, 24, 24);
        bg.setTint(color);

        const txt = this.add.text(0, 0, text, {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '24px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        const zone = this.add.zone(0, 0, 200, 60).setInteractive({ useHandCursor: true });
        const container = this.add.container(x, y, [bg, txt, zone]);

        zone.on('pointerover', () => {
            this.tweens.add({ targets: container, scale: 1.1, duration: 150, ease: 'Back.easeOut' });
            bg.setTint(0xffffff); // Hover 时变亮
        });

        zone.on('pointerout', () => {
            this.tweens.add({ targets: container, scale: 1, duration: 150, ease: 'Back.easeIn' });
            bg.setTint(color); // 恢复原色
        });

        zone.on('pointerdown', () => {
            this.tweens.add({ targets: container, scale: 0.95, y: container.y + 4, duration: 50, yoyo: true });
            onClick();
        });
    }

    private createDynamicBackground(width: number, height: number) {
        // 创建一些缓慢漂浮的半透明方块/粒子，模拟卡牌和深邃的氛围
        for (let i = 0; i < 20; i++) {
            const size = Phaser.Math.Between(20, 80);
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);

            const p = this.add.graphics();
            p.fillStyle(0x4a3b69, Phaser.Math.FloatBetween(0.1, 0.4));
            p.fillRoundedRect(-size / 2, -size / 2, size, size, 5);
            p.setPosition(x, y);

            // 赋予旋转和漂浮动画
            this.tweens.add({
                targets: p,
                y: y - Phaser.Math.Between(100, 300),
                rotation: Phaser.Math.FloatBetween(-Math.PI, Math.PI),
                alpha: 0,
                duration: Phaser.Math.Between(10000, 20000),
                repeat: -1,
                yoyo: false,
                onRepeat: () => {
                    p.setPosition(Phaser.Math.Between(0, width), height + size);
                    p.setAlpha(Phaser.Math.FloatBetween(0.1, 0.4));
                }
            });
        }
    }

    private showDeckSelection() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const blocker = this.add.zone(width / 2, height / 2, width, height).setInteractive();
        const bg = this.add.graphics().fillStyle(0x000000, 0.8).fillRect(0, 0, width, height);
        const container = this.add.container(0, 0, [blocker, bg]).setDepth(200);

        const panel = this.add.nineslice(width / 2, height / 2, 'panel_bg', undefined, 500, 400, 24, 24, 24, 24);
        panel.setTint(0x222233);

        const title = this.add.text(width / 2, height / 2 - 140, '选择开局特殊牌组', {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '36px', color: '#ffeb3b', fontStyle: 'bold'
        }).setOrigin(0.5);

        container.add([panel, title]);

        const y1 = height / 2 - 40;
        const y2 = height / 2 + 40;
        const y3 = height / 2 + 120;

        // 按钮及回调
        const modes = [
            { id: DeckMode.Standard, name: '标准模式', desc: '136张牌，原汁原味', y: y1 },
            { id: DeckMode.Bamboo, name: '条子专精', desc: '只有条子和字牌', y: y2 },
            { id: DeckMode.Simples, name: '断幺九专精', desc: '去除所有的 1,9 和字牌', y: y3 },
        ];

        modes.forEach(m => {
            const btnBg = this.add.nineslice(width / 2, m.y, 'panel_bg', undefined, 400, 60, 16, 16, 16, 16).setTint(0x4caf50);
            const txt = this.add.text(width / 2 - 180, m.y, m.name, { fontFamily: '"Noto Sans SC", sans-serif', fontSize: '24px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0, 0.5);
            const desc = this.add.text(width / 2 + 180, m.y, m.desc, { fontFamily: '"Noto Sans SC", sans-serif', fontSize: '16px', color: '#cccccc' }).setOrigin(1, 0.5);

            const zone = this.add.zone(width / 2, m.y, 400, 60).setInteractive({ useHandCursor: true });
            zone.on('pointerdown', () => {
                this.flowController.startNewRun(m.id);
                container.destroy();
                SceneTransition.fadeTo(this, 'ShopScene', { flowController: this.flowController });
            });
            zone.on('pointerover', () => btnBg.setTint(0x66bb6a));
            zone.on('pointerout', () => btnBg.setTint(0x4caf50));

            container.add([btnBg, txt, desc, zone]);
        });

        // 取消按键
        const closeZone = this.add.zone(width / 2, height / 2 + 180, 140, 40).setInteractive({ useHandCursor: true });
        const closeTxt = this.add.text(width / 2, height / 2 + 180, '取 消', {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '20px', color: '#aaaaaa'
        }).setOrigin(0.5);

        closeZone.on('pointerdown', () => {
            this.tweens.add({
                targets: container,
                scale: 0.8,
                alpha: 0,
                duration: 150,
                onComplete: () => container.destroy()
            });
        });

        container.add([closeTxt, closeZone]);

        // 出场演出
        container.setScale(0.8);
        container.setAlpha(0);
        this.tweens.add({ targets: container, scale: 1, alpha: 1, duration: 250, ease: 'Back.easeOut' });
    }
}
