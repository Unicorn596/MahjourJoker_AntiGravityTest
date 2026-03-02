import * as Phaser from 'phaser';
import { GameFlowController } from '../meta/GameFlowController';
import { SceneTransition } from '../utils/SceneTransition';

export class BootScene extends Phaser.Scene {
    private flowController!: GameFlowController;

    constructor() {
        super({ key: 'BootScene' });
    }

    init() {
        this.flowController = this.registry.get('flowController');
    }

    preload() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRoundedRect(width / 2 - 300, height / 2 + 30, 600, 30, 15);

        const loadingText = this.make.text({
            x: width / 2,
            y: height / 2 - 20,
            text: '加载中...',
            style: { fontFamily: '"Noto Sans SC", sans-serif', fontSize: '28px', color: '#ffffff', fontStyle: 'bold' }
        }).setOrigin(0.5);

        this.tweens.add({
            targets: loadingText,
            alpha: 0.3,
            scale: 1.05,
            yoyo: true,
            repeat: -1,
            duration: 800
        });

        const percentText = this.make.text({
            x: width / 2,
            y: height / 2 + 45,
            text: '0%',
            style: { fontFamily: '"Noto Sans SC", sans-serif', fontSize: '18px', color: '#111111', fontStyle: 'bold' }
        }).setOrigin(0.5);

        this.load.on('progress', (value: number) => {
            percentText.setText(parseInt((value * 100).toString()) + '%');
            progressBar.clear();
            progressBar.fillStyle(0xffd700, 1);
            progressBar.fillRoundedRect(width / 2 - 295, height / 2 + 35, 590 * value, 20, 10);
        });

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            percentText.destroy();

            // 跳转到 MainMenuScene 并传递单例
            SceneTransition.fadeTo(this, 'MainMenuScene', { flowController: this.flowController });
        });

        // 真实资源加载
        this.load.image('tile_bamboo_1', 'assets/images/tile_bamboo_1.png');
        this.load.image('tile_dots_5', 'assets/images/tile_dots_5.png');
        this.load.image('tile_characters_9', 'assets/images/tile_characters_9.png');

        // 造几百个假图片用来模拟长加载时间，不然太快看不见动画
        for (let i = 0; i < 150; i++) {
            this.load.image(`dummy_${i}`, 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
        }

        // 生成九宫格基础贴图
        const panelGraphics = this.make.graphics({ x: 0, y: 0 });
        panelGraphics.fillStyle(0x2a2a35, 0.95);
        panelGraphics.fillRoundedRect(0, 0, 100, 100, 20);
        panelGraphics.lineStyle(4, 0x4a4a5a, 1);
        panelGraphics.strokeRoundedRect(2, 2, 96, 96, 20);
        panelGraphics.generateTexture('panel_bg', 100, 100);
    }
}
