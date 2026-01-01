import { sceneConfigs } from '../sceneConfigs.js';

export class PlayScene extends Phaser.Scene {
    constructor() {
        super('PlayScene');
    }

    init() {
        this.selected = this.registry.get('selectedCharacter') || 'boy1';
    }

    preload() {
        this.load.image('grass', 'assets/backgrounds/grass.png');
        this.load.image('resort-outside', 'assets/backgrounds/resort-outside.png');
        this.load.image('resort-reception', 'assets/backgrounds/resort-reception.png');
        this.load.image('resort-pool', 'assets/backgrounds/resort-pool.png');
        // characters already loaded in CharacterSelect, but ensure texture is available
        this.load.image('boy1', 'assets/characters/boy1.png');
        this.load.image('boy2', 'assets/characters/boy2.png');
        this.load.image('girl1', 'assets/characters/girl1.png');
        this.load.image('girl2', 'assets/characters/girl2.png');
        // NPCs
        this.load.image('flingo', 'assets/characters/flingo.png');
    }

    create() {
        const gameWidth = this.game.config.width;   // 1536
        const gameHeight = this.game.config.height; // 1024
        const canvasWidth = this.cameras.main.width;
        
        // Calculate scale factor to match window width
        this.scaleFactor = canvasWidth / gameWidth;
        const scaledWidth = gameWidth * this.scaleFactor;
        const scaledHeight = gameHeight * this.scaleFactor;
        
        // Create background sprite scaled to window width
        this.bg = this.add.sprite(scaledWidth / 2, scaledHeight / 2, 'grass');
        this.bg.setScale(this.scaleFactor);
        this.bg.setScrollFactor(1); // Move with camera for panning effect
        this.currentBackground = 'grass'; // default starting scene

        // Create world bounds and player — scaled to match window
        this.worldWidth = scaledWidth;
        this.worldHeight = scaledHeight;
        if (this.physics && this.physics.world && this.physics.add) {
            this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);

            this.player = this.physics.add.sprite(this.worldWidth / 2, this.worldHeight / 2 + 40, this.selected);
            this.player.setCollideWorldBounds(true);
            this.usePhysics = true;
        } else {
            console.warn('Arcade Physics not available; falling back to non-physics movement');
            this.player = this.add.sprite(this.worldWidth / 2, this.worldHeight / 2 + 40, this.selected);
            this.usePhysics = false;
        }
        this.player.setOrigin(0.5, 0.5);
        this.player.setAlpha(1);
        this.player.setBlendMode(Phaser.BlendModes.NORMAL);

        // Preserve aspect ratio for player sprite (use reasonable height)
        const src = this.textures.get(this.selected).getSourceImage();
        const sceneConfig = sceneConfigs[this.currentBackground] || {};
        const sceneScale = sceneConfig.characterScale || 1.0;
        
        if (src && src.width && src.height) {
            const desiredH = 240 * this.scaleFactor; // base doubled player height in pixels, scaled to screen
            const scale = desiredH / src.height;
            const baseW = src.width * scale;
            const baseH = src.height * scale;
            // Store base dimensions for later scaling
            this.baseDisplayWidth = baseW;
            this.baseDisplayHeight = baseH;
            // Apply scene scale to the base dimensions
            this.player.setDisplaySize(Math.round(baseW * sceneScale), Math.round(baseH * sceneScale));
        }

        // Set player depth to appear on top of NPCs
        this.player.setDepth(100);

        // Store fixed collision dimensions - should encompass max animation scale
        // Animation scales X up to 1.05 and Y down to 0.95, so collision box needs to cover 1.05 on X
        this.collisionWidth = this.player.displayWidth * 1.05;
        this.collisionHeight = this.player.displayHeight; // Height stays at base (0.95 is smaller, doesn't matter)
        
        // Store the current scene scale for reference
        this.currentSceneScale = sceneScale;

        // Store the base scale so squash tween uses relative values
        this.baseScaleX = this.player.scaleX;
        this.baseScaleY = this.player.scaleY;

        // If using physics, update body size to match display size and center it
        if (this.usePhysics && this.player.body && this.player.body.setSize) {
            // the third argument `true` recenters the body on the sprite
            this.player.body.setSize(this.player.displayWidth, this.player.displayHeight, true);
            // ensure collide with world bounds is enabled
            this.player.body.setCollideWorldBounds(true);
        }

        // Set camera to follow player and constrain to world bounds
        if (this.player) {
            this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
            this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
        } else {
            console.error('Player sprite could not be created - camera following disabled');
        }

        // Handle dynamic canvas resize
        this.scale.on('resize', this.handleResize, this);

        this.cursors = this.input.keyboard.createCursorKeys();

        this.SPEED = 180;
        // lock window (ms) after scene switch during which all exit detection is disabled
        this.exitLockDuration = 800;
        this.exitLockedUntil = 0;

        // debug overlay - read from game registry
        this.debugMode = this.registry.get('debugMode') || false;
        if (this.debugMode) {
            this.debugText = this.add.text(8, 8, '', { fontSize: '12px', color: '#ffff00', backgroundColor: 'rgba(0,0,0,0.5)' }).setDepth(1000).setScrollFactor(0);
        }

        // debug graphics for obstacles
        this.debugGraphics = this.add.graphics();
        this.debugGraphics.setDepth(999);
        this.debugGraphics.setScrollFactor(1); // Move with camera/world
        this.drawObstacleDebug();

        // We'll use per-frame lerping toward a target scale to create a squash/stretch
        this.targetScaleX = this.baseScaleX;
        this.targetScaleY = this.baseScaleY;
        this.isSquashing = false;

        // Track previous position to revert if collision detected
        this.lastPlayerX = this.player.x;
        this.lastPlayerY = this.player.y;
        
        // Track if we were colliding last frame
        this.wasCollidingLastFrame = false;
        this.lastCollidingObstacle = null; // Track which obstacle we hit

        // Storage for NPCs and interactive objects
        this.npcs = {}; // key -> sprite

        // Dialog system
        this.dialogBox = null;
        this.dialogText = null;
        this.isDialogOpen = false;

        // Do NOT follow camera — keep background fixed, character moves within the scene
        // (camera remains static by default)
        // Now that the player exists and is initialized, apply the scene config to
        // position the player correctly for this scene entry.
        this.applySceneConfig(this.currentBackground, { entry: 'start' });
    }

    update() {
        const cursors = this.cursors;
        
        // Store position before movement
        this.lastPlayerX = this.player.x;
        this.lastPlayerY = this.player.y;
        
        let vx = 0;
        let vy = 0;

        if (cursors.left.isDown) vx = -1;
        else if (cursors.right.isDown) vx = 1;
        if (cursors.up.isDown) vy = -1;
        else if (cursors.down.isDown) vy = 1;

        // Touch input: if touched, move toward touch point (unless arrow keys are pressed)
        let isUsingTouch = false;
        if (vx === 0 && vy === 0 && this.input.activePointer.isDown) {
            // Convert touch screen coordinates to world coordinates
            const worldPoint = this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y);
            const touchX = worldPoint.x;
            const touchY = worldPoint.y;
            
            const dx = touchX - this.player.x;
            const dy = touchY - this.player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Only move if touch is at least 10 pixels away (dead zone)
            if (dist > 10) {
                vx = dx / dist;
                vy = dy / dist;
                isUsingTouch = true;
            }
        }

        // Store intended movement direction for collision checking
        this.intendedVx = vx;
        this.intendedVy = vy;

        // normalize
        if (vx !== 0 && vy !== 0) {
            vx *= Math.SQRT1_2;
            vy *= Math.SQRT1_2;
        }

        // Apply speed (touch is twice as fast as keyboard)
        const currentSpeed = isUsingTouch ? this.SPEED * 2 : this.SPEED;

        if (this.usePhysics) {
            this.player.setVelocity(vx * currentSpeed, vy * currentSpeed);
        } else {
            // manual position update fallback; do not modify Y with tweens
            this.player.x += vx * currentSpeed * (this.game.loop.delta / 1000);
            this.player.y += vy * currentSpeed * (this.game.loop.delta / 1000);
        }

        // Unified visual clamping: ensure the collision bounds (collisionWidth/Height)
        // never clips outside the scene, for both physics and non-physics players.
        {
            const ox = (typeof this.player.originX === 'number') ? this.player.originX : 0.5;
            const oy = (typeof this.player.originY === 'number') ? this.player.originY : 0.5;
            const left = this.player.x - this.collisionWidth * ox;
            const right = left + this.collisionWidth;
            const top = this.player.y - this.collisionHeight * oy;
            const bottom = top + this.collisionHeight;

            let nx = this.player.x, ny = this.player.y;
            if (left < 0) nx += -left;
            else if (right > this.worldWidth) nx += this.worldWidth - right;
            if (top < 0) ny += -top;
            else if (bottom > this.worldHeight) ny += this.worldHeight - bottom;

            if (nx !== this.player.x || ny !== this.player.y) {
                // Set visual position; for physics players we also zero velocity
                // so they don't immediately push back out on next step.
                this.player.setPosition(nx, ny);
                if (this.usePhysics && this.player.body && this.player.body.setVelocity) {
                    this.player.setVelocity(0, 0);
                }
            }
        }

        // Obstacle collision: check if player collides with any obstacles in the scene
        this.checkObstacleCollisions();

        // Scene transitions: check edge crossing and consult neighbors for destination
        const sceneLeft = 0;
        const sceneRight = this.worldWidth;
        const sceneTop = 0;
        const sceneBottom = this.worldHeight;
        const oxv = (typeof this.player.originX === 'number') ? this.player.originX : 0.5;
        const oyv = (typeof this.player.originY === 'number') ? this.player.originY : 0.5;
        // Use fixed collision dimensions for edge detection, not animated displayWidth/Height
        const pLeft = this.player.x - this.collisionWidth * oxv;
        const pRight = pLeft + this.collisionWidth;
        const pTop = this.player.y - this.collisionHeight * oyv;
        const pBottom = pTop + this.collisionHeight;

        const currentCfg = sceneConfigs[this.currentBackground] || {};
        const now = Date.now();

        // skip all exit detection if still within the exit lock window after a scene switch
        if (Date.now() < this.exitLockedUntil) {
            // do nothing; locked
        } else {
            // check horizontal and vertical edges for allowed crossings
            const checkEdgeAndSwitch = (edgeDir, edgeCrossed, entryDir) => {
                if (edgeCrossed && currentCfg.neighbors && currentCfg.neighbors[edgeDir]) {
                    const dest = currentCfg.neighbors[edgeDir];
                    if (dest) {
                        const prev = this.currentBackground;
                        this.exitLockedUntil = Date.now() + this.exitLockDuration;
                        this.applySceneConfig(dest, { entry: entryDir, fromScene: prev });
                        console.log('Scene switch', prev, '->', dest, 'via', edgeDir, 'at', pLeft, pRight, pTop, pBottom);
                        return true;
                    }
                }
                return false;
            };

            // horizontal edges
            if (checkEdgeAndSwitch('right', pRight >= sceneRight - 1, 'fromLeft')) return;
            if (checkEdgeAndSwitch('left', pLeft <= sceneLeft + 1, 'fromRight')) return;

            // vertical edges
            if (checkEdgeAndSwitch('bottom', pBottom >= sceneBottom - 1, 'fromTop')) return;
            if (checkEdgeAndSwitch('top', pTop <= sceneTop + 1, 'fromBottom')) return;
        }

        if (vx < 0) this.player.setFlipX(true);
        else if (vx > 0) this.player.setFlipX(false);

        // squash/stretch when moving (lerp approach)
        if (vx !== 0 || vy !== 0) {
            this.targetScaleX = this.baseScaleX * 1.05;
            this.targetScaleY = this.baseScaleY * 0.95;
        } else {
            this.targetScaleX = this.baseScaleX;
            this.targetScaleY = this.baseScaleY;
        }

        // Smoothly interpolate current scales toward target scales
        const lerp = 0.12; // 0..1, lower = smoother
        this.player.scaleX = Phaser.Math.Linear(this.player.scaleX, this.targetScaleX, lerp);
        this.player.scaleY = Phaser.Math.Linear(this.player.scaleY, this.targetScaleY, lerp);

        // Redraw debug graphics every frame so blue box follows character
        this.drawObstacleDebug();

        if (this.debugMode && this.debugText) {
            const currentCfg = sceneConfigs[this.currentBackground] || {};
            const ox = (typeof this.player.originX === 'number') ? this.player.originX : 0.5;
            const oy = (typeof this.player.originY === 'number') ? this.player.originY : 0.5;
            
            const collisionBounds = {
                left: this.player.x - this.collisionWidth * ox,
                right: this.player.x - this.collisionWidth * ox + this.collisionWidth,
                top: this.player.y - this.collisionHeight * oy,
                bottom: this.player.y - this.collisionHeight * oy + this.collisionHeight
            };
            
            const displayBounds = {
                left: this.player.x - this.player.displayWidth * ox,
                right: this.player.x - this.player.displayWidth * ox + this.player.displayWidth,
                top: this.player.y - this.player.displayHeight * oy,
                bottom: this.player.y - this.player.displayHeight * oy + this.player.displayHeight
            };
            
            let debugLines = [
                `scene:${this.currentBackground}`,
                `pos:${Math.round(this.player.x)},${Math.round(this.player.y)}`,
                `collisionBox:${Math.round(collisionBounds.left)},${Math.round(collisionBounds.top)}-${Math.round(collisionBounds.right)},${Math.round(collisionBounds.bottom)}`,
                `displayBox:${Math.round(displayBounds.left)},${Math.round(displayBounds.top)}-${Math.round(displayBounds.right)},${Math.round(displayBounds.bottom)}`
            ];
            
            if (this.lastCollidingObstacle) {
                debugLines.push(`hitObstacle:${Math.round(this.lastCollidingObstacle.x)},${Math.round(this.lastCollidingObstacle.y)}`);
                debugLines.push(`obstacleSize:${Math.round(this.lastCollidingObstacle.width)}x${Math.round(this.lastCollidingObstacle.height)}`);
            }
            
            this.debugText.setText(debugLines);
        }

    }

    applySceneConfig(sceneKey, opts = {}) {
        const cfg = sceneConfigs[sceneKey];
        if (!cfg) return;
        this.currentBackground = sceneKey;
        
        // Update background texture and scale to match window width
        this.bg.setTexture(cfg.texture || cfg.key);
        this.bg.setScale(this.scaleFactor);
        this.bg.setPosition(this.worldWidth / 2, this.worldHeight / 2);
        
        // Update physics world bounds
        if (this.physics && this.physics.world) {
            this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
        }
        this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
        
        // Create scaled obstacles
        this.scaledObstacles = [];
        if (cfg.obstacles) {
            for (const obs of cfg.obstacles) {
                this.scaledObstacles.push({
                    ...obs,
                    x: obs.x * this.scaleFactor,
                    y: obs.y * this.scaleFactor,
                    width: obs.width * this.scaleFactor,
                    height: obs.height * this.scaleFactor
                });
            }
        }

        // Apply character scale if different from current scene
        const newSceneScale = cfg.characterScale || 1.0;
        if (this.currentSceneScale !== newSceneScale) {
            this.currentSceneScale = newSceneScale;
            // Resize sprite using stored base dimensions scaled by new scene scale
            if (this.baseDisplayWidth && this.baseDisplayHeight) {
                const newW = Math.round(this.baseDisplayWidth * newSceneScale);
                const newH = Math.round(this.baseDisplayHeight * newSceneScale);
                this.player.setDisplaySize(newW, newH);
                // Update collision dimensions to match resized sprite
                this.collisionWidth = newW * 1.05;
                this.collisionHeight = newH;
                // Update physics body if applicable
                if (this.usePhysics && this.player.body && this.player.body.setSize) {
                    this.player.body.setSize(newW, newH, true);
                }
                // CRITICAL: Update base scale values so the squash/stretch animation uses the new scale as baseline
                // Otherwise the update() loop will revert the sprite back to the old scale
                this.baseScaleX = this.player.scaleX;
                this.baseScaleY = this.player.scaleY;
                this.targetScaleX = this.baseScaleX;
                this.targetScaleY = this.baseScaleY;
            }
        }

        // decide spawn position based on entry direction
        const entry = opts.entry || 'start';
        const oxv = (typeof this.player.originX === 'number') ? this.player.originX : 0.5;

        // prefer explicit entryPositions if provided; otherwise derive edge-based center
        // Use the sprite's actual origin when computing centers so clamping is correct
        const ox = (typeof this.player.originX === 'number') ? this.player.originX : 0.5;
        const oy = (typeof this.player.originY === 'number') ? this.player.originY : 0.5;
        let intendedX = this.player.x;
        let intendedY = this.player.y;
        if (cfg.entryPositions && typeof cfg.entryPositions[entry] === 'function') {
            const pos = cfg.entryPositions[entry](this.worldWidth, this.worldHeight);
            if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
                intendedX = pos.x;
                intendedY = pos.y;
            }
        } else {
            // derive dynamic padding from player display size so larger characters spawn further from edges
            const padX = (cfg.entryPadX != null) ? cfg.entryPadX * this.scaleFactor : Math.max(Math.round(this.player.displayWidth * 0.5), 48);
            const padY = (cfg.entryPadY != null) ? cfg.entryPadY * this.scaleFactor : Math.max(Math.round(this.player.displayHeight * 0.5), 32);
            if (entry === 'fromRight') {
                // place sprite so its left edge is `padX` from world left: center = padX + displayWidth * ox
                intendedX = padX + (this.player.displayWidth * ox);
            } else if (entry === 'fromLeft') {
                // place sprite so its right edge is `padX` from world right: center = worldWidth - padX - displayWidth * (1-ox)
                intendedX = this.worldWidth - padX - (this.player.displayWidth * (1 - ox));
            } else if (entry === 'fromTop') {
                intendedY = padY + (this.player.displayHeight * oy);
            } else if (entry === 'fromBottom') {
                intendedY = this.worldHeight - padY - (this.player.displayHeight * (1 - oy));
            }
        }

        // Clamp the intended position so the collision bounds remain fully inside the world
        // compute min/max center positions such that left >= 0 and right <= worldWidth, respecting origin
        const minCenterX = (this.collisionWidth * ox);
        const maxCenterX = this.worldWidth - (this.collisionWidth * (1 - ox));
        const minCenterY = (this.collisionHeight * oy);
        const maxCenterY = this.worldHeight - (this.collisionHeight * (1 - oy));

        const finalX = Phaser.Math.Clamp(intendedX, minCenterX, maxCenterX);
        const finalY = Phaser.Math.Clamp(intendedY, minCenterY, maxCenterY);

        // Apply position in way that avoids body jumps (physics engine updates body next step)
        this.player.setPosition(finalX, finalY);

        // Set exit lock: after a scene switch, block further exits for a short duration
        // This prevents the player from immediately re-exiting through a nearby edge
        this.exitLockedUntil = Date.now() + this.exitLockDuration;

        // For physics players we avoid writing body internals; however, ensure
        // the collision bounds remain within bounds by checking them
        // and using setPosition() if needed (this lets the physics engine resolve
        // the body next step).
        if (this.usePhysics) {
            const ox = (typeof this.player.originX === 'number') ? this.player.originX : 0.5;
            const oy = (typeof this.player.originY === 'number') ? this.player.originY : 0.5;
            const left = this.player.x - this.collisionWidth * ox;
            const right = left + this.collisionWidth;
            const top = this.player.y - this.collisionHeight * oy;
            const bottom = top + this.collisionHeight;
            let nx = this.player.x, ny = this.player.y;
            if (left < 0) nx += -left;
            else if (right > this.worldWidth) nx += this.worldWidth - right;
            if (top < 0) ny += -top;
            else if (bottom > this.worldHeight) ny += this.worldHeight - bottom;
            if (nx !== this.player.x || ny !== this.player.y) {
                // move sprite visually; physics body will be updated by engine
                this.player.setPosition(nx, ny);
            }
        }

        // For physics-enabled player let Arcade Physics handle world bounds collisions.
        // We avoid manually setting body.position here because it can conflict
        // with the physics engine and cause jumps. The body was sized and
        // centered above, and `setCollideWorldBounds(true)` will prevent leaving.
        
        // Render NPCs for this scene
        this.renderNPCs(sceneKey);
        
        // Redraw debug obstacles when scene changes
        this.drawObstacleDebug();
    }

    checkObstacleCollisions() {
        const obstacles = this.scaledObstacles || [];

        if (obstacles.length === 0) return;

        const ox = (typeof this.player.originX === 'number') ? this.player.originX : 0.5;
        const oy = (typeof this.player.originY === 'number') ? this.player.originY : 0.5;
        
        const fullHeight = this.collisionHeight;
        const fullWidth = this.collisionWidth;
        const feetHeight = fullHeight * 0.1;
        const COLLISION_PADDING = 5;

        // Helper to check collision at position and return which obstacle with side info
        const checkCollisionAt = (x, y) => {
            const pLeft = x - fullWidth * ox;
            const pRight = pLeft + fullWidth;
            const pBottom = y + fullHeight * (1 - oy);
            const pFeetTop = pBottom - feetHeight;

            for (const obs of obstacles) {
                const feetOverlapsHorizontally = pRight > obs.x - COLLISION_PADDING && pLeft < obs.x + obs.width + COLLISION_PADDING;
                const feetOverlapsVertically = pBottom > obs.y - COLLISION_PADDING && pFeetTop < obs.y + obs.height + COLLISION_PADDING;
                if (feetOverlapsHorizontally && feetOverlapsVertically) {
                    // Determine which side of the obstacle was hit
                    const obsTop = obs.y;
                    const obsBottom = obs.y + obs.height;
                    const obsLeft = obs.x;
                    const obsRight = obs.x + obs.width;
                    
                    // Find which side the player is closest to
                    const distToTop = Math.abs(pBottom - obsTop);
                    const distToBottom = Math.abs(pFeetTop - obsBottom);
                    const distToLeft = Math.abs(pRight - obsLeft);
                    const distToRight = Math.abs(pLeft - obsRight);
                    
                    const minDist = Math.min(distToTop, distToBottom, distToLeft, distToRight);
                    let hitSide = 'unknown';
                    if (minDist === distToTop) hitSide = 'top';
                    else if (minDist === distToBottom) hitSide = 'bottom';
                    else if (minDist === distToLeft) hitSide = 'left';
                    else if (minDist === distToRight) hitSide = 'right';
                    
                    return { obstacle: obs, side: hitSide };
                }
            }
            return null;
        };

        const collision = checkCollisionAt(this.player.x, this.player.y);

        if (collision) {
            const collidingObstacle = collision.obstacle;
            const hitSide = collision.side;
            
            this.lastCollidingObstacle = collidingObstacle;
            
            // Check if this obstacle has an event trigger for this side
            if (collidingObstacle.eventTrigger && collidingObstacle.eventTrigger.side === hitSide) {
                if (collidingObstacle.eventTrigger.action === 'switchScene') {
                    const targetScene = collidingObstacle.eventTrigger.targetScene;
                    const entryDir = collidingObstacle.eventTrigger.entryDir || 'fromTop';
                    if (targetScene && sceneConfigs[targetScene]) {
                        const prev = this.currentBackground;
                        this.exitLockedUntil = Date.now() + this.exitLockDuration;
                        this.applySceneConfig(targetScene, { entry: entryDir, fromScene: prev });
                        console.log('Event trigger: Scene switch from', prev, 'to', targetScene, 'via', hitSide, 'of obstacle, entry:', entryDir);
                        return;
                    }
                } else if (collidingObstacle.eventTrigger.action === 'dialog') {
                    this.showDialog(collidingObstacle.eventTrigger.text);
                    // Don't return - let collision blocking continue below
                }
            }
            
            // Calculate obstacle center
            const obsCenter = {
                x: collidingObstacle.x + collidingObstacle.width / 2,
                y: collidingObstacle.y + collidingObstacle.height / 2
            };
            
            // Calculate if they're moving toward or away from obstacle
            const moveX = this.player.x - this.lastPlayerX;
            const moveY = this.player.y - this.lastPlayerY;
            
            // If not moving at all, push them away from obstacle center
            if (moveX === 0 && moveY === 0) {
                // Stuck - push away from obstacle center
                // Try pushing in primary direction first, then secondary
                let newX = this.player.x;
                let newY = this.player.y;
                const pushDist = 10;
                
                // Determine which direction to push (away from obstacle center)
                const deltaX = this.player.x - obsCenter.x;
                const deltaY = this.player.y - obsCenter.y;
                const distX = Math.abs(deltaX);
                const distY = Math.abs(deltaY);
                
                // Push along the axis with greater distance (most away from center)
                if (distX > distY) {
                    // Push horizontally
                    newX += deltaX > 0 ? pushDist : -pushDist;
                } else {
                    // Push vertically
                    newY += deltaY > 0 ? pushDist : -pushDist;
                }
                
                // Only apply push if it doesn't immediately hit another obstacle
                const testCollision = checkCollisionAt(newX, newY);
                if (!testCollision) {
                    this.player.x = newX;
                    this.player.y = newY;
                    console.log('  ACTION: PUSHED AWAY (stuck with no movement)');
                } else {
                    // Can't push in that direction, try perpendicular
                    newX = this.player.x;
                    newY = this.player.y;
                    if (distX > distY) {
                        // Tried horizontal, try vertical
                        newY += deltaY > 0 ? pushDist : -pushDist;
                    } else {
                        // Tried vertical, try horizontal
                        newX += deltaX > 0 ? pushDist : -pushDist;
                    }
                    const testCollision2 = checkCollisionAt(newX, newY);
                    if (!testCollision2) {
                        this.player.x = newX;
                        this.player.y = newY;
                        console.log('  ACTION: PUSHED AWAY (perpendicular, stuck with no movement)');
                    } else {
                        // Try all four cardinal directions to find any escape route
                        const directions = [
                            {x: pushDist, y: 0},
                            {x: -pushDist, y: 0},
                            {x: 0, y: pushDist},
                            {x: 0, y: -pushDist}
                        ];
                        let pushed = false;
                        for (const dir of directions) {
                            const testX = this.player.x + dir.x;
                            const testY = this.player.y + dir.y;
                            if (!checkCollisionAt(testX, testY)) {
                                this.player.x = testX;
                                this.player.y = testY;
                                console.log('  ACTION: PUSHED AWAY (cardinal direction escape)');
                                pushed = true;
                                break;
                            }
                        }
                        if (!pushed) {
                            console.log('  ACTION: STUCK (cannot push away safely)');
                        }
                    }
                }
            } else {
                const towardsObsX = moveX * (obsCenter.x - this.player.x);
                const towardsObsY = moveY * (obsCenter.y - this.player.y);
                
                // If moving toward obstacle, revert
                if (towardsObsX > 0 || towardsObsY > 0) {
                    console.log('  ACTION: BLOCKED (moving toward)');
                    // Moving toward - revert
                    this.player.x = this.lastPlayerX;
                    this.player.y = this.lastPlayerY;
                } else {
                    console.log('  ACTION: ALLOWED (moving away)');
                }
                // If moving away - allow the movement
            }
            
            if (this.usePhysics && this.player.body?.setVelocity) {
                this.player.setVelocity(0, 0);
            }
        }
    }

    drawObstacleDebug() {
        if (!this.debugGraphics) return;
        
        const obstacles = this.scaledObstacles || [];
        
        this.debugGraphics.clear();
        
        // Draw red obstacles
        if (this.debugMode && obstacles.length > 0) {
            this.debugGraphics.lineStyle(3, 0xff0000, 1); // Red outline, 3px thick
            this.debugGraphics.fillStyle(0xff0000, 0.2); // Red fill, 20% opacity
            
            for (const obs of obstacles) {
                this.debugGraphics.fillRect(obs.x, obs.y, obs.width, obs.height);
                this.debugGraphics.strokeRect(obs.x, obs.y, obs.width, obs.height);
            }
        }

        // Draw blue box around fixed collision bounds
        if (this.debugMode && this.player) {
            const ox = (typeof this.player.originX === 'number') ? this.player.originX : 0.5;
            const oy = (typeof this.player.originY === 'number') ? this.player.originY : 0.5;
            
            const pLeft = this.player.x - this.collisionWidth * ox;
            const pTop = this.player.y - this.collisionHeight * oy;
            
            this.debugGraphics.lineStyle(2, 0x0000ff, 1); // Blue outline, 2px thick
            this.debugGraphics.strokeRect(pLeft, pTop, this.collisionWidth, this.collisionHeight);
        }

        // Draw purple box around animated display bounds
        if (this.debugMode && this.player) {
            const ox = (typeof this.player.originX === 'number') ? this.player.originX : 0.5;
            const oy = (typeof this.player.originY === 'number') ? this.player.originY : 0.5;
            
            const pLeft = this.player.x - this.player.displayWidth * ox;
            const pTop = this.player.y - this.player.displayHeight * oy;
            
            this.debugGraphics.lineStyle(2, 0xff00ff, 1); // Purple outline, 2px thick
            this.debugGraphics.strokeRect(pLeft, pTop, this.player.displayWidth, this.player.displayHeight);
        }
    }

    renderNPCs(sceneKey) {
        const cfg = sceneConfigs[sceneKey];
        if (!cfg || !cfg.npcs) {
            // Clear existing NPCs if no NPCs in new scene
            Object.values(this.npcs).forEach(sprite => sprite.destroy());
            this.npcs = {};
            return;
        }

        // Clear NPCs from previous scene
        Object.values(this.npcs).forEach(sprite => sprite.destroy());
        this.npcs = {};

        // Get the scene's character scale
        const sceneScale = cfg.characterScale || 1.0;

        // Create NPCs for this scene
        for (const npcConfig of cfg.npcs) {
            if (!npcConfig.key) continue;
            
            // Create sprite for NPC at scaled position
            const npcX = npcConfig.x * this.scaleFactor;
            const npcY = npcConfig.y * this.scaleFactor;
            const npc = this.add.sprite(npcX, npcY, npcConfig.key);
            npc.setOrigin(0.5, 0.5);
            
            // Apply sizing logic: NPCs scale with the scene, then by their individual scale
            // npcConfig.scale: 1.0 = normal size for this scene; 0.8 = 80% of normal; 1.5 = 150% of normal
            const src = this.textures.get(npcConfig.key).getSourceImage();
            if (src && src.width && src.height) {
                const desiredH = 240 * this.scaleFactor; // base character height in pixels, scaled to screen
                const scale = desiredH / src.height;
                const baseW = src.width * scale;
                const baseH = src.height * scale;
                
                // Apply scene scale (affects all NPCs in scene uniformly) and NPC's individual scale
                const npcScale = npcConfig.scale || 1.0;
                const finalW = Math.round(baseW * sceneScale * npcScale);
                const finalH = Math.round(baseH * sceneScale * npcScale);
                npc.setDisplaySize(finalW, finalH);

                // Set NPC depth lower than player so player appears on top
                npc.setDepth(50);

                // Apply crop if specified (percentages: 0-100 for x,y,width,height)
                if (npcConfig.crop) {
                    const crop = npcConfig.crop;
                    // Convert percentages to source image pixels
                    const cropX = Math.round((crop.x || 0) / 100 * src.width);
                    const cropY = Math.round((crop.y || 0) / 100 * src.height);
                    const cropWidth = Math.round((crop.width || 100) / 100 * src.width);
                    const cropHeight = Math.round((crop.height || 100) / 100 * src.height);
                    npc.setCrop(cropX, cropY, cropWidth, cropHeight);
                }
            }

            this.npcs[npcConfig.key] = npc;
        }
    }

    showDialog(text) {
        if (this.isDialogOpen) return;

        this.isDialogOpen = true;
        // Use camera/screen dimensions for dialog positioning since it has scrollFactor(0)
        const screenWidth = this.cameras.main.width;
        const screenHeight = this.cameras.main.height;

        // Create semi-transparent background overlay
        this.dialogBox = this.add.rectangle(screenWidth / 2, screenHeight * 0.75, screenWidth * 0.8, 200, 0x000000, 0.7);
        this.dialogBox.setDepth(200);
        this.dialogBox.setScrollFactor(0);

        // Create dialog text
        this.dialogText = this.add.text(screenWidth / 2, screenHeight * 0.75, text, {
            fontSize: this.getScaledFontSize(screenWidth, 0.04), // 4% of screen width
            fontStyle: 'bold',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: screenWidth * 0.75 }
        });
        this.dialogText.setOrigin(0.5, 0.5);
        this.dialogText.setDepth(201);
        this.dialogText.setScrollFactor(0);

        // Close dialog on any click or key press (with delay to avoid closing on same click)
        this.time.delayedCall(100, () => {
            const closeDialog = () => {
                this.closeDialog();
                this.input.off('pointerdown', closeDialog);
                this.input.keyboard.off('keydown', closeDialog);
            };

            this.input.once('pointerdown', closeDialog);
            this.input.keyboard.once('keydown', closeDialog);
        });
    }

    closeDialog() {
        if (!this.isDialogOpen) return;

        this.isDialogOpen = false;
        if (this.dialogBox) {
            this.dialogBox.destroy();
            this.dialogBox = null;
        }
        if (this.dialogText) {
            this.dialogText.destroy();
            this.dialogText = null;
        }
    }

    handleResize(gameSize) {
        // Recalculate scale factor based on new canvas size
        const canvasWidth = gameSize.width;
        const gameWidth = this.game.config.width;
        const newScaleFactor = canvasWidth / gameWidth;
        
        // Only update if scale factor actually changed
        if (Math.abs(newScaleFactor - this.scaleFactor) > 0.001) {
            this.scaleFactor = newScaleFactor;
            
            // Update world dimensions
            const gameHeight = this.game.config.height;
            this.worldWidth = gameWidth * this.scaleFactor;
            this.worldHeight = gameHeight * this.scaleFactor;
            
            // Update background
            this.bg.setScale(this.scaleFactor);
            this.bg.setPosition(this.worldWidth / 2, this.worldHeight / 2);
            
            // Update physics world bounds
            if (this.physics && this.physics.world) {
                this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
            }
            
            // Update camera bounds
            this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
            
            // Rescale obstacles
            this.scaledObstacles = [];
            const currentCfg = sceneConfigs[this.currentBackground] || {};
            if (currentCfg.obstacles) {
                for (const obs of currentCfg.obstacles) {
                    this.scaledObstacles.push({
                        ...obs,
                        x: obs.x * this.scaleFactor,
                        y: obs.y * this.scaleFactor,
                        width: obs.width * this.scaleFactor,
                        height: obs.height * this.scaleFactor
                    });
                }
            }
            
            // Reposition player if they're outside new bounds
            const margin = 50;
            this.player.x = Phaser.Math.Clamp(this.player.x, margin, this.worldWidth - margin);
            this.player.y = Phaser.Math.Clamp(this.player.y, margin, this.worldHeight - margin);
            
            // Rescale player character using same logic as create method
            const src = this.textures.get(this.selected).getSourceImage();
            if (src && src.width && src.height) {
                // Use same calculation as create method, but scale desiredH with screen size
                const desiredH = 240 * newScaleFactor; // base doubled player height in pixels, scaled to screen
                const scale = desiredH / src.height;
                const baseW = src.width * scale;
                const baseH = src.height * scale;

                // Update stored base dimensions
                this.baseDisplayWidth = baseW;
                this.baseDisplayHeight = baseH;

                // Apply current scene scale
                const currentCfg = sceneConfigs[this.currentBackground] || {};
                const sceneScale = currentCfg.characterScale || 1.0;
                const newW = Math.round(baseW * sceneScale);
                const newH = Math.round(baseH * sceneScale);

                this.player.setDisplaySize(newW, newH);
                // Update collision dimensions
                this.collisionWidth = newW * 1.05;
                this.collisionHeight = newH;
                // Update physics body if applicable
                if (this.usePhysics && this.player.body && this.player.body.setSize) {
                    this.player.body.setSize(newW, newH, true);
                }
                // Update scale values for animation
                this.baseScaleX = this.player.scaleX;
                this.baseScaleY = this.player.scaleY;
                this.targetScaleX = this.baseScaleX;
                this.targetScaleY = this.baseScaleY;
            }
            
            // Rescale and reposition NPCs
            const sceneConfig = sceneConfigs[this.currentBackground] || {};
            const sceneScale = sceneConfig.characterScale || 1.0;
            for (const npcKey in this.npcs) {
                const npc = this.npcs[npcKey];
                if (npc && npc.texture) {
                    const npcConfig = sceneConfig.npcs?.find(n => n.key === npcKey);
                    if (npcConfig) {
                        // Reposition NPC
                        const newNpcX = npcConfig.x * this.scaleFactor;
                        const newNpcY = npcConfig.y * this.scaleFactor;
                        npc.setPosition(newNpcX, newNpcY);
                        
                        const src = this.textures.get(npcKey).getSourceImage();
                        if (src && src.width && src.height) {
                            const desiredH = 240 * newScaleFactor; // base character height in pixels, scaled to screen
                            const scale = desiredH / src.height;
                            const baseW = src.width * scale;
                            const baseH = src.height * scale;
                            
                            const npcScale = npcConfig.scale || 1.0;
                            const finalW = Math.round(baseW * sceneScale * npcScale);
                            const finalH = Math.round(baseH * sceneScale * npcScale);
                            npc.setDisplaySize(finalW, finalH);
                            
                            // Reapply crop if specified
                            if (npcConfig.crop) {
                                const crop = npcConfig.crop;
                                const cropX = Math.round((crop.x || 0) / 100 * src.width);
                                const cropY = Math.round((crop.y || 0) / 100 * src.height);
                                const cropWidth = Math.round((crop.width || 100) / 100 * src.width);
                                const cropHeight = Math.round((crop.height || 100) / 100 * src.height);
                                npc.setCrop(cropX, cropY, cropWidth, cropHeight);
                            }
                        }
                    }
                }
            }
            
            console.log(`Resized to ${canvasWidth}x${gameSize.height}, scale: ${this.scaleFactor.toFixed(3)}`);
        }
        
        // Update dialog elements if they exist
        if (this.isDialogOpen && this.dialogBox && this.dialogText) {
            const screenWidth = this.cameras.main.width;
            const screenHeight = this.cameras.main.height;
            
            // Update dialog box size and position
            this.dialogBox.setPosition(screenWidth / 2, screenHeight * 0.75);
            this.dialogBox.setSize(screenWidth * 0.8, 200);
            
            // Update dialog text position, font size, and word wrap
            this.dialogText.setPosition(screenWidth / 2, screenHeight * 0.75);
            
            // Safely update font size with error handling
            try {
                const newFontSize = this.getScaledFontSize(screenWidth, 0.04);
                if (newFontSize && parseInt(newFontSize) > 0) {
                    this.dialogText.setFontSize(newFontSize);
                }
            } catch (error) {
                console.warn('Failed to update dialog font size:', error);
            }
            
            this.dialogText.setWordWrapWidth(screenWidth * 0.75);
        }
    }

    drawObstacleDebug() {
        if (!this.debugGraphics) return;
        
        const obstacles = this.scaledObstacles || [];
        
        this.debugGraphics.clear();
        
        // Draw red obstacles
        if (this.debugMode && obstacles.length > 0) {
            this.debugGraphics.lineStyle(3, 0xff0000, 1); // Red outline, 3px thick
            this.debugGraphics.fillStyle(0xff0000, 0.2); // Red fill, 20% opacity
            
            for (const obs of obstacles) {
                this.debugGraphics.fillRect(obs.x, obs.y, obs.width, obs.height);
                this.debugGraphics.strokeRect(obs.x, obs.y, obs.width, obs.height);
            }
        }

        // Draw blue box around fixed collision bounds
        if (this.debugMode && this.player) {
            const ox = (typeof this.player.originX === 'number') ? this.player.originX : 0.5;
            const oy = (typeof this.player.originY === 'number') ? this.player.originY : 0.5;
            
            const pLeft = this.player.x - this.collisionWidth * ox;
            const pTop = this.player.y - this.collisionHeight * oy;
            
            this.debugGraphics.lineStyle(2, 0x0000ff, 1); // Blue outline, 2px thick
            this.debugGraphics.strokeRect(pLeft, pTop, this.collisionWidth, this.collisionHeight);
        }

        // Draw purple box around animated display bounds
        if (this.debugMode && this.player) {
            const ox = (typeof this.player.originX === 'number') ? this.player.originX : 0.5;
            const oy = (typeof this.player.originY === 'number') ? this.player.originY : 0.5;
            
            const pLeft = this.player.x - this.player.displayWidth * ox;
            const pTop = this.player.y - this.player.displayHeight * oy;
            
            this.debugGraphics.lineStyle(2, 0xff00ff, 1); // Purple outline, 2px thick
            this.debugGraphics.strokeRect(pLeft, pTop, this.player.displayWidth, this.player.displayHeight);
        }
    }

    destroy() {
        // Clean up resize listener
        if (this.scale && this.scale.off) {
            this.scale.off('resize', this.handleResize, this);
        }
        super.destroy();
    }

    getScaledFontSize(screenWidth, percentage) {
        return Math.round(screenWidth * percentage) + 'px';
    }
}

