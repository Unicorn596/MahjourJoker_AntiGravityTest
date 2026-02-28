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
    private _isSelected: boolean = false;
    private highlightRect: Phaser.GameObjects.Graphics;

    // 牌面尺寸
    private readonly TILE_W = 60;
    private readonly TILE_H = 84;

    constructor(scene: Phaser.Scene, x: number, y: number, tileData: ITile) {
        super(scene, x, y);
        this.tileData = tileData;

        // 背景
        this.bgGraphics = scene.add.graphics();
        this.drawBackground(0xffffff);

        // 高亮边框 (初始隐藏)
        this.highlightRect = scene.add.graphics();
        this.highlightRect.lineStyle(4, 0xffd700, 1);
        this.highlightRect.strokeRoundedRect(-this.TILE_W / 2, -this.TILE_H / 2, this.TILE_W, this.TILE_H, 6);
        this.highlightRect.setVisible(false);

        // 文字信息拼装
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

        this.add([this.bgGraphics, this.highlightRect, this.symbolText]);

        // 交互范围设置
        this.setSize(this.TILE_W, this.TILE_H);
        this.setInteractive({ useHandCursor: true });

        // 设置居中点进行缩放动画
        this.setInteractive();

        this.on('pointerover', this.onHover, this);
        this.on('pointerout', this.onOut, this);

        scene.add.existing(this);
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
        if (!this._isSelected) {
            this.scene.tweens.add({ targets: this, scale: 1.1, duration: 100 });
        }
    }

    private onOut() {
        if (!this._isSelected) {
            this.scene.tweens.add({ targets: this, scale: 1, duration: 100 });
        }
    }
}
