import * as Phaser from 'phaser';
import { GameStateManager } from '../core/GameStateManager';
import { SparrowSystem } from '../systems/SparrowSystem';
import { TalismanSystem } from '../systems/TalismanSystem';
import { TileSprite } from '../objects/TileSprite';
import { HUD } from '../objects/HUD';
import { globalBus } from '../utils/EventBus';
import type { GameFlowController } from '../meta/GameFlowController';
import { MetaPhase, HandPattern } from '../types/enums';

export class GameScene extends Phaser.Scene {
    private gameStateManager!: GameStateManager;
    private sparrowSystem!: SparrowSystem;
    private talismanSystem!: TalismanSystem;

    private handSprites: TileSprite[] = [];
    private handContainer!: Phaser.GameObjects.Container;

    private submitBtn!: Phaser.GameObjects.Container;
    private discardBtn!: Phaser.GameObjects.Container;

    private flowController!: GameFlowController;
    private highestPattern: string = '';

    constructor() {
        super({ key: 'GameScene' });
    }

    init() {
        this.flowController = this.registry.get('flowController');
    }

    create() {
        this.cameras.main.setBackgroundColor('#2c3e50');

        // ==== 从 FlowController 同步数据 ====
        const initialSeed = this.flowController.runState?.seed || Date.now();
        this.gameStateManager = new GameStateManager(initialSeed);

        // 传递初始资产和目标分需求 (基于重数)
        this.gameStateManager.addMoney(this.flowController.runState?.money || 0);
        // 如果设计上有目标分随 ante 递增的逻辑，可以在这里强行 override state.targetScore

        this.sparrowSystem = new SparrowSystem();
        this.talismanSystem = new TalismanSystem();

        // 载入已有雀鸟及护身符
        this.flowController.runState?.sparrows.forEach(s => this.sparrowSystem.addSparrow(s));
        this.flowController.runState?.talismans.forEach(t => this.talismanSystem.addTalisman(t));

        this.createUI();
        this.registerEvents();

        this.highestPattern = '';
        this.gameStateManager.startRound();
    }

    private createUI() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        new HUD(this, 30, 30);
        this.handContainer = this.add.container(width / 2, height - 120);

        this.createButtons();
    }

    private createButtons() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const createBtn = (x: number, y: number, text: string, color: number) => {
            const container = this.add.container(x, y);
            const bg = this.add.graphics();
            bg.fillStyle(color, 1);
            bg.fillRoundedRect(-60, -25, 120, 50, 8);

            const txt = this.add.text(0, 0, text, {
                fontFamily: '"Noto Sans SC", sans-serif', fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
            }).setOrigin(0.5);

            container.add([bg, txt]);
            container.setSize(120, 50);
            container.setInteractive({ useHandCursor: true });
            container.on('pointerdown', () => this.tweens.add({ targets: container, scale: 0.9, duration: 50, yoyo: true }));

            return container;
        };

        this.submitBtn = createBtn(width - 100, height - 150, '提 交', 0x4caf50);
        this.discardBtn = createBtn(width - 100, height - 80, '弃 牌', 0xf44336);

        this.submitBtn.on('pointerup', () => this.onSubmitClicked());
        this.discardBtn.on('pointerup', () => this.onDiscardClicked());
    }

    private registerEvents() {
        globalBus.on('game:roundStarted', () => this.renderHand());
        globalBus.on('game:phaseChanged', () => this.renderHand());
        globalBus.on('game:invalidHand', () => {
            this.cameras.main.shake(200, 0.01);
            this.toast('无效的牌型或不符合规则', '#ff3333');
        });
        globalBus.on('game:tilesDiscarded', () => this.renderHand());

        // 捕捉算分事件以记录最高番型
        globalBus.on('game:scoring', (data: any) => {
            if (data.result && data.result.patternConfigs.length > 0) {
                const patternName = data.result.patternConfigs[0].name;
                // 选出单次最高分的那个，或者简单记录最后一次
                this.highestPattern = patternName;
            }
        });

        globalBus.on('game:roundWon', () => this.handleRoundEnd(true));
        globalBus.on('game:gameOver', () => this.handleRoundEnd(false));
    }

    private handleRoundEnd(success: boolean) {
        // 关闭交互
        this.submitBtn.disableInteractive();
        this.discardBtn.disableInteractive();

        const state = this.gameStateManager.getState();
        const score = (state as any).score;

        // 延迟一段时间呈现特效
        this.time.delayedCall(1500, () => {
            // ==== 调用外围系统的结算逻辑 ====
            const result = this.flowController.endRound(
                success,
                score,
                this.highestPattern ? (this.highestPattern as HandPattern) : undefined
            );

            // 如果游戏还在继续 (Shop)，说明没死，把局内获取的金钱同步到 runState
            if (result.nextPhase === MetaPhase.Shop) {
                // 将 GameStateManager 中赚取的金额差分或全量同步回外部系统
                const runState = this.flowController.runState;
                if (runState) {
                    runState.money = (state as any).money;
                }

                this.scene.start('ShopScene');
            } else if (result.nextPhase === MetaPhase.GameOver) {
                // 显示全屏报错
                this.add.rectangle(this.cameras.main.width / 2, this.cameras.main.height / 2,
                    this.cameras.main.width, this.cameras.main.height, 0x000000, 0.8);
                this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, '游戏结束', {
                    fontFamily: '"Noto Sans SC", sans-serif', fontSize: '64px', color: '#ff3333'
                }).setOrigin(0.5);

                this.time.delayedCall(3000, () => {
                    this.scene.start('MainMenuScene');
                });
            } else if (result.nextPhase === MetaPhase.Victory) {
                // 胜利结算 (占位，如果加入了最大通关数)
                this.add.rectangle(this.cameras.main.width / 2, this.cameras.main.height / 2,
                    this.cameras.main.width, this.cameras.main.height, 0xffffff, 0.8);
                this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, '荣誉通关', {
                    fontFamily: '"Noto Sans SC", sans-serif', fontSize: '64px', color: '#ffeb3b', stroke: '#ff9800', strokeThickness: 6
                }).setOrigin(0.5);

                this.time.delayedCall(4000, () => {
                    this.scene.start('MainMenuScene');
                });
            }
        });
    }

    private toast(msg: string, color: string) {
        const txt = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, msg, {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '32px', color: color, stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);
        this.tweens.add({ targets: txt, y: txt.y - 100, alpha: 0, duration: 1500, onComplete: () => txt.destroy() });
    }

    private renderHand() {
        this.handSprites.forEach(s => s.destroy());
        this.handSprites = [];

        const state = this.gameStateManager.getState();
        const tiles = state.hand;
        const sortedTiles = [...tiles].sort((a, b) => {
            if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
            return a.rank - b.rank;
        });

        const startX = -((sortedTiles.length - 1) * 65) / 2;

        sortedTiles.forEach((tile, index) => {
            const x = startX + index * 65;
            const sprite = new TileSprite(this, x, 0, tile);
            sprite.on('pointerdown', () => sprite.setSelected(!sprite.isSelected));
            this.handContainer.add(sprite);
            this.handSprites.push(sprite);
        });
    }

    private onSubmitClicked() {
        const selectedIds = this.handSprites.filter(s => s.isSelected).map(s => s.tileData.id);
        if (selectedIds.length === 0) return;
        this.gameStateManager.submitHand(selectedIds);

        const state = this.gameStateManager.getState();
        const score = (state as any).score;
        const targetScore = (state as any).targetScore;
        if (score >= targetScore) {
            this.gameStateManager.endRound();
        }
    }

    private onDiscardClicked() {
        const selectedIds = this.handSprites.filter(s => s.isSelected).map(s => s.tileData.id);
        if (selectedIds.length === 0) return;
        this.gameStateManager.discardTiles(selectedIds);
    }
}
