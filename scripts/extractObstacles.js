#!/usr/bin/env node
/**
 * Extract obstacle bounding boxes from red-masked scene images
 * Usage: node scripts/extractObstacles.js <path-to-mask-image> [sceneName] [gameWidth] [gameHeight]
 * Example: node scripts/extractObstacles.js assets/backgrounds/masks/grass.png grass 1280 720
 */

const Jimp = require('jimp');
const path = require('path');

async function extractObstacles(imagePath, sceneName = 'unknown', gameWidth = 1280, gameHeight = 720) {
    try {
        // Load the mask image
        let image = await Jimp.read(imagePath);
        const origWidth = image.bitmap.width;
        const origHeight = image.bitmap.height;

        console.log(`\nAnalyzing ${imagePath} (${origWidth}x${origHeight})`);
        console.log(`Scene: ${sceneName}, Game viewport: ${gameWidth}x${gameHeight}`);

        // Scale image to game viewport size if needed
        if (origWidth !== gameWidth || origHeight !== gameHeight) {
            console.log(`Scaling from ${origWidth}x${origHeight} to ${gameWidth}x${gameHeight}...\n`);
            image = image.resize(gameWidth, gameHeight, Jimp.RESIZE_NEAREST_NEIGHBOR);
        } else {
            console.log('');
        }

        const width = image.bitmap.width;
        const height = image.bitmap.height;

        // Track visited pixels to avoid duplicate rectangles
        const visited = new Set();
        let redObstacles = [];
        let greenObstacles = [];

        // Helper: convert x,y to index
        const idx = (x, y) => y * width + x;
        const isVisited = (x, y) => visited.has(idx(x, y));
        const markVisited = (x, y) => visited.add(idx(x, y));

        // Helper: check if pixel is red (#ed1c23) - blocking obstacles
        const isRed = (x, y) => {
            if (x < 0 || x >= width || y < 0 || y >= height) return false;
            const pixelIdx = Jimp.intToRGBA(image.getPixelColor(x, y));
            const r = pixelIdx.r;
            const g = pixelIdx.g;
            const b = pixelIdx.b;
            // Target: #ed1c23 = RGB(237, 28, 35)
            // Allow some tolerance for compression/scaling artifacts
            const tolerance = 20;
            return Math.abs(r - 237) < tolerance && 
                   Math.abs(g - 28) < tolerance && 
                   Math.abs(b - 35) < tolerance;
        };

        // Helper: check if pixel is green (#21b04c) - safe obstacles (trigger events only, no collision)
        const isGreen = (x, y) => {
            if (x < 0 || x >= width || y < 0 || y >= height) return false;
            const pixelIdx = Jimp.intToRGBA(image.getPixelColor(x, y));
            const r = pixelIdx.r;
            const g = pixelIdx.g;
            const b = pixelIdx.b;
            // Target: #21b04c = RGB(33, 176, 76)
            // Allow some tolerance for compression/scaling artifacts
            const tolerance = 20;
            return Math.abs(r - 33) < tolerance && 
                   Math.abs(g - 176) < tolerance && 
                   Math.abs(b - 76) < tolerance;
        };

        // Flood fill to find connected components of colored pixels
        const floodFill = (startX, startY, colorCheck) => {
            const queue = [{x: startX, y: startY}];
            let minX = startX, maxX = startX, minY = startY, maxY = startY;
            
            while (queue.length > 0) {
                const {x, y} = queue.shift();
                
                if (x < 0 || x >= width || y < 0 || y >= height) continue;
                if (isVisited(x, y) || !colorCheck(x, y)) continue;
                
                markVisited(x, y);
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
                
                // Add neighbors (4-connected)
                queue.push({x: x + 1, y});
                queue.push({x: x - 1, y});
                queue.push({x, y: y + 1});
                queue.push({x, y: y - 1});
            }
            
            return {
                x: minX,
                y: minY,
                width: maxX - minX + 1,
                height: maxY - minY + 1
            };
        };

        // Find all red obstacles (blocking)
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (!isVisited(x, y) && isRed(x, y)) {
                    const rect = floodFill(x, y, isRed);
                    redObstacles.push(rect);
                }
            }
        }

        // Find all green obstacles (safe, trigger events only)
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (!isVisited(x, y) && isGreen(x, y)) {
                    const rect = floodFill(x, y, isGreen);
                    greenObstacles.push(rect);
                }
            }
        }

        // Sort by position (top-to-bottom, left-to-right) for readability
        redObstacles.sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
        });

        greenObstacles.sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
        });

        console.log(`\nRaw blocking rectangles from flood-fill (${redObstacles.length}):`);
        redObstacles.forEach((obs, idx) => {
            console.log(`[${idx}] x: ${obs.x}, y: ${obs.y}, width: ${obs.width}, height: ${obs.height}`);
        });

        console.log(`\nRaw safe rectangles from flood-fill (${greenObstacles.length}):`);
        greenObstacles.forEach((obs, idx) => {
            console.log(`[${idx}] x: ${obs.x}, y: ${obs.y}, width: ${obs.width}, height: ${obs.height}`);
        });
        // Filter out very small obstacles
        const MIN_AREA = 500;
        const MIN_HEIGHT = 30;
        const cleaned = redObstacles.filter(obs => obs.width * obs.height >= MIN_AREA && obs.height >= MIN_HEIGHT);
        const cleanedSafe = greenObstacles.filter(obs => obs.width * obs.height >= MIN_AREA && obs.height >= MIN_HEIGHT);

        console.log(`\nBlocking obstacles - Cleaned rectangles before merging (${cleaned.length}):`);
        cleaned.forEach((obs, idx) => {
            console.log(`[${idx}] x: ${obs.x}, y: ${obs.y}, width: ${obs.width}, height: ${obs.height}`);
        });

        console.log(`\nSafe obstacles (no collision, trigger events) - Cleaned rectangles (${cleanedSafe.length}):`);
        cleanedSafe.forEach((obs, idx) => {
            console.log(`[${idx}] x: ${obs.x}, y: ${obs.y}, width: ${obs.width}, height: ${obs.height}`);
        });

        // Output raw rectangles without merging
        const obstacles_final = cleaned;
        const safeObstacles_final = cleanedSafe;

        // Sort obstacles by position
        obstacles_final.sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
        });

        safeObstacles_final.sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
        });

        // Output results
        console.log(`Found ${obstacles_final.length} blocking obstacles:\n`);
        obstacles_final.forEach((obs, idx) => {
            console.log(`[${idx}] x: ${obs.x}, y: ${obs.y}, width: ${obs.width}, height: ${obs.height}`);
        });

        console.log(`\nFound ${safeObstacles_final.length} safe obstacles (no collision, trigger events):\n`);
        safeObstacles_final.forEach((obs, idx) => {
            console.log(`[${idx}] x: ${obs.x}, y: ${obs.y}, width: ${obs.width}, height: ${obs.height}`);
        });

        console.log('\nFor sceneConfigs.js:');
        console.log(`\nobstacles: [`);
        obstacles_final.forEach((obs, idx) => {
            const comma = idx < obstacles_final.length - 1 ? ',' : '';
            console.log(`  { x: ${obs.x}, y: ${obs.y}, width: ${obs.width}, height: ${obs.height} }${comma}`);
        });
        console.log(`]`);

        console.log(`\nsafeObstacles: [`);
        safeObstacles_final.forEach((obs, idx) => {
            const comma = idx < safeObstacles_final.length - 1 ? ',' : '';
            console.log(`  { x: ${obs.x}, y: ${obs.y}, width: ${obs.width}, height: ${obs.height} }${comma}`);
        });
        console.log(`]`);

        console.log('\n---\n');

    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
    console.log('Usage: node scripts/extractObstacles.js <path-to-mask-image> [sceneName] [gameWidth] [gameHeight]');
    console.log('Example: node scripts/extractObstacles.js assets/backgrounds/masks/grass.png grass 1280 720');
    process.exit(1);
}

const imagePath = args[0];
const sceneName = args[1] || path.basename(imagePath, path.extname(imagePath));
const gameWidth = parseInt(args[2]) || 1280;
const gameHeight = parseInt(args[3]) || 720;

extractObstacles(imagePath, sceneName, gameWidth, gameHeight);
