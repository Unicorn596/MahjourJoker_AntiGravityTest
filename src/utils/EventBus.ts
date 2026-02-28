/**
 * 强类型事件总线 —— 用于核心逻辑层与渲染层的解耦通信。
 * 不依赖 Phaser，纯 TypeScript 实现。
 */

type Listener<T> = (payload: T) => void;

export class EventBus {
    private listeners: Map<string, Set<Listener<unknown>>> = new Map();

    /** 注册事件监听 */
    on<T = void>(event: string, listener: Listener<T>): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(listener as Listener<unknown>);
    }

    /** 移除事件监听 */
    off<T = void>(event: string, listener: Listener<T>): void {
        this.listeners.get(event)?.delete(listener as Listener<unknown>);
    }

    /** 派发事件 */
    emit<T = void>(event: string, payload?: T): void {
        const set = this.listeners.get(event);
        if (set) {
            for (const fn of set) {
                fn(payload);
            }
        }
    }

    /** 清除所有监听 */
    clear(): void {
        this.listeners.clear();
    }
}

/** 全局单例 */
export const globalBus = new EventBus();
