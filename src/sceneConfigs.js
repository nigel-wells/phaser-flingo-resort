export const sceneConfigs = {
  'grass': {
    key: 'grass',
    texture: 'grass',
    // spawn offsets when entering from a direction (legacy)
    entryOffsets: {
      fromLeft: { x: 16 },
      fromRight: { x: -16 }
    },
    // explicit entry positions: functions receive (sceneWidth, sceneHeight)
    entryPositions: {
      fromLeft: (w, h) => ({ x: 16, y: Math.round(h * 0.5) }),
      fromRight: (w, h) => ({ x: w - 16, y: Math.round(h * 0.55) }),
      fromTop: (w, h) => ({ x: Math.round(w * 0.5), y: 16 }),
      fromBottom: (w, h) => ({ x: 768, y: 479 + 16 }) // From resort-reception, positioned under 3rd obstacle
    },
    // which sides allow exiting this scene
    allowedExits: ['right'],
    // map from direction to neighboring scene key (for generic routing)
    neighbors: {
      left: null,
      right: 'resort-outside',
      top: null,
      bottom: null
    },
    // obstacles that block player movement (from mask analysis at 1536x1024)
    // Extracted with horizontal rectangle scanning using #ed1c23 precise color detection
    obstacles: [
      { x: 0, y: 0, width: 520, height: 369 },
      { x: 523, y: 0, width: 366, height: 158 },
      { x: 893, y: 0, width: 643, height: 395 },
      { x: 1154, y: 686, width: 382, height: 338 },
      { x: 0, y: 736, width: 293, height: 288 }
    ],
    // character scale for this scene (1.0 = default)
    characterScale: 1.0,
    // optional boundaries override (defaults to canvas size)
    bounds: null
  },
  'resort-outside': {
    key: 'resort-outside',
    texture: 'resort-outside',
    entryOffsets: {
      fromLeft: { x: 16 },
      fromRight: { x: -16 }
    },
    entryPositions: {
      fromLeft: (w, h) => ({ x: 16, y: Math.round(h * 0.5) }),
      fromRight: (w, h) => ({ x: w - 16, y: Math.round(h * 0.6) }),
      fromTop: (w, h) => ({ x: Math.round(w * 0.5), y: 479 }),
      fromBottom: (w, h) => ({ x: Math.round(w * 0.5), y: h - 16 })
    },
    // only allow exiting to the left from this scene
    allowedExits: ['left'],
    // map from direction to neighboring scene key
    neighbors: {
      left: 'grass',
      right: null,
      top: null,
      bottom: null
    },
    // obstacles that block player movement (from mask analysis at 1536x1024)
    obstacles: [
      { x: 0, y: 0, width: 206, height: 464 },
      { x: 215, y: 0, width: 475, height: 585 },
      { x: 695, y: 0, width: 146, height: 479, eventTrigger: { side: 'bottom', action: 'switchScene', targetScene: 'resort-reception', entryDir: 'fromTop' } },
      { x: 846, y: 0, width: 690, height: 586 },
      { x: 1226, y: 696, width: 310, height: 269 },
      { x: 0, y: 711, width: 493, height: 313 }
    ],
    // character scale for this scene (80% size)
    characterScale: 0.6,
    bounds: null
  },
  'resort-reception': {
    key: 'resort-reception',
    texture: 'resort-reception',
    entryOffsets: {
      fromLeft: { x: 16 },
      fromRight: { x: -16 }
    },
    entryPositions: {
      fromLeft: (w, h) => ({ x: 16, y: Math.round(h * 0.5) }),
      fromRight: (w, h) => ({ x: w - 16, y: Math.round(h * 0.55) }),
      fromTop: (w, h) => ({ x: 768, y: h - 16 }), // Entering from resort-outside, appear at bottom
      fromBottom: (w, h) => ({ x: Math.round(w * 0.5), y: h - 16 })
    },
    // allow exiting to the bottom (back to resort-outside)
    allowedExits: ['bottom'],
    // map from direction to neighboring scene key
    neighbors: {
      left: null,
      right: 'resort-pool',
      top: null,
      bottom: 'resort-outside'
    },
    // obstacles from red mask analysis at 1536x1024
    obstacles: [
      { x: 0, y: 3, width: 1536, height: 477, eventTrigger: { side: 'bottom', action: 'dialog', text: 'Hello! Welcome to the Flingo Resort reception!' } },
      { x: 1029, y: 488, width: 507, height: 186 },
      { x: 0, y: 494, width: 521, height: 530 },
      { x: 1029, y: 783, width: 507, height: 241 }
    ],
    // character scale for this scene (80% size, same as resort-outside)
    characterScale: 1.5,
    // NPCs and interactive objects in this scene
    npcs: [
      {
        key: 'flingo',
        x: 768,
        y: 310,
        scale: 0.7,
        interactive: true,
        dialog: 'Hello! Welcome to the Flingo Resort reception!',
        crop: {
          x: 0,
          y: 0,
          width: 100,
          height: 75
        }
      }
    ],
    bounds: null
  },
  'resort-pool': {
    key: 'resort-pool',
    texture: 'resort-pool',
    entryOffsets: {
      fromLeft: { x: 16 },
      fromRight: { x: -16 }
    },
    entryPositions: {
      fromLeft: (w, h) => ({ x: 16, y: Math.round(h * 0.5) }),
      fromRight: (w, h) => ({ x: w - 16, y: Math.round(h * 0.6) }),
      fromTop: (w, h) => ({ x: Math.round(w * 0.5), y: h - 16 }), // Entering from resort-reception, appear at bottom
      fromBottom: (w, h) => ({ x: Math.round(w * 0.5), y: 16 })
    },
    // allow exiting to the left (back to resort-reception)
    allowedExits: ['left'],
    // map from direction to neighboring scene key
    neighbors: {
      left: 'resort-reception',
      right: null,
      top: null,
      bottom: null
    },
    // obstacles from red mask analysis at 1536x1024 (to be extracted from resort-pool.png mask)
    obstacles: [],
    // character scale for this scene
    characterScale: 1.0,
    // NPCs and interactive objects in this scene
    npcs: [],
    bounds: null
  }
};
