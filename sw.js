const CACHE_NAME = 'flingo-resort-v7';
const urlsToCache = [
  '/',
  '/index.html',
  '/phaser.js',
  '/src/main.js',
  '/src/sceneConfigs.js',
  '/src/scenes/Start.js',
  '/src/scenes/TitleScene.js',
  '/src/scenes/CharacterSelect.js',
  '/src/scenes/PlayScene.js',
  '/manifest.json',
  '/assets/backgrounds/grass.png',
  '/assets/backgrounds/resort-outside.png',
  '/assets/backgrounds/resort-reception.png',
  '/assets/backgrounds/resort-pool.png',
  '/assets/characters/boy1.png',
  '/assets/characters/boy2.png',
  '/assets/characters/girl1.png',
  '/assets/characters/girl2.png',
  '/assets/characters/flingo.png'
];

// Install event - cache all assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // Immediately activate the new service worker instead of waiting
        self.skipWaiting();
      })
  );
});

// Fetch event - serve from cache when offline, but skip IPC/plugin requests
self.addEventListener('fetch', event => {
  // Skip IPC/plugin requests that start with http://ipc.localhost
  if (event.request.url.startsWith('http://ipc.localhost')) {
    return; // Don't intercept these requests
  }

  // Only cache GET requests
  if (event.request.method !== 'GET') {
    return; // Don't cache POST, PUT, etc.
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});

// Activate event - clean up old caches and claim all clients
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Immediately claim all clients so they use the new service worker
      return self.clients.claim();
    })
  );
});

// Listen for messages from the main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    // Notify all clients that they should reload
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'RELOAD_PAGE' });
      });
    });
  }
});