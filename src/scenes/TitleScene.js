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
        this.titleText = this.add.text(width / 2, height * 0.18, 'Flingo Resort', {
            fontFamily: 'Arial',
            fontSize: this.getScaledFontSize(width, 0.06), // 6% of screen width
            color: '#ffffff'
        }).setOrigin(0.5);

        // flingo sprite walking back and forth with a small bob

        this.flingo = this.add.sprite(width / 2, height * 0.38, 'flingo');
        this.flingo.setOrigin(0.5, 0.5);
        this.flingo.setAlpha(1);
        this.flingo.setBlendMode(Phaser.BlendModes.NORMAL);

        // Scale flingo proportionally to screen size (about 1/4 of screen height)
        this.updateFlingoScale(width, height);

        // Store initial positions for resize handling
        this.initialFlingoY = height * 0.38;

        // Horizontal back-and-forth tween. Flip sprite on direction change.
        // Adjust movement bounds to account for sprite width
        this.moveLeft = this.tweens.add({
            targets: this.flingo,
            x: this.flingo.displayWidth / 2 + 20, // Leave small margin from edge
            duration: 1500,
            ease: 'Sine.inOut',
            paused: true,
            onStart: () => this.flingo.setFlipX(true)
        });

        this.moveRight = this.tweens.add({
            targets: this.flingo,
            x: width - this.flingo.displayWidth / 2 - 20, // Leave small margin from edge
            duration: 1500,
            ease: 'Sine.inOut',
            paused: true,
            onStart: () => this.flingo.setFlipX(false)
        });

        // Chain them manually to loop
        this.moveLeft.setCallback('onComplete', () => {
            this.bobTween.play();
            this.moveRight.restart();
        });
        this.moveRight.setCallback('onComplete', () => {
            this.bobTween.play();
            this.moveLeft.restart();
        });

        // small bob tween runs briefly after each horizontal move
        this.bobTween = this.tweens.add({
            targets: this.flingo,
            y: `-=${Math.max(6, this.flingo.displayHeight * 0.02)}`, // Scale bob with sprite size
            duration: 250,
            yoyo: true,
            paused: true
        });

        // start the loop
        this.moveRight.restart();

        // Start Game button
        this.startButton = this.add.text(width / 2, height * 0.72, 'Start Game', {
            fontFamily: 'Arial',
            fontSize: this.getScaledFontSize(width, 0.035), // 3.5% of screen width
            color: '#000000',
            backgroundColor: '#ffffff',
            padding: { x: 16, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.startButton.on('pointerdown', () => {
            this.scene.start('CharacterSelect');
        });

        // Handle window resize
        this.scale.on('resize', this.handleResize, this);
    }

    getScaledFontSize(screenWidth, percentage) {
        return Math.round(screenWidth * percentage) + 'px';
    }

    updateFlingoScale(width, height) {
        // Scale flingo proportionally to screen size (about 1/4 of screen height)
        const flingoImg = this.textures.get('flingo').getSourceImage();
        if (flingoImg && flingoImg.width && flingoImg.height) {
            const targetHeight = height * 0.5; // 1/4 of screen height
            const scale = targetHeight / flingoImg.height;
            const w = flingoImg.width * scale;
            const h = flingoImg.height * scale;
            this.flingo.setDisplaySize(Math.round(w), Math.round(h));
        }
    }

    handleResize(gameSize) {
        const { width, height } = gameSize;

        // Update title text position and font size
        try {
            this.titleText.setPosition(width / 2, height * 0.18);
            const newTitleFontSize = this.getScaledFontSize(width, 0.06);
            if (newTitleFontSize && parseInt(newTitleFontSize) > 0) {
                this.titleText.setFontSize(newTitleFontSize);
            }
        } catch (error) {
            console.warn('Failed to update title text:', error);
        }

        // Update flingo position and scale
        this.flingo.setPosition(width / 2, height * 0.38);
        this.updateFlingoScale(width, height);

        // Stop existing tweens
        if (this.moveLeft) this.moveLeft.stop();
        if (this.moveRight) this.moveRight.stop();
        if (this.bobTween) this.bobTween.stop();

        // Recreate tweens with new bounds
        const spriteHalfWidth = this.flingo.displayWidth / 2;

        this.moveLeft = this.tweens.add({
            targets: this.flingo,
            x: spriteHalfWidth + 20,
            duration: 1500,
            ease: 'Sine.inOut',
            paused: true,
            onStart: () => this.flingo.setFlipX(true)
        });

        this.moveRight = this.tweens.add({
            targets: this.flingo,
            x: width - spriteHalfWidth - 20,
            duration: 1500,
            ease: 'Sine.inOut',
            paused: true,
            onStart: () => this.flingo.setFlipX(false)
        });

        // Re-chain the tweens
        this.moveLeft.setCallback('onComplete', () => {
            this.bobTween.play();
            this.moveRight.restart();
        });
        this.moveRight.setCallback('onComplete', () => {
            this.bobTween.play();
            this.moveLeft.restart();
        });

        // Recreate bob tween with new amount
        const bobAmount = Math.max(6, this.flingo.displayHeight * 0.02);
        this.bobTween = this.tweens.add({
            targets: this.flingo,
            y: `-=${bobAmount}`,
            duration: 250,
            yoyo: true,
            paused: true
        });

        // Restart the animation loop
        this.moveRight.restart();

        // Update start button position and font size
        try {
            this.startButton.setPosition(width / 2, height * 0.72);
            const newButtonFontSize = this.getScaledFontSize(width, 0.035);
            if (newButtonFontSize && parseInt(newButtonFontSize) > 0) {
                this.startButton.setFontSize(newButtonFontSize);
            }
        } catch (error) {
            console.warn('Failed to update start button:', error);
        }
    }
}
