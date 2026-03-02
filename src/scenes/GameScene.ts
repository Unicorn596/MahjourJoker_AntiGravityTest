import * as Phaser from 'phaser';
import { RoundManager } from '../core/RoundManager';
import { SparrowSystem } from '../systems/SparrowSystem';
import { TalismanSystem } from '../systems/TalismanSystem';
import { TileSprite } from '../objects/TileSprite';
import { HUD } from '../objects/HUD';
import { globalBus } from '../utils/EventBus';
import type { GameFlowController } from '../meta/GameFlowController';
import { MetaPhase, HandPattern } from '../types/enums';
import { SceneTransition } from '../utils/SceneTransition';

export class GameScene extends Phaser.Scene {
    private roundManager!: RoundManager;
    private sparrowSystem!: SparrowSystem;
    private talismanSystem!: TalismanSystem;

    private handSprites: TileSprite[] = [];
    private pileSprites: TileSprite[] = [];
    private handContainer!: Phaser.GameObjects.Container;
    private pileContainer!: Phaser.GameObjects.Container;

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
        SceneTransition.fadeIn(this);
        this.cameras.main.setBackgroundColor('#2c3e50');

        // ==== 从 FlowController 同步数据 ====
        this.roundManager = new RoundManager();

        this.sparrowSystem = new SparrowSystem();
        this.talismanSystem = new TalismanSystem();

        // 载入已有雀鸟及护身符
        this.flowController.runState?.sparrows.forEach(s => this.sparrowSystem.addSparrow(s));
        this.flowController.runState?.talismans.forEach(t => this.talismanSystem.addTalisman(t));

        this.createUI();
        this.registerEvents();

        this.highestPattern = '';

        // TODO: 从 GameFlowController 或者某配置取 TargetScore, 等等
        const initialSeed = this.flowController.runState?.seed || Date.now();
        const ante = this.flowController.runState?.ante || 1;
        const deckMode = this.flowController.runState?.deckMode; // 提取 deckMode
        this.roundManager.startRound({
            targetScore: 1000 * Math.pow(1.3, ante - 1), // 示例：每重上涨目标分
            maxDiscardCount: 5,  // 弃牌次数默认增加到5
            maxDiscardTiles: 5,
            initialHandSize: 13,
            deckMode: deckMode
        }, initialSeed);
    }

    private createUI() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        new HUD(this, 30, 30);

        // 提交区渲染 (Slot Base)
        const slotBase = this.add.nineslice(width / 2, height / 2 - 40, 'panel_bg', undefined, 600, 160, 24, 24, 24, 24);
        slotBase.setTint(0x223344);
        slotBase.setAlpha(0.8);
        const slotText = this.add.text(width / 2, height / 2 - 90, '出牌区', {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '20px', color: '#667788', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.tweens.add({ targets: slotText, alpha: 0.3, duration: 1500, yoyo: true, repeat: -1 });

        this.pileContainer = this.add.container(width / 2, height / 2 - 40);
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
        globalBus.on('round:started', () => {
            this.renderHand();
            this.renderSubmissionPile();
        });
        globalBus.on('gameState:changed', () => {
            this.renderHand();
            this.renderSubmissionPile();
        });

        // 捕捉算分事件以记录最高番型和播放特写动画
        globalBus.on('round:completedHand', (data: any) => {
            if (data.result && data.result.pattern) {
                const patternName = data.result.pattern;
                this.highestPattern = patternName;
                this.playScoringJuice(data.result.totalScore, patternName);
            }
        });

        globalBus.on('round:victory', () => this.handleRoundEnd(true));
        globalBus.on('round:defeat', (data: any) => this.handleRoundEnd(false, data?.reason));
    }

    private handleRoundEnd(success: boolean, reason?: string) {
        // 关闭交互
        this.submitBtn.disableInteractive();
        this.discardBtn.disableInteractive();

        const state = this.roundManager.getGameState();
        const score = state.cumulativeScore;

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
                    runState.money = state.money || runState.money;
                }

                SceneTransition.fadeTo(this, 'ShopScene');
            } else if (result.nextPhase === MetaPhase.GameOver) {
                // 显示全屏报错
                this.add.rectangle(this.cameras.main.width / 2, this.cameras.main.height / 2,
                    this.cameras.main.width, this.cameras.main.height, 0x000000, 0.8).setDepth(100);
                this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 - 100, '游戏结束', {
                    fontFamily: '"Noto Sans SC", sans-serif', fontSize: '64px', color: '#ff3333'
                }).setOrigin(0.5).setDepth(101);

                if (reason) {
                    this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, reason, {
                        fontFamily: '"Noto Sans SC", sans-serif', fontSize: '24px', color: '#aaaaaa'
                    }).setOrigin(0.5).setDepth(101);
                }

                const btnContainer = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2 + 100).setDepth(101);
                const btnBg = this.add.graphics();
                btnBg.fillStyle(0x334455, 1);
                btnBg.fillRoundedRect(-100, -30, 200, 60, 10);
                const btnText = this.add.text(0, 0, '返回主菜单', {
                    fontFamily: '"Noto Sans SC", sans-serif', fontSize: '24px', color: '#ffffff', fontStyle: 'bold'
                }).setOrigin(0.5);
                btnContainer.add([btnBg, btnText]);
                btnContainer.setSize(200, 60);
                btnContainer.setInteractive({ useHandCursor: true });

                btnContainer.on('pointerover', () => {
                    btnBg.clear();
                    btnBg.fillStyle(0x445566, 1);
                    btnBg.fillRoundedRect(-100, -30, 200, 60, 10);
                });
                btnContainer.on('pointerout', () => {
                    btnBg.clear();
                    btnBg.fillStyle(0x334455, 1);
                    btnBg.fillRoundedRect(-100, -30, 200, 60, 10);
                });
                btnContainer.on('pointerdown', () => {
                    SceneTransition.fadeTo(this, 'MainMenuScene');
                });
            } else if (result.nextPhase === MetaPhase.Victory) {
                // 胜利结算 (占位，如果加入了最大通关数)
                this.add.rectangle(this.cameras.main.width / 2, this.cameras.main.height / 2,
                    this.cameras.main.width, this.cameras.main.height, 0xffffff, 0.8);
                this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, '荣誉通关', {
                    fontFamily: '"Noto Sans SC", sans-serif', fontSize: '64px', color: '#ffeb3b', stroke: '#ff9800', strokeThickness: 6
                }).setOrigin(0.5);

                this.time.delayedCall(4000, () => {
                    SceneTransition.fadeTo(this, 'MainMenuScene');
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

    private playScoringJuice(scoreGained: number, patternName: string) {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // 1. 屏幕震动
        this.cameras.main.shake(200, 0.015);

        // 2. 华丽的跳字表现
        const scoreText = this.add.text(width / 2, height / 2, `+${scoreGained}`, {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '80px', color: '#ffd700',
            stroke: '#ff8c00', strokeThickness: 8, fontStyle: 'bold',
            shadow: { offsetY: 5, color: '#ff8c00', blur: 15, stroke: true, fill: true }
        }).setOrigin(0.5).setAlpha(0).setScale(0.5);

        // 番型印章
        const patternText = this.add.text(width / 2, height / 2 - 80, patternName, {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '40px', color: '#ff5252',
            stroke: '#ffffff', strokeThickness: 4, fontStyle: 'bold'
        }).setOrigin(0.5).setAlpha(0).setScale(2);

        // 考虑到 Phaser 版本兼容性，直接用 chain tweens 后续步骤或者回调实现
        this.tweens.add({
            targets: [scoreText, patternText],
            alpha: 1, scale: 1, duration: 300, ease: 'Back.easeOut',
            onComplete: () => {
                if (scoreGained > 500) {
                    const particles = this.add.particles(width / 2, height / 2, 'panel_bg', {
                        speed: { min: 400, max: 800 }, angle: { min: 0, max: 360 }, scale: { start: 0.1, end: 0 },
                        alpha: { start: 0.8, end: 0 }, blendMode: 'ADD', lifespan: 600, quantity: 20
                    });
                    particles.explode();
                }

                // 悬停上升
                this.tweens.add({
                    targets: [scoreText, patternText],
                    y: '-=100', duration: 1000, ease: 'Sine.easeInOut',
                    onComplete: () => {
                        // 退场
                        this.tweens.add({
                            targets: [scoreText, patternText],
                            alpha: 0, scale: 1.5, duration: 200, ease: 'Power2',
                            onComplete: () => { scoreText.destroy(); patternText.destroy(); }
                        });
                    }
                });
            }
        });
    }

    private renderHand() {
        this.handSprites.forEach(s => s.destroy());
        this.handSprites = [];

        const state = this.roundManager.getGameState();
        const tiles = state.hand;
        const sortedTiles = [...tiles].sort((a, b) => {
            if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
            return a.rank - b.rank;
        });

        const totalTiles = sortedTiles.length;
        // 直线布局参数
        const spacingX = 65; // 卡牌间距
        const startX = -((totalTiles - 1) * spacingX) / 2;

        sortedTiles.forEach((tile, index) => {
            const x = startX + index * spacingX;
            const y = 0;

            const sprite = new TileSprite(this, x, y, tile);

            // 让卡牌保持直立
            sprite.rotation = 0;

            // 这里移除了原本复原旋转的代码，因为本来就没有特殊旋转了
            const originalOnOut = (sprite as any).onOut;
            (sprite as any).onOut = function () {
                originalOnOut.call(this);
            };

            sprite.on('pointerdown', () => sprite.setSelected(!sprite.isSelected));

            // 添加入场动画
            sprite.y += 200;
            sprite.alpha = 0;
            this.tweens.add({
                targets: sprite,
                y: y,
                alpha: 1,
                duration: 400,
                ease: 'Back.easeOut',
                delay: index * 40 // 依次飞入
            });

            this.handContainer.add(sprite);
            this.handSprites.push(sprite);
        });
    }

    private renderSubmissionPile() {
        this.pileSprites.forEach(s => s.destroy());
        this.pileSprites = [];

        const state = this.roundManager.getGameState();
        const pile = state.submissionPile;

        let offsetX = -250;
        const pileY = 0;

        const drawMeld = (meld: any, scale: number = 0.6) => {
            meld.tiles.forEach((t: any) => {
                const sprite = new TileSprite(this, offsetX, pileY, t);
                sprite.setScale(scale);
                this.pileContainer.add(sprite);
                this.pileSprites.push(sprite);
                offsetX += 45 * scale;
            });
            offsetX += 20; // 面子之间的间距
        };

        // 画结算槽
        pile.settlementMeldSlots.forEach(slot => {
            if (slot.filled && slot.meld) {
                drawMeld(slot.meld);
            }
        });

        // 画雀头
        if (pile.pairSlot.filled && pile.pairSlot.meld) {
            drawMeld(pile.pairSlot.meld);
        }

        // 画杠槽 (统一紧连着画)
        pile.kongSlots.forEach(slot => {
            if (slot.filled && slot.meld) {
                drawMeld(slot.meld);
            }
        });
    }

    private onSubmitClicked() {
        const selectedTiles = this.handSprites.filter(s => s.isSelected).map(s => s.tileData);
        if (selectedTiles.length === 0) return;

        const selectedIds = selectedTiles.map(t => t.id);

        let type: 'meld' | 'pair' | 'kong' = 'meld';
        if (selectedTiles.length === 2) type = 'pair';
        else if (selectedTiles.length >= 4) type = 'kong';

        const res = this.roundManager.submitGroup(selectedIds, type);

        if (!res.success) {
            this.toast(res.reason || '提交无效', '#ff3333');
            this.cameras.main.shake(200, 0.01);
        }
    }

    private onDiscardClicked() {
        const selectedIds = this.handSprites.filter(s => s.isSelected).map(s => s.tileData.id);
        if (selectedIds.length === 0) return;

        const res = this.roundManager.discardTiles(selectedIds);
        if (!res.success) {
            this.toast(res.reason || '换牌无效', '#ff3333');
            this.cameras.main.shake(200, 0.01);
        }
    }
}
