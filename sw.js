const CACHE_NAME = 'rajesh-fish-market-v2';
const STATIC_CACHE = 'static-v2';
const DYNAMIC_CACHE = 'dynamic-v2';

const urlsToCache = [
  '/',
  '/manifest.json',
  '/images/qr.png',
  '/images/fish/placeholder.jpg'
];

const API_CACHE_PATTERNS = [
  /\/api\/fishes/,
  /\/api\/rates/,
  /\/api\/shop/
];

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => {
        console.log('Caching static assets');
        return cache.addAll(urlsToCache);
      }),
      caches.open(DYNAMIC_CACHE)
    ])
  );
  self.skipWaiting();
});

// Fetch event with advanced caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle different types of requests
  if (request.method === 'GET') {
    // Static assets - Cache First
    if (urlsToCache.some(cacheUrl => request.url.includes(cacheUrl))) {
      event.respondWith(cacheFirst(request));
    }
    // API requests - Network First with fallback
    else if (API_CACHE_PATTERNS.some(pattern => pattern.test(request.url))) {
      event.respondWith(networkFirst(request));
    }
    // Other requests - Stale While Revalidate
    else {
      event.respondWith(staleWhileRevalidate(request));
    }
  } else {
    // Non-GET requests - Network only
    event.respondWith(fetch(request));
  }
});

// Cache First Strategy
async function cacheFirst(request) {
  const cached = await caches.match(request);
  return cached || fetch(request);
}

// Network First Strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html') || new Response('Offline', { status: 503 });
    }
    throw error;
  }
}

// Stale While Revalidate Strategy
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });

  return cached || fetchPromise;
}

// Activate event
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
});

// Background sync for offline orders
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  // Handle offline orders when connection is restored
  return new Promise((resolve) => {
    // Implementation for syncing offline data
    resolve();
  });
}
