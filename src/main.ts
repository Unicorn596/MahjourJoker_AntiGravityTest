import * as Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GameScene } from './scenes/GameScene';
import { ShopScene } from './scenes/ShopScene';
import { GameFlowController } from './meta/GameFlowController';
import './style.css';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    backgroundColor: '#1a1a1a',
    scene: [BootScene, MainMenuScene, GameScene, ShopScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    callbacks: {
        preBoot: (game: Phaser.Game) => {
            // 将控制器存入全局 registry 中供所有 Scene 获取
            game.registry.set('flowController', new GameFlowController());
        }
    }
};

const container = document.getElementById('game-container');
if (container) {
    container.innerHTML = '';
}

new Phaser.Game(config);
