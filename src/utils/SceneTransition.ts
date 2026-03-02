import * as Phaser from 'phaser';

export class SceneTransition {
    /**
     * Tries a smooth fade out transition to another scene.
     * @param prevScene The scene we are jumping from
     * @param targetKey The target scene key
     * @param data Optional data to pass to the target scene
     * @param duration Transition duration in milliseconds
     */
    static fadeTo(prevScene: Phaser.Scene, targetKey: string, data?: any, duration: number = 500) {
        prevScene.cameras.main.fadeOut(duration, 0, 0, 0);

        prevScene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            prevScene.scene.start(targetKey, data);
        });
    }

    /**
     * Plays a fade in effect for the given scene. Should be called in the scene's `create` method.
     * @param currentScene The scene to fade in
     * @param duration Transition duration in milliseconds
     */
    static fadeIn(currentScene: Phaser.Scene, duration: number = 500) {
        currentScene.cameras.main.fadeIn(duration, 0, 0, 0);
    }
}
