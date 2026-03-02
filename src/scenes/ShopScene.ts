import * as Phaser from 'phaser';
import type { GameFlowController } from '../meta/GameFlowController';
import type { IShopItem, IShopState } from '../types/interfaces';
import { PackType } from '../types/enums';
import { SceneTransition } from '../utils/SceneTransition';

export class ShopScene extends Phaser.Scene {
    private flowController!: GameFlowController;
    private moneyText!: Phaser.GameObjects.Text;
    private shopState!: IShopState;
    private itemsContainer!: Phaser.GameObjects.Container;
    private itemZones: Phaser.GameObjects.Zone[] = [];
    private refreshBtnText!: Phaser.GameObjects.Text;

    // 取消 Tooltip 系统，改为 Modal
    // 鼠标点击弹出详细说明面板

    constructor() {
        super({ key: 'ShopScene' });
    }

    init() {
        this.flowController = this.registry.get('flowController');
        // 尝试进入商店阶段 (如果上一步不是这里的话)
        this.shopState = this.flowController.enterShop();
    }

    create() {
        SceneTransition.fadeIn(this);

        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.cameras.main.setBackgroundColor('#2c3e50');

        // 标题与重数
        this.add.text(width / 2, 60, `杂货铺 (重数: ${this.flowController.runState!.ante})`, {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '48px', color: '#ffd700', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.moneyText = this.add.text(width / 2, 120, `当前资金: 💰 ${this.flowController.runState!.money}`, {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '28px', color: '#eeeeee'
        }).setOrigin(0.5);

        this.itemsContainer = this.add.container(0, 0);

        this.createShopItems();

        // ==== 刷新按钮 ====
        const refreshBg = this.add.graphics();
        refreshBg.fillStyle(0xff9800, 1);
        refreshBg.fillRoundedRect(-75, -25, 150, 50, 8);

        this.refreshBtnText = this.add.text(0, 0, `刷新 (💰${this.shopState.refreshCost})`, {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        const refreshContainer = this.add.container(width / 2 + 425, 115, [refreshBg, this.refreshBtnText]);

        // 直接在场景层加 Zone，避开复杂的嵌套拾取问题
        const refreshZone = this.add.zone(width / 2 + 425, 115, 150, 50).setInteractive({ useHandCursor: true });
        refreshZone.on('pointerdown', () => {
            this.tweens.add({ targets: refreshContainer, scale: 0.9, duration: 50, yoyo: true });
            this.onRefreshClicked();
        });

        // ==== 离开商店 (下一关) ====
        const nextBtnBg = this.add.graphics();
        nextBtnBg.fillStyle(0x4caf50, 1);
        nextBtnBg.fillRoundedRect(-100, -30, 200, 60, 10);

        const nextTxt = this.add.text(0, 0, '进入对局', {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '24px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        const nextBtnContainer = this.add.container(width / 2, height - 70, [nextBtnBg, nextTxt]);

        const nextBtnZone = this.add.zone(width / 2, height - 70, 200, 60).setInteractive({ useHandCursor: true });
        nextBtnZone.on('pointerdown', () => {
            this.tweens.add({ targets: nextBtnContainer, scale: 0.9, duration: 50, yoyo: true });
            SceneTransition.fadeTo(this, 'GameScene');
        });
    }

    private onBuyClicked(shopItem: IShopItem) {
        if (shopItem.type === 'sparrow' || shopItem.type === 'talisman') { // FIXME: controller 暂时未细分护身符买法，目前先共用或通过逻辑拦截
            const res = this.flowController.shopManager.buySparrow(this.shopState, shopItem.id, this.flowController.runState!, this.flowController.profile);

            // FIXME (扩展): 如果是符咒需要单独买，这里为了演示目前统称雀鸟口子或者需要在 manager 里写明买哪种，这里假定由于时间关系走 buySparrow 扩展
            if (res.success || shopItem.type === 'talisman' /* dummy bypass for compile/run */) {
                if (shopItem.type === 'talisman' && shopItem.item) {
                    // 手动走资金逻辑 (临时)
                    if (this.flowController.runState!.money >= shopItem.cost) {
                        this.flowController.runState!.money -= shopItem.cost;
                        this.flowController.runState!.talismans.push(shopItem.item as any);
                        shopItem.sold = true;
                    } else {
                        this.toast('资金不足'); return;
                    }
                }

                this.updateMoneyUI();
                this.createShopItems(); // 重新渲染状态
            } else {
                this.toast(res.reason || '购买失败');
            }
        } else if (shopItem.type === 'pack') {
            const rng: any = (this.flowController as any).rng;
            const res = this.flowController.shopManager.buyPack(this.shopState, shopItem.id, this.flowController.runState!, rng, this.flowController.profile);
            if (res.success && res.candidates) {
                this.updateMoneyUI();
                this.createShopItems();
                this.showPackChoicePanel(res.candidates, res.packType as PackType);
            } else {
                this.toast(res.reason || '资金不足');
            }
        }
    }

    private onRefreshClicked() {
        const rng: any = (this.flowController as any).rng;
        const res = this.flowController.shopManager.refreshShop(this.shopState, this.flowController.runState!, rng, this.flowController.profile);
        if (res.success) {
            this.updateMoneyUI();
            this.createShopItems();
            this.refreshBtnText.setText(`刷新 (💰${this.shopState.refreshCost})`);
        } else {
            this.toast(res.reason || '刷新失败');
        }
    }

    private updateMoneyUI() {
        this.moneyText.setText(`当前资金: 💰 ${this.flowController.runState!.money}`);
    }

    private toast(msg: string) {
        const txt = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, msg, {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '32px', color: '#ff3333', stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);

        this.tweens.add({ targets: txt, y: txt.y - 100, alpha: 0, duration: 1500, onComplete: () => txt.destroy() });
    }
    private showItemDetailModal(_shopItem: IShopItem, titleText: string, descText: string, shortDesc: string) {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const blocker = this.add.zone(width / 2, height / 2, width, height).setInteractive();
        const bg = this.add.graphics().fillStyle(0x000000, 0.8).fillRect(0, 0, width, height);
        const container = this.add.container(0, 0, [blocker, bg]).setDepth(200);

        const panel = this.add.nineslice(width / 2, height / 2, 'panel_bg', undefined, 500, 400, 24, 24, 24, 24);
        panel.setTint(0x222233);

        const title = this.add.text(width / 2, height / 2 - 130, titleText, {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '36px', color: '#ffeb3b', fontStyle: 'bold'
        }).setOrigin(0.5);

        const subTag = this.add.text(width / 2, height / 2 - 80, shortDesc, {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '22px', color: '#aaaaaa'
        }).setOrigin(0.5);

        const desc = this.add.text(width / 2, height / 2 + 20, descText, {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '24px', color: '#ffffff', wordWrap: { width: 440 }, align: 'center', lineSpacing: 12
        }).setOrigin(0.5);

        // 关闭按键
        const closeBtnBg = this.add.nineslice(width / 2, height / 2 + 150, 'panel_bg', undefined, 140, 50, 16, 16, 16, 16).setTint(0x4caf50);
        const closeTxt = this.add.text(width / 2, height / 2 + 150, '关 闭', {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '24px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        const closeZone = this.add.zone(width / 2, height / 2 + 150, 140, 50).setInteractive({ useHandCursor: true });
        closeZone.on('pointerdown', () => {
            this.tweens.add({
                targets: container,
                scale: 0.8,
                alpha: 0,
                duration: 150,
                onComplete: () => container.destroy()
            });
        });

        container.add([panel, title, subTag, desc, closeBtnBg, closeTxt, closeZone]);

        // 出场演出
        container.setScale(0.8);
        container.setAlpha(0);
        this.tweens.add({ targets: container, scale: 1, alpha: 1, duration: 250, ease: 'Back.easeOut' });
    }

    private createShopItems() {
        this.itemsContainer.removeAll(true);
        this.itemZones.forEach(z => z.destroy());
        this.itemZones = [];
        const width = this.cameras.main.width;
        const startY = 320;

        const spacing = 220;
        const startX = width / 2 - ((this.shopState.items.length - 1) * spacing) / 2;

        this.shopState.items.forEach((shopItem, index) => {
            const x = startX + index * spacing;
            const container = this.add.container(x, startY);

            // 卡牌背景使用九宫格
            const bg = this.add.nineslice(0, -20, 'panel_bg', undefined, 200, 300, 24, 24, 24, 24);
            bg.setTint(0x222233);

            // 边框色彩：雀鸟蓝色，符咒黄色，卡包紫色
            let borderColorHex = 0x2196f3;
            let titleText = '未知';
            let descText = ''; // 仅供 Tooltip 使用的完整描述
            let shortDesc = ''; // 卡牌表面显示的简短分类文字

            if (shopItem.type === 'sparrow' && shopItem.item) {
                borderColorHex = 0x2196f3;
                titleText = shopItem.item.name;
                descText = shopItem.item.description;
                shortDesc = '【灵雀】';
            } else if (shopItem.type === 'talisman' && shopItem.item) {
                borderColorHex = 0xffeb3b;
                titleText = shopItem.item.name;
                descText = shopItem.item.description + `\n(剩余: ${(shopItem.item as any).uses}次)`;
                shortDesc = '【符箓】';
            } else if (shopItem.type === 'pack') {
                borderColorHex = 0x9c27b0;
                titleText = shopItem.packType === PackType.SparrowPack ? '雀鸟包' : '符咒包';
                descText = '购买后立即打开，在三个随机选项中保留一个。';
                shortDesc = '【补充包】';
            }

            // 动态加上发光边框效果
            const highlightRect = this.add.graphics();
            highlightRect.lineStyle(4, borderColorHex, 0.8);
            highlightRect.strokeRoundedRect(-96, -166, 192, 292, 20);

            const title = this.add.text(0, -110, titleText, {
                fontFamily: '"Noto Sans SC", sans-serif', fontSize: '24px', color: '#ffffff', fontStyle: 'bold'
            }).setOrigin(0.5);

            const descTag = this.add.text(0, -70, shortDesc, {
                fontFamily: '"Noto Sans SC", sans-serif', fontSize: '18px', color: '#aaaaaa'
            }).setOrigin(0.5);

            // 占位图标，未来可替换真图
            let icon: Phaser.GameObjects.GameObject;
            if (shopItem.type === 'sparrow') {
                const sp = this.add.sprite(0, -10, 'sparrows', 0); // 暂定第0帧为通用, 后续可依据 ID 提取
                sp.setScale(0.35); // 原图大概 320x320，缩放到适合 200x300 的框内
                icon = sp;
            } else if (shopItem.type === 'talisman') {
                const sp = this.add.sprite(0, -10, 'talismans', 0);
                sp.setScale(0.35);
                icon = sp;
            } else if (shopItem.type === 'pack') {
                const sp = this.add.image(0, -10, 'packs');
                sp.setScale(0.2);
                icon = sp;
            } else {
                const gr = this.add.graphics();
                gr.fillStyle(borderColorHex, 0.5);
                gr.fillCircle(0, -10, 40);
                icon = gr;
            }

            const price = this.add.text(0, 60, `💰 ${shopItem.cost}`, {
                fontFamily: '"Noto Sans SC", sans-serif', fontSize: '26px', color: '#ffd700', fontStyle: 'bold'
            }).setOrigin(0.5);

            // 购买状态按钮
            const statusBg = this.add.nineslice(0, 0, 'panel_bg', undefined, 120, 46, 16, 16, 16, 16);
            statusBg.setTint(shopItem.sold ? 0x555555 : 0x4caf50);

            const statusText = this.add.text(0, 0, shopItem.sold ? '已售空' : '购 买', {
                fontFamily: '"Noto Sans SC", sans-serif', fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
            }).setOrigin(0.5);

            const buyContainer = this.add.container(0, 110, [statusBg, statusText]);

            container.add([bg, highlightRect, title, descTag, icon, price, buyContainer]);
            this.itemsContainer.add(container);

            if (!shopItem.sold) {
                // 卡牌悬停展示和点击查看详情交互
                const cardZone = this.add.zone(x, startY - 30, 200, 240).setInteractive({ useHandCursor: true });
                cardZone.on('pointerover', () => {
                    this.tweens.add({ targets: container, y: startY - 15, duration: 150, ease: 'Back.easeOut' });
                });
                cardZone.on('pointerout', () => {
                    this.tweens.add({ targets: container, y: startY, duration: 150, ease: 'Back.easeIn' });
                });
                cardZone.on('pointerdown', () => {
                    this.showItemDetailModal(shopItem, titleText, descText, shortDesc);
                });
                this.itemZones.push(cardZone);

                // 在绝对坐标创建购买按钮交互区
                const absY = startY + 110;
                const buyZone = this.add.zone(x, absY, 120, 46).setInteractive({ useHandCursor: true });
                buyZone.on('pointerdown', () => {
                    this.tweens.add({ targets: buyContainer, scale: 0.9, duration: 100, yoyo: true });
                    this.onBuyClicked(shopItem);
                });
                this.itemZones.push(buyZone);
            }
        });
    }

    private showPackChoicePanel(candidates: any[], packType: PackType) {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const blocker = this.add.zone(width / 2, height / 2, width, height).setInteractive();
        const bg = this.add.graphics().fillStyle(0x000000, 0).fillRect(0, 0, width, height);
        this.tweens.add({ targets: bg, alpha: 0.9, duration: 500 }); // fade in bg

        const container = this.add.container(0, 0, [blocker, bg]);

        // 中央卡包视觉 (使用真实的 packs 贴图, 裁齐并分为左右或利用 tint)
        const packContainer = this.add.container(width / 2, height / 2);

        // 临时直接加载刚才裁好的 packs 整图, 如果整图包含左右两个包，这里做一下裁减或者放一整张
        const packBg = this.add.image(0, -20, 'packs');
        // 假设 packs 图是 640x640 的并列双包，按比例缩小展示:
        packBg.setScale(0.5);

        // 为了配合分类加光晕
        const glowColor = packType === PackType.SparrowPack ? 0x9c27b0 : 0xffeb3b;
        const glow = this.add.graphics();
        glow.lineStyle(8, glowColor, 0.6);
        glow.strokeRoundedRect(-150, -170, 300, 340, 20);

        const packText = this.add.text(0, -90, packType === PackType.SparrowPack ? '灵雀包' : '符箓包', {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '36px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 6
        }).setOrigin(0.5);

        const clickPrompt = this.add.text(0, 160, '← 点击开启 →', {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '24px', color: '#ffeb3b', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.tweens.add({ targets: clickPrompt, scale: 1.1, alpha: 0.5, duration: 600, yoyo: true, repeat: -1 });

        packContainer.add([packBg, packText, clickPrompt]);
        container.add(packContainer);

        const packZone = this.add.zone(0, 0, 170, 240).setInteractive({ useHandCursor: true });
        packContainer.add(packZone);

        packZone.once('pointerdown', () => {
            clickPrompt.destroy();
            packZone.destroy(); // 只能点一次

            // 震动特效
            this.tweens.add({
                targets: packContainer,
                x: packContainer.x + 15,
                angle: 15,
                yoyo: true,
                duration: 60,
                repeat: 5,
                onComplete: () => {
                    // 爆裂闪光
                    const flash = this.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 1).setDepth(200);
                    this.tweens.add({ targets: flash, alpha: 0, duration: 600, onComplete: () => flash.destroy() });

                    packContainer.destroy();
                    this.revealCards(candidates, packType, container);
                }
            });
        });
    }

    private revealCards(candidates: any[], packType: PackType, mainContainer: Phaser.GameObjects.Container) {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const spacing = 280;
        const startX = width / 2 - ((candidates.length - 1) * spacing) / 2;

        const title = this.add.text(width / 2, height / 4, '请选择一项奖励', {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '40px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5).setAlpha(0);
        mainContainer.add(title);
        this.tweens.add({ targets: title, alpha: 1, duration: 500, delay: 600 });

        candidates.forEach((cand, idx) => {
            const targetX = startX + idx * spacing;
            const targetY = height / 2 + 40;

            const cardContainer = this.add.container(width / 2, height / 2);
            cardContainer.setScale(0);

            // 卡牌背面
            const cardBack = this.add.nineslice(0, 0, 'panel_bg', undefined, 200, 300, 24, 24, 24, 24);
            cardBack.setTint(0x1a1a24);
            const backMark = this.add.text(0, 0, '?', { fontFamily: '"Noto Sans SC", sans-serif', fontSize: '64px', color: '#555' }).setOrigin(0.5);

            // 卡牌正面 (默认隐藏)
            const frontContainer = this.add.container(0, 0).setVisible(false);
            const cardBg = this.add.nineslice(0, 0, 'panel_bg', undefined, 200, 300, 24, 24, 24, 24);
            cardBg.setTint(0x222233);
            const hlColor = packType === PackType.SparrowPack ? 0x2196f3 : 0xffeb3b;
            const hl = this.add.graphics().lineStyle(4, hlColor, 0.8).strokeRoundedRect(-96, -146, 192, 292, 20);

            const typeTag = this.add.text(0, -110, packType === PackType.SparrowPack ? '【灵雀】' : '【符箓】', { fontFamily: '"Noto Sans SC", sans-serif', fontSize: '16px', color: '#aaa' }).setOrigin(0.5);
            const name = this.add.text(0, -75, cand.name, { fontFamily: '"Noto Sans SC", sans-serif', fontSize: '26px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
            const desc = this.add.text(0, 0, cand.description, { fontFamily: '"Noto Sans SC", sans-serif', fontSize: '18px', color: '#ccc', wordWrap: { width: 170 }, align: 'center' }).setOrigin(0.5);

            const btnBg = this.add.nineslice(0, 100, 'panel_bg', undefined, 120, 46, 16, 16, 16, 16).setTint(0x4caf50);
            const btnTxt = this.add.text(0, 100, '选 择', { fontFamily: '"Noto Sans SC", sans-serif', fontSize: '20px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
            const btnContainer = this.add.container(0, 0, [btnBg, btnTxt]);

            frontContainer.add([cardBg, hl, typeTag, name, desc, btnContainer]);
            cardContainer.add([cardBack, backMark, frontContainer]);
            mainContainer.add(cardContainer);

            // 动画序列: 飞出 -> 翻转背面消失 -> 正面出现
            this.tweens.add({
                targets: cardContainer,
                x: targetX,
                y: targetY,
                scale: 1,
                duration: 600,
                ease: 'Back.easeOut',
                delay: idx * 200, // 依次飞出
                onComplete: () => {
                    // 开始翻转
                    this.tweens.add({
                        targets: cardContainer,
                        scaleX: 0,
                        duration: 150,
                        onComplete: () => {
                            cardBack.setVisible(false);
                            backMark.setVisible(false);
                            frontContainer.setVisible(true);
                            this.tweens.add({
                                targets: cardContainer,
                                scaleX: 1,
                                duration: 250,
                                ease: 'Back.easeOut',
                                onComplete: () => {
                                    // 翻转完成后添加交互
                                    const selectZone = this.add.zone(targetX, targetY + 100, 120, 46).setInteractive({ useHandCursor: true });
                                    selectZone.on('pointerdown', () => {
                                        this.tweens.add({ targets: btnContainer, scale: 0.9, duration: 100, yoyo: true });
                                        this.handlePackChoice(cand, packType, mainContainer);
                                    });
                                    mainContainer.add(selectZone);

                                    // 卡牌浮动 Hover
                                    const cardZone = this.add.zone(targetX, targetY - 20, 200, 220).setInteractive();
                                    cardZone.on('pointerover', () => this.tweens.add({ targets: cardContainer, y: targetY - 15, duration: 150, ease: 'Power1' }));
                                    cardZone.on('pointerout', () => this.tweens.add({ targets: cardContainer, y: targetY, duration: 150, ease: 'Power1' }));
                                    mainContainer.add(cardZone);
                                }
                            });
                        }
                    });
                }
            });
        });
    }

    private handlePackChoice(cand: any, packType: PackType, mainContainer: Phaser.GameObjects.Container) {
        if (packType === PackType.SparrowPack) {
            const max = this.flowController.shopManager.getMaxSparrows(this.flowController.profile);
            if (this.flowController.runState!.sparrows.length < max) {
                this.flowController.runState!.sparrows.push(cand);
            } else {
                this.toast('雀鸟栏已满，卡包奖励丢失');
            }
        } else {
            this.flowController.runState!.talismans.push(cand);
        }

        this.tweens.add({
            targets: mainContainer,
            alpha: 0,
            duration: 300,
            onComplete: () => {
                mainContainer.destroy();
            }
        });
    }
}
