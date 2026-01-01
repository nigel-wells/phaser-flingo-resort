const Jimp = require('jimp');

// Get target dimensions from command line or use defaults
const gameWidth = parseInt(process.argv[2]) || 1280;
const gameHeight = parseInt(process.argv[3]) || 720;

const maskPath = './assets/backgrounds/masks/grass.png';

async function extractObstacles() {
    try {
        const image = await Jimp.read(maskPath);
        const scaledImage = await image.resize(gameWidth, gameHeight);
        
        // Scan for red pixels
        const redPixels = new Set();
        scaledImage.scan(0, 0, scaledImage.width, scaledImage.height, (x, y, idx) => {
            const red = scaledImage.bitmap.data[idx];
            const green = scaledImage.bitmap.data[idx + 1];
            const blue = scaledImage.bitmap.data[idx + 2];
            
            // Red: high R, low G, low B
            if (red > 200 && green < 100 && blue < 100) {
                redPixels.add(`${x},${y}`);
            }
        });
        
        console.log(`Found ${redPixels.size} red pixels in scaled image (${gameWidth}x${gameHeight})`);
        
        // Group red pixels into bounding rectangles using flood fill
        const visited = new Set();
        const obstacles = [];
        
        for (const pixelStr of redPixels) {
            if (visited.has(pixelStr)) continue;
            
            const [startX, startY] = pixelStr.split(',').map(Number);
            const region = floodFill(startX, startY, redPixels, visited);
            
            if (region.length > 0) {
                const bbox = getBoundingBox(region);
                obstacles.push(bbox);
            }
        }
        
        // Filter out very small obstacles (likely noise)
        const MIN_AREA = 500; // 500 sq pixels minimum
        const filtered = obstacles.filter(obs => obs.width * obs.height >= MIN_AREA);
        
        console.log(`\nFiltered to ${filtered.length} obstacles (min area: ${MIN_AREA} sq px):\n`);
        
        // Sort by position (top to bottom, left to right) for readability
        filtered.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
        
        // Output as sceneConfigs format
        console.log('obstacles: [');
        filtered.forEach((obs, i) => {
            console.log(`  { x: ${obs.x}, y: ${obs.y}, width: ${obs.width}, height: ${obs.height} }${i < filtered.length - 1 ? ',' : ''}`);
        });
        console.log(']');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

function floodFill(startX, startY, redPixels, visited) {
    const region = [];
    const queue = [[startX, startY]];
    
    while (queue.length > 0) {
        const [x, y] = queue.shift();
        const key = `${x},${y}`;
        
        if (visited.has(key) || !redPixels.has(key)) continue;
        visited.add(key);
        region.push([x, y]);
        
        // Add neighbors (4-way connectivity)
        queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    
    return region;
}

function getBoundingBox(region) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    region.forEach(([x, y]) => {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    });
    
    return {
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.round(maxX - minX + 1),
        height: Math.round(maxY - minY + 1)
    };
}

extractObstacles();
