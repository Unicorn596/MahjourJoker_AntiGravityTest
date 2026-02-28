/**
 * 可设种子的伪随机数生成器 (Mulberry32)。
 * 确保 Roguelike 的随机可复现。
 */
export class RNG {
    private state: number;

    constructor(seed: number) {
        this.state = seed | 0;
    }

    /** 返回 [0, 1) 的浮点数 */
    next(): number {
        this.state = (this.state + 0x6d2b79f5) | 0;
        let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /** 返回 [min, max] 的整数 */
    nextInt(min: number, max: number): number {
        return min + Math.floor(this.next() * (max - min + 1));
    }

    /** Fisher-Yates 洗牌 (原地) */
    shuffle<T>(array: T[]): T[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = this.nextInt(0, i);
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}
