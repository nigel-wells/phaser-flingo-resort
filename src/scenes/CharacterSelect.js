export class CharacterSelect extends Phaser.Scene {
    constructor() {
        super('CharacterSelect');
    }

    preload() {
        this.load.image('boy1', 'assets/characters/boy1.png');
        this.load.image('boy2', 'assets/characters/boy2.png');
        this.load.image('girl1', 'assets/characters/girl1.png');
        this.load.image('girl2', 'assets/characters/girl2.png');
    }

    create() {
        const { width, height } = this.scale;
        this.titleText = this.add.text(width / 2, height * 0.08, 'Choose Your Character', { 
            fontSize: this.getScaledFontSize(width, 0.055), // 5.5% of screen width
            color: '#ffffff' 
        }).setOrigin(0.5);

        const keys = ['boy1', 'boy2', 'girl1', 'girl2'];

        const startX = width * 0.2;
        const gap = (width * 0.6) / (keys.length - 1);

        // Runtime trimming removed — original assets will be used directly.

        this.characterImages = []; // Store references for resizing

        keys.forEach((key, i) => {
            const x = startX + i * gap;
            const y = height * 0.45;
            // Use the original textures directly (no runtime trimming)
            const img = this.add.image(x, y, key).setInteractive({ useHandCursor: true });
            img.setOrigin(0.5, 0.5);
            img.setAlpha(1);
            img.setBlendMode(Phaser.BlendModes.NORMAL);
            // Preserve aspect ratio and scale thumbnail relative to screen size
            const src = this.textures.get(key).getSourceImage();
            let baseW = src && src.width ? src.width : img.width;
            let baseH = src && src.height ? src.height : img.height;
            if (src && src.width && src.height) {
                const maxH = height * 0.3; // Scale to 30% of screen height
                const scale = Math.min(1, maxH / src.height);
                baseW = Math.round(src.width * scale);
                baseH = Math.round(src.height * scale);
                img.setDisplaySize(baseW, baseH);
            }

            // Store scaling info for resize handling
            img.baseW = baseW;
            img.baseH = baseH;
            this.characterImages.push(img);

            img.on('pointerup', () => {
                this.registry.set('selectedCharacter', key);
                this.scene.start('PlayScene');
            });

            // gentle hover effect: increase display size by ~8%
            const hoverScale = 1.08;
            img.on('pointerover', () => {
                img.setDisplaySize(Math.round(img.baseW * hoverScale), Math.round(img.baseH * hoverScale));
            });
            img.on('pointerout', () => {
                img.setDisplaySize(img.baseW, img.baseH);
            });
        });

        // Handle window resize
        this.scale.on('resize', this.handleResize, this);
    }

    getScaledFontSize(screenWidth, percentage) {
        return Math.round(screenWidth * percentage) + 'px';
    }

    handleResize(gameSize) {
        const { width, height } = gameSize;

        // Update title text position and font size
        try {
            this.titleText.setPosition(width / 2, height * 0.08);
            const newFontSize = this.getScaledFontSize(width, 0.055);
            if (newFontSize && parseInt(newFontSize) > 0) {
                this.titleText.setFontSize(newFontSize);
            }
        } catch (error) {
            console.warn('Failed to update character select title:', error);
        }

        const keys = ['boy1', 'boy2', 'girl1', 'girl2'];
        const startX = width * 0.2;
        const gap = (width * 0.6) / (keys.length - 1);

        // Update character image positions and sizes
        this.characterImages.forEach((img, i) => {
            const x = startX + i * gap;
            const y = height * 0.45;
            img.setPosition(x, y);

            // Recalculate scaling based on new screen size
            const src = this.textures.get(img.texture.key).getSourceImage();
            if (src && src.width && src.height) {
                const maxH = height * 0.3; // Scale to 30% of screen height
                const scale = Math.min(1, maxH / src.height);
                img.baseW = Math.round(src.width * scale);
                img.baseH = Math.round(src.height * scale);
                img.setDisplaySize(img.baseW, img.baseH);
            }
        });
    }
}
