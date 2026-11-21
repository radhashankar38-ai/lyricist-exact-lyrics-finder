
const CACHE_NAME = 'lyricist-v1.1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  // External resources required for offline functionality
  'https://cdn.tailwindcss.com',
  'https://cdn-icons-png.flaticon.com/512/461/461238.png',
  // React & GenAI Dependencies (from import map)
  'https://aistudiocdn.com/react-dom@^19.2.0/',
  'https://aistudiocdn.com/@google/genai@^1.30.0',
  'https://aistudiocdn.com/react@^19.2.0/',
  'https://aistudiocdn.com/react@^19.2.0',
  'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.mjs'
];

// Install SW
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Listen for requests
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true })
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          (response) => {
            // Check if we received a valid response.
            // We allow opaque responses (status 0, type 'opaque') for CDNs.
            if (!response || (response.status !== 200 && response.type !== 'opaque')) {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                // Only cache GET requests
                if (event.request.method === 'GET') {
                    cache.put(event.request, responseToCache);
                }
              });

            return response;
          }
        );
      })
  );
});

// Activate the SW
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
