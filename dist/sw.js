// Service Worker – keeps the critical shell files cached for offline use.
// Increment CACHE_VERSION every time any asset in `urlsToCache` changes.

const CACHE_VERSION = 'v5';
const CACHE_NAME = `healthy-habits-cache-${CACHE_VERSION}`;

// Only add truly critical, lightweight assets here. Large images should rely on network fallback.
const urlsToCache = [
  '/',
  '/index.html',
  '/public/styles/style.css',
  '/public/styles/components.css',
  '/src/main.js',
  '/assets/manifest.json',
      // Touch icons
    '/assets/icons/apple-touch-icon.png',
    '/assets/icons/apple-touch-icon-120x120.png',
    '/assets/icons/apple-touch-icon-120x120-precomposed.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
            return undefined;
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // For navigation requests let the network win first (fresh content) but fall back to cache.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Stale-while-revalidate strategy for same-origin assets & images
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((resp) => {
          // clone & store only successful same-origin GETs
          if (resp && resp.status === 200 && resp.type === 'basic') {
            const respClone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone));
          }
          return resp;
        })
        .catch(() => {});
      // return cached response immediately if present, else wait for network
      return cached || fetchPromise;
    })
  );
}); 