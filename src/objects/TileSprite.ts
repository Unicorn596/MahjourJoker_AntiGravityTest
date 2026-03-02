import * as Phaser from 'phaser';
import { TileSuit, TileRank, TileAttribute } from '../types/enums';
import type { ITile } from '../types/interfaces';

/**
 * 渲染单张麻将牌的视觉容器
 * 包含背景色、文字排版、悬停和选中状态的效果。
 */
export class TileSprite extends Phaser.GameObjects.Container {
    public tileData: ITile;
    private bgGraphics: Phaser.GameObjects.Graphics;
    private symbolText: Phaser.GameObjects.Text;
    private tileImage?: Phaser.GameObjects.Image; // 新增：用于显示预渲染的资产图
    private _isSelected: boolean = false;
    private highlightRect: Phaser.GameObjects.Graphics;

    // 用于3D倾斜的包裹容器
    private innerContainer: Phaser.GameObjects.Container;
    private shadowGraphics: Phaser.GameObjects.Graphics;

    // 牌面尺寸
    private readonly TILE_W = 60;
    private readonly TILE_H = 84;

    constructor(scene: Phaser.Scene, x: number, y: number, tileData: ITile) {
        super(scene, x, y);
        this.tileData = tileData;

        this.innerContainer = scene.add.container(0, 0);

        // 阴影
        this.shadowGraphics = scene.add.graphics();
        this.shadowGraphics.fillStyle(0x000000, 0.4);
        this.shadowGraphics.fillRoundedRect(-this.TILE_W / 2 + 5, -this.TILE_H / 2 + 5, this.TILE_W, this.TILE_H, 6);
        this.innerContainer.add(this.shadowGraphics);

        // 背景
        this.bgGraphics = scene.add.graphics();
        this.drawBackground(0xffffff);

        // 高亮边框 (初始隐藏)
        this.highlightRect = scene.add.graphics();
        this.highlightRect.lineStyle(4, 0xffd700, 1);
        this.highlightRect.strokeRoundedRect(-this.TILE_W / 2, -this.TILE_H / 2, this.TILE_W, this.TILE_H, 6);
        this.highlightRect.setVisible(false);
        this.innerContainer.add([this.bgGraphics, this.highlightRect]);

        // 尝试加载真实资产，如果没有则后推使用文字
        const assetKey = this.getAssetKey(tileData);
        if (scene.textures.exists(assetKey)) {
            // 使用生成的真实素材 (假定材质比例与 TILE_W/H 相近，按需缩放)
            this.tileImage = scene.add.image(0, 0, assetKey);
            // 这里我们等比缩放贴图以适应原卡牌尺寸
            const scaleX = (this.TILE_W - 10) / this.tileImage.width;
            const scaleY = (this.TILE_H - 10) / this.tileImage.height;
            const scale = Math.min(scaleX, scaleY);
            this.tileImage.setScale(scale);
            this.innerContainer.add(this.tileImage);

            // 还是需要给个占位的symbolText变量以防引用出错，但不显示
            this.symbolText = scene.add.text(0, 0, '').setVisible(false);
        } else {
            // 文字信息拼装 (FallBack)
            const uiText = this.getTileLabel(tileData);
            const colorStr = this.getTileColor(tileData);

            this.symbolText = scene.add.text(0, 0, uiText, {
                fontFamily: '"Noto Sans SC", sans-serif',
                fontSize: tileData.suit === TileSuit.Wind || tileData.suit === TileSuit.Dragon ? '32px' : '28px',
                color: colorStr,
                fontStyle: 'bold',
                align: 'center'
            });
            this.symbolText.setOrigin(0.5);
            this.innerContainer.add(this.symbolText);
        }

        this.add(this.innerContainer);

        // 交互范围设置
        this.setSize(this.TILE_W, this.TILE_H);
        this.setInteractive({ useHandCursor: true });

        this.on('pointerover', this.onHover, this);
        this.on('pointerout', this.onOut, this);
        this.on('pointermove', this.onMove, this);

        scene.add.existing(this);
    }

    private getAssetKey(t: ITile): string {
        // 根据相符的素材key返回，目前阶段只生成了三个
        if (t.suit === TileSuit.Tiao && t.rank === 1) return 'tile_bamboo_1';
        if (t.suit === TileSuit.Bing && t.rank === 5) return 'tile_dots_5';
        if (t.suit === TileSuit.Wan && t.rank === 9) return 'tile_characters_9';
        return `tile_${t.suit}_${t.rank}`;
    }

    private drawBackground(color: number) {
        this.bgGraphics.clear();
        this.bgGraphics.fillStyle(color, 1);
        // 阴影
        this.bgGraphics.lineStyle(2, 0x999999, 1);
        this.bgGraphics.fillRoundedRect(-this.TILE_W / 2, -this.TILE_H / 2, this.TILE_W, this.TILE_H, 6);
        this.bgGraphics.strokeRoundedRect(-this.TILE_W / 2, -this.TILE_H / 2, this.TILE_W, this.TILE_H, 6);

        // 特殊属性表现
        if (this.tileData.isWildcard) {
            this.bgGraphics.lineStyle(4, 0xff00ff, 1); // 万能牌紫色边框
            this.bgGraphics.strokeRoundedRect(-this.TILE_W / 2, -this.TILE_H / 2, this.TILE_W, this.TILE_H, 6);
        } else if (this.tileData.attribute === TileAttribute.Gold) {
            this.bgGraphics.fillStyle(0xfff7cc, 1); // 点金泛黄底色
            this.bgGraphics.fillRoundedRect(-this.TILE_W / 2, -this.TILE_H / 2, this.TILE_W, this.TILE_H, 6);
        }
    }

    private getTileLabel(t: ITile): string {
        switch (t.suit) {
            case TileSuit.Wan: return `${t.rank}\n万`;
            case TileSuit.Tiao: return `${t.rank}\n条`;
            case TileSuit.Bing: return `${t.rank}\n饼`;
            case TileSuit.Wind:
                return ['东', '南', '西', '北'][t.rank - 10];
            case TileSuit.Dragon:
                return ['中', '发', '白'][t.rank - 14];
        }
        return '?';
    }

    private getTileColor(t: ITile): string {
        switch (t.suit) {
            case TileSuit.Wan: return '#d32f2f'; // 红
            case TileSuit.Tiao: return '#388e3c'; // 绿
            case TileSuit.Bing: return '#1976d2'; // 蓝
            case TileSuit.Wind: return '#512da8'; // 紫
            case TileSuit.Dragon:
                if (t.rank === TileRank.Zhong) return '#d32f2f';
                if (t.rank === TileRank.Fa) return '#388e3c';
                return '#4aaaa5'; // 白板用偏蓝色
        }
        return '#000';
    }

    public get isSelected(): boolean {
        return this._isSelected;
    }

    public setSelected(val: boolean) {
        this._isSelected = val;
        this.highlightRect.setVisible(val);
        if (val) {
            this.y -= 15; // 升起
        } else {
            this.y += 15; // 降下
        }
    }

    private onHover() {
        this.scene.tweens.add({ targets: this.innerContainer, scale: 1.15, duration: 150, ease: 'Back.easeOut' });
        this.shadowGraphics.x = 8;
        this.shadowGraphics.y = 8;
    }

    private onOut() {
        this.scene.tweens.add({ targets: this.innerContainer, scale: 1, duration: 150, ease: 'Back.easeIn' });

        // 恢复3D形变
        this.scene.tweens.add({
            targets: this.innerContainer,
            angle: 0,
            x: 0,
            y: 0,
            duration: 150,
            ease: 'Power2'
        });
        this.shadowGraphics.x = 0;
        this.shadowGraphics.y = 0;
    }

    private onMove(_pointer: Phaser.Input.Pointer, localX: number, localY: number) {
        // Pseudo-3D Parallax Tilt Effect
        // 计算鼠标在牌内的相对位置 (-1 to 1)
        const relX = (localX / this.TILE_W) * 2 - 1;
        const relY = (localY / this.TILE_H) * 2 - 1;

        // 根据鼠标位置轻微挪动物品和整体角度
        this.innerContainer.angle = relX * 10;

        if (this.tileImage) {
            this.tileImage.x = -relX * 4;
            this.tileImage.y = -relY * 4;
        } else {
            this.symbolText.x = -relX * 4;
            this.symbolText.y = -relY * 4;
        }

        // 阴影反向移动以增强悬浮感
        this.shadowGraphics.x = relX * 10;
        this.shadowGraphics.y = relY * 10;
    }
}
