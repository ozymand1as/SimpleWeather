const CACHE_NAME = 'weather-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install: cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: return cached files, fallback to network
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request)
      .then(res => res || fetch(e.request))
  );
});

// Background sync: update weather data
self.addEventListener('periodicsync', async (event) => {
  if (event.tag === 'update-weather') {
    try {
      console.log('🔁 Background sync: fetching weather');

      // Use last known location (stored in localStorage via app)
      const lastLocStr = await getCachedLastLocation();
      const { lat = 51.5074, lon = -0.1278 } = lastLocStr ? JSON.parse(lastLocStr) : {};

      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation&forecast_hours=24&timezone=auto`
      );

      if (res.ok) {
        const data = await res.json();
        const cache = await caches.open('weather-data');
        await cache.put('/cached-weather.json', new Response(JSON.stringify({
          data,
          timestamp: Date.now()
        })));
        console.log('🌤️ Weather updated in background');
      }
    } catch (err) {
      console.error('Background sync failed:', err);
    }
    event.waitUntil();
  }
});

// Helper: get last location from cache (simulated)
async function getCachedLastLocation() {
  // This is a workaround — real app would use IndexedDB
  // For now, assume we don't have it in SW
  return null;
}