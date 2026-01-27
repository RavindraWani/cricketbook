const CACHE_NAME = 'cricketbook-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/scorer.html',
  '/livescore.html',
  '/matches.html',
  '/allmatches.html',
  '/admin.html',
  '/about.html'
];

// Install event - cache files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.log('Cache install failed:', err);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - cache-first strategy for better performance
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Use network-first for Firebase API calls
  if (url.hostname.includes('firebasedatabase') || url.hostname.includes('googleapis')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }
  
  // Cache-first for static assets (HTML, CSS, JS)
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version immediately and update cache in background
          fetch(request).then((response) => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, response);
              });
            }
          }).catch(() => {});
          return cachedResponse;
        }

        // No cache, fetch from network
        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        }).catch(() => {
          // Network failed, return offline page if available
          if (request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
