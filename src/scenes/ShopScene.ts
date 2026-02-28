import * as Phaser from 'phaser';
import type { GameFlowController } from '../meta/GameFlowController';
import type { IShopItem, IShopState } from '../types/interfaces';
import { PackType } from '../types/enums';

export class ShopScene extends Phaser.Scene {
    private flowController!: GameFlowController;
    private moneyText!: Phaser.GameObjects.Text;
    private shopState!: IShopState;
    private itemsContainer!: Phaser.GameObjects.Container;
    private itemZones: Phaser.GameObjects.Zone[] = [];
    private refreshBtnText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'ShopScene' });
    }

    init() {
        this.flowController = this.registry.get('flowController');
        // 尝试进入商店阶段 (如果上一步不是这里的话)
        this.shopState = this.flowController.enterShop();
    }

    create() {
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
            this.scene.start('GameScene');
        });
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

            // 卡牌背景
            const bg = this.add.graphics();
            bg.fillStyle(0x333333, 1);
            bg.fillRoundedRect(-100, -150, 200, 300, 15);

            // 边框色彩：雀鸟蓝色，符咒黄色，卡包紫色
            let borderColor = 0x2196f3;
            let titleText = '未知';
            let descText = '';

            if (shopItem.type === 'sparrow' && shopItem.item) {
                borderColor = 0x2196f3;
                titleText = shopItem.item.name;
                descText = shopItem.item.description;
            } else if (shopItem.type === 'talisman' && shopItem.item) {
                borderColor = 0xffeb3b;
                titleText = shopItem.item.name;
                descText = shopItem.item.description + `\n(剩余: ${(shopItem.item as any).uses}次)`;
            } else if (shopItem.type === 'pack') {
                borderColor = 0x9c27b0;
                titleText = shopItem.packType === PackType.SparrowPack ? '雀鸟包' : '符咒包';
                descText = '购买后打开\n三选一';
            }

            bg.lineStyle(4, borderColor, 1);
            bg.strokeRoundedRect(-100, -150, 200, 300, 15);

            const title = this.add.text(0, -110, titleText, {
                fontFamily: '"Noto Sans SC", sans-serif', fontSize: '24px', color: '#ffffff', fontStyle: 'bold'
            }).setOrigin(0.5);

            const desc = this.add.text(0, -30, descText, {
                fontFamily: '"Noto Sans SC", sans-serif', fontSize: '16px', color: '#aaaaaa', align: 'center', wordWrap: { width: 180 }
            }).setOrigin(0.5);

            const price = this.add.text(0, 60, `💰 ${shopItem.cost}`, {
                fontFamily: '"Noto Sans SC", sans-serif', fontSize: '22px', color: '#ffd700'
            }).setOrigin(0.5);

            // 购买状态
            const statusBg = this.add.graphics();
            statusBg.fillStyle(shopItem.sold ? 0x777777 : 0x4caf50, 1);
            statusBg.fillRoundedRect(-50, -20, 100, 40, 5);

            const statusText = this.add.text(0, 0, shopItem.sold ? '已售空' : '购 买', {
                fontFamily: '"Noto Sans SC", sans-serif', fontSize: '20px', color: '#ffffff'
            }).setOrigin(0.5);

            const buyContainer = this.add.container(0, 120, [statusBg, statusText]);

            container.add([bg, title, desc, price, buyContainer]);
            this.itemsContainer.add(container);

            if (!shopItem.sold) {
                // 在绝对坐标创建交互区
                const absX = x;
                const absY = startY + 120;
                const buyZone = this.add.zone(absX, absY, 100, 40).setInteractive({ useHandCursor: true });
                buyZone.on('pointerdown', () => {
                    this.tweens.add({ targets: buyContainer, scale: 0.9, duration: 100, yoyo: true });
                    this.onBuyClicked(shopItem);
                });
                this.itemZones.push(buyZone);
            }
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

    private showPackChoicePanel(candidates: any[], packType: PackType) {
        // 创建一个简单的三选一全屏遮罩
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const blocker = this.add.zone(width / 2, height / 2, width, height).setInteractive();
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.9);
        bg.fillRect(0, 0, width, height);

        const title = this.add.text(width / 2, height / 4, '请选择一项奖励', {
            fontFamily: '"Noto Sans SC", sans-serif', fontSize: '40px', color: '#ffffff'
        }).setOrigin(0.5);

        const container = this.add.container(0, 0, [blocker, bg, title]);

        const spacing = 250;
        const startX = width / 2 - spacing;

        candidates.forEach((cand, idx) => {
            const x = startX + idx * spacing;
            const y = height / 2;

            const cardBg = this.add.graphics();
            cardBg.fillStyle(0x333333, 1).lineStyle(4, packType === PackType.SparrowPack ? 0x2196f3 : 0xffeb3b, 1);
            cardBg.fillRoundedRect(x - 100, y - 120, 200, 240, 10).strokeRoundedRect(x - 100, y - 120, 200, 240, 10);

            const name = this.add.text(x, y - 80, cand.name, { fontFamily: '"Noto Sans SC", sans-serif', fontSize: '24px', color: '#fff' }).setOrigin(0.5);
            const desc = this.add.text(x, y, cand.description, { fontFamily: '"Noto Sans SC", sans-serif', fontSize: '16px', color: '#aaa', wordWrap: { width: 180 }, align: 'center' }).setOrigin(0.5);

            const btnBg = this.add.graphics().fillStyle(0x4caf50, 1).fillRoundedRect(x - 50, y + 60, 100, 40, 5);
            const btnTxt = this.add.text(x, y + 80, '选 择', { fontFamily: '"Noto Sans SC", sans-serif', fontSize: '20px', color: '#fff' }).setOrigin(0.5);

            const zone = this.add.zone(x, y + 80, 100, 40).setInteractive({ useHandCursor: true });
            zone.on('pointerdown', () => {
                // 放入背包
                if (packType === PackType.SparrowPack) {
                    if (this.flowController.runState!.sparrows.length < this.flowController.shopManager.getMaxSparrows(this.flowController.profile)) {
                        this.flowController.runState!.sparrows.push(cand);
                    } else {
                        this.toast('雀鸟栏已满，卡包奖励丢失'); // 或者应该拒绝选择直到卖出
                    }
                } else {
                    this.flowController.runState!.talismans.push(cand);
                }

                // 销毁面板
                container.destroy();
            });

            container.add([cardBg, name, desc, btnBg, btnTxt, zone]);
        });
    }
}
