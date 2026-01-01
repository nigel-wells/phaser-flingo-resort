import { TitleScene } from './scenes/TitleScene.js';
import { CharacterSelect } from './scenes/CharacterSelect.js';
import { PlayScene } from './scenes/PlayScene.js';

const config = {
    type: Phaser.AUTO,
    title: 'Flingo Resort',
    description: '',
    parent: 'game-container',
    width: 1536,
    height: 1024,
    backgroundColor: '#000000',
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [
        TitleScene,
        CharacterSelect,
        PlayScene
    ],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        expandParent: true
    },
}

const game = new Phaser.Game(config);
// Set debug flag in game registry so scenes can access it
game.registry.set('debugMode', false);
            