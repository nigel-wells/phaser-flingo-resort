export class TitleScene extends Phaser.Scene {
    constructor() {
        super('TitleScene');
    }

    preload() {
        this.load.image('flingo', 'assets/characters/flingo.png');
    }

    create() {
        const { width, height } = this.scale;

        // Title text
        this.add.text(width / 2, height * 0.18, 'Flingo Resort', {
            fontFamily: 'Arial',
            fontSize: '64px',
            color: '#ffffff'
        }).setOrigin(0.5);

        // flingo sprite walking back and forth with a small bob

        const flingo = this.add.sprite(width / 2, height * 0.38, 'flingo');
        flingo.setOrigin(0.5, 0.5);
        flingo.setAlpha(1);
        flingo.setBlendMode(Phaser.BlendModes.NORMAL);

        // Maintain original aspect ratio; make flingo 1/3 of original size
        const flingoImg = this.textures.get('flingo').getSourceImage();
        if (flingoImg && flingoImg.width && flingoImg.height) {
            const w = flingoImg.width;
            const h = flingoImg.height;
            flingo.setDisplaySize(Math.round(w / 3), Math.round(h / 3));
        }

        // Horizontal back-and-forth tween. Flip sprite on direction change.
        const moveLeft = this.tweens.add({
            targets: flingo,
            x: width * 0.2,
            duration: 1500,
            ease: 'Sine.inOut',
            paused: true,
            onStart: () => flingo.setFlipX(true)
        });

        const moveRight = this.tweens.add({
            targets: flingo,
            x: width * 0.8,
            duration: 1500,
            ease: 'Sine.inOut',
            paused: true,
            onStart: () => flingo.setFlipX(false)
        });

        // Chain them manually to loop
        moveLeft.setCallback('onComplete', () => {
            bobTween.play();
            moveRight.restart();
        });
        moveRight.setCallback('onComplete', () => {
            bobTween.play();
            moveLeft.restart();
        });

        // small bob tween runs briefly after each horizontal move
        const bobTween = this.tweens.add({
            targets: flingo,
            y: `-=${6}`,
            duration: 250,
            yoyo: true,
            paused: true
        });

        // start the loop
        moveRight.restart();

        // Start Game button
        const start = this.add.text(width / 2, height * 0.72, 'Start Game', {
            fontFamily: 'Arial',
            fontSize: '36px',
            color: '#000000',
            backgroundColor: '#ffffff',
            padding: { x: 16, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        start.on('pointerdown', () => {
            this.scene.start('CharacterSelect');
        });
    }
}
