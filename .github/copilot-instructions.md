# Copilot Instructions for Phaser 2D Pixel-Art Game

## Project Overview
This is a Phaser 3 HTML5 game using ES6 modules, focused on 2D pixel-art. Open `index.html` in a browser to run the game during development.

## Architecture
- Entry point: `index.html` loads `phaser.js` and `src/main.js` as a module.
- Game config: defined in `src/main.js` when creating `new Phaser.Game()`.
- Scenes: placed in `src/scenes/`, each extends `Phaser.Scene` and exports a class.
- Assets: organized under `assets/` with subfolders `assets/characters` and `assets/backgrounds` for sprites and tiles.

## Pixel Art Guidelines
- Use integer scaling and disable antialiasing for crisp pixels: set `pixelArt: true` in the game config and use `Phaser.Scale.FIT` where appropriate.
- Prefer spritesheets for animated characters. Keep consistent frame sizes and powers-of-two textures where possible.
- Provide both `idle` and `walk` frames for characters; include separate action sheets (e.g., `interact`, `use`) if needed.

## Scene Structure & Patterns
- Each scene should implement `preload()`, `create()`, and `update()`.
- Load images and spritesheets from `assets/` using `this.load.image()` and `this.load.spritesheet()` with explicit `frameWidth`/`frameHeight`.
- Create animations with `this.anims.create()` and `generateFrameNumbers()`; play them with `sprite.anims.play()`.
- Use `this.physics.add.sprite()` for characters that need collision and movement.

## Character Movement (X/Y)
- Characters move on the X and Y axes using velocity or tweens. For player-controlled characters prefer Arcade Physics velocities and cursors:
  - Use `this.input.keyboard.createCursorKeys()` and set `sprite.setVelocity(x, y)`.
  - Normalize diagonal movement to maintain consistent speed.
- For NPCs, implement behavior as state machines or timed tweens: `idle`, `walk`, `performTask`, `returnToIdle`.

## Per-Scene Character Scaling
- Each scene can have a different character scale via `characterScale` property in `sceneConfigs.js` (1.0 = 100%, 0.8 = 80%, etc.)
- During `create()`, the player sprite is sized using: `desiredH = 240` pixels, then scaled based on `characterScale` from the scene config
- When switching scenes with different scales, `baseDisplayWidth` and `baseDisplayHeight` are multiplied by the new `characterScale`
- **Critical**: After resizing, update `baseScaleX`, `baseScaleY`, `targetScaleX`, and `targetScaleY` so the squash/stretch animation uses the new scale as baseline

## Obstacle System & Collision Detection
- Obstacles are defined per-scene in `sceneConfigs.js` as rectangles: `{ x, y, width, height }`
- Collision detection checks only the bottom 10% of the character ("feet") against obstacles with 5px padding
- Character can walk into/through obstacles if moving *away* from obstacle center; blocked if moving *toward* it
- If stuck (no movement), character is auto-pushed away from obstacle center (intelligently avoiding adjacent obstacles)
- **Side Detection**: Collision system detects which side (top/bottom/left/right) was hit by calculating distance to each obstacle edge
- **Event Triggers**: Obstacles can have `eventTrigger` property to trigger scene changes:
  ```javascript
  { x: 695, y: 0, width: 146, height: 479, eventTrigger: { side: 'bottom', action: 'switchScene', targetScene: 'resort-reception', entryDir: 'fromTop' } }
  ```
- Scene exits are locked for 800ms after switching to prevent accidental re-triggering

## NPC & Interactive Objects System
- NPCs and interactive objects are defined per-scene in `sceneConfigs.js` under an `npcs` array:
  ```javascript
  npcs: [
    {
      key: 'flingo',           // Character texture key (must be preloaded)
      x: 768,                  // X position in scene
      y: 650,                  // Y position in scene
      scale: 1.0,              // Optional scale multiplier
      interactive: true,       // Whether object responds to clicks
      dialog: 'Hello there!'   // Optional dialog text (extensible)
    }
  ]
  ```
- NPCs are automatically created when entering a scene and destroyed when leaving
- Interactive NPCs respond to pointer (click) events
- NPC asset files should be placed in `assets/characters/` (e.g., `assets/characters/flingo.png`)
- Must be preloaded in `PlayScene.preload()` before use
- Dialog system is a placeholder for future expansion (quests, conversations, etc.)

## Extracting Obstacles from Mask Images
- Create a red (#ed1c23) mask image at the same dimensions as your background (1536×1024)
- Place mask files in `assets/backgrounds/masks/` folder
- Run extraction script: `node scripts/extractObstacles.js <path-to-mask> [sceneName] [gameWidth] [gameHeight]`
- Example: `node scripts/extractObstacles.js assets/backgrounds/masks/grass.png grass 1536 1024`
- Script detects red pixels, identifies continuous rectangular regions, and outputs formatted obstacle config for `sceneConfigs.js`
- The extraction uses:
  - Precise color detection: RGB(237, 28, 35) with ±20 tolerance per channel
  - Minimum area filter: 500 sq pixels (removes noise)
  - Horizontal rectangle scanning with automatic merging of adjacent spans
  - Output is sorted top-to-bottom, left-to-right for readability

## Asset Layout Examples
- Characters: `assets/characters/player.png`, `assets/characters/npc1.png`, or `assets/characters/player_spritesheet.png`.
- Backgrounds: `assets/backgrounds/sky.png`, `assets/backgrounds/grass.png`, `assets/backgrounds/resort-outside.png`.
- Obstacle masks: `assets/backgrounds/masks/grass.png`, `assets/backgrounds/masks/resort-outside.png`.

## Development Workflow
- Edit scenes in `src/scenes/` and `src/main.js`. Reload `index.html` in the browser to test.
- No build step required for simple iteration; use a local static file server if CORS blocks direct file opening.
- Keep `assets/` organized by type; update scenes to reference correct relative paths.

## Small Examples
- Loading a spritesheet:

  this.load.spritesheet('player', 'assets/characters/player_spritesheet.png', { frameWidth: 32, frameHeight: 32 });

- Creating a simple walk animation:

  this.anims.create({ key: 'walk', frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });

- Basic movement handling (in `update()`):

  const speed = 100;
  let vx = 0, vy = 0;
  if (cursors.left.isDown) vx = -speed;
  else if (cursors.right.isDown) vx = speed;
  if (cursors.up.isDown) vy = -speed;
  else if (cursors.down.isDown) vy = speed;
  sprite.setVelocity(vx, vy);

## Conventions
- Scene keys should match exported class names (e.g., `StartScene`).
- Use `assets/characters` for all character art and `assets/backgrounds` for environment art.
- Name spritesheets with a `_spritesheet` suffix for clarity.

## Next Steps (suggested)
- Create a `Boot` scene to load minimal assets and start `StartScene`.
- Create a `StartScene` with a player sprite and basic movement controls.
- Add a test NPC with a simple wander-and-task state machine.

If you'd like, I can implement the `Boot` and `StartScene` examples and wire up a sample player using the assets already in `assets/characters` and `assets/backgrounds`.