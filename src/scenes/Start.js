// Redirector Start scene: immediately hands off to the new TitleScene
export class Start extends Phaser.Scene {
    constructor() {
        super('Start');
    }

    create() {
        this.scene.start('TitleScene');
    }
}
