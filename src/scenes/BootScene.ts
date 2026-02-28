import * as Phaser from 'phaser';
import { GameFlowController } from '../meta/GameFlowController';

export class BootScene extends Phaser.Scene {
    private flowController!: GameFlowController;

    constructor() {
        super({ key: 'BootScene' });
    }

    init() {
        this.flowController = this.registry.get('flowController');
    }

    preload() {
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(340, 320, 600, 50);

        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const loadingText = this.make.text({
            x: width / 2,
            y: height / 2 - 50,
            text: '加载中...',
            style: { fontFamily: '"Noto Sans SC", sans-serif', fontSize: '24px', color: '#ffffff' }
        }).setOrigin(0.5);

        const percentText = this.make.text({
            x: width / 2,
            y: height / 2 - 5,
            text: '0%',
            style: { fontFamily: '"Noto Sans SC", sans-serif', fontSize: '18px', color: '#ffffff' }
        }).setOrigin(0.5);

        this.load.on('progress', (value: number) => {
            percentText.setText(parseInt((value * 100).toString()) + '%');
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(350, 330, 580 * value, 30);
        });

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            percentText.destroy();

            // 跳转到 MainMenuScene 并传递单例
            this.scene.start('MainMenuScene', { flowController: this.flowController });
        });

        for (let i = 0; i < 50; i++) {
            this.load.image(`dummy_${i}`, 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
        }
    }
}
