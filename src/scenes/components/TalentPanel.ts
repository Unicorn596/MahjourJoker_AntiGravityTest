import * as Phaser from 'phaser';
import type { GameFlowController } from '../../meta/GameFlowController';
import { PermanentTalentType } from '../../types/enums';
import { MetaProgressionManager } from '../../meta/MetaProgressionManager';

export class TalentPanel extends Phaser.GameObjects.Container {
    private flowController: GameFlowController;
    private stardustText!: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, x: number, y: number, flowController: GameFlowController) {
        super(scene, x, y);
        this.flowController = flowController;
        this.createUI();
    }

    private createUI() {
        const width = 800;
        const height = 500;

        // 背景版使用九宫格
        const bg = this.scene.add.nineslice(0, 0, 'panel_bg', undefined, width, height, 24, 24, 24, 24);
        bg.setTint(0x3a2a45);

        const title = this.scene.add.text(0, -height / 2 + 40, '永久天赋', {
            fontFamily: '"Noto Sans SC", sans-serif',
            fontSize: '36px',
            color: '#9c27b0',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.stardustText = this.scene.add.text(0, -height / 2 + 90, `拥有星尘: ✨ ${this.flowController.profile.starDust}`, {
            fontFamily: '"Noto Sans SC", sans-serif',
            fontSize: '24px',
            color: '#ffd700'
        }).setOrigin(0.5);

        const closeBtn = this.scene.add.text(width / 2 - 40, -height / 2 + 40, '✖', {
            fontFamily: 'Arial', fontSize: '30px', color: '#ff3333'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => this.emit('close'));

        this.add([bg, title, this.stardustText, closeBtn]);

        // 渲染天赋列表
        const startX = -width / 2 + 200;
        let startY = -height / 2 + 180;

        const talentNames: Record<string, string> = {
            [PermanentTalentType.InitialMoney]: '初始带资 (+1 资金/级)',
            [PermanentTalentType.MaxDiscard]: '弃牌大师 (+1 弃牌上限/级)',
            [PermanentTalentType.MaxSparrowSlots]: '群鸟之主 (+1 雀鸟栏位/级)',
            [PermanentTalentType.ShopDiscount]: '贵宾金卡 (-5% 商店折/级)',
        };

        for (const t of this.flowController.profile.talents) {
            this.createTalentRow(startX, startY, t, talentNames[t.type]);
            startY += 80;
        }

        const interceptor = this.scene.add.zone(0, 0, width, height).setInteractive();
        this.add(interceptor);
        this.sendToBack(interceptor);
    }

    private createTalentRow(x: number, y: number, talent: any, name: string) {
        const info = MetaProgressionManager.getTalentInfo(talent);

        const nameText = this.scene.add.text(x - 150, y, `${name}`, {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '20px', color: '#ffffff'
        }).setOrigin(0, 0.5);

        const levelText = this.scene.add.text(x + 150, y, `Lv. ${talent.level} / ${talent.maxLevel}`, {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '20px', color: '#aaaaaa'
        }).setOrigin(0.5);

        const btnBg = this.scene.add.graphics();
        const btnColor = info.isMaxed ? 0x555555 : (this.flowController.profile.starDust >= (info.nextCost || 0) ? 0x4caf50 : 0x777777);
        btnBg.fillStyle(btnColor, 1);
        btnBg.fillRoundedRect(x + 250, y - 20, 100, 40, 5);

        const btnTxt = this.scene.add.text(x + 300, y, info.isMaxed ? '已满级' : `升级: ✨${info.nextCost}`, {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '18px', color: '#ffffff'
        }).setOrigin(0.5);

        this.add([nameText, levelText, btnBg, btnTxt]);

        if (!info.isMaxed) {
            const zone = this.scene.add.zone(x + 300, y, 100, 40).setInteractive({ useHandCursor: true });
            zone.on('pointerdown', () => {
                const res = this.flowController.upgradeTalent(talent.type);
                if (res.success) {
                    // 重新渲染面板
                    this.removeAll(true);
                    this.createUI();
                } else {
                    // 抖动提示失败
                    this.scene.tweens.add({ targets: this, x: this.x + 10, yoyo: true, duration: 50, repeat: 3 });
                }
            });
            this.add(zone);
        }
    }
}
