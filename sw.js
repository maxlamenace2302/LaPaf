/* ============================================================
   La Petite Auberge de Flo — Service Worker
   ============================================================
   Two responsibilities:
   1. Cache the "app shell" (HTML/CSS/JS/icons) so the dashboard
      opens instantly and works offline.
   2. Let Supabase requests pass through untouched — we always
      want fresh reservation data when online.

   When you ship a new version, bump CACHE_VERSION below — the
   old cache is then deleted on the next page load.
============================================================ */

const CACHE_VERSION = 'auberge-flo-v1';

// "App shell" — the static files that make up the dashboard UI.
// Anything not in this list is fetched live (and cached on demand).
const APP_SHELL = [
  '/',
  '/admin.html',
  '/admin.css',
  '/styles.css',
  '/supabase.js',
  '/manifest.webmanifest',
  '/assets/logo.jpg',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/apple-touch-icon.png',
];

// ---------- Install: pre-cache the app shell ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  // Activate this new SW immediately, don't wait for tabs to close
  self.skipWaiting();
});

// ---------- Activate: delete old caches when version bumps ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ---------- Fetch: cache-first for static, network for API ----------
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET (POST/PATCH must always hit the network)
  if (req.method !== 'GET') return;

  // Skip cross-origin requests we don't control (Supabase, Google Fonts CSS, esm.sh, etc.)
  // — they have their own caching headers and we don't want stale auth tokens.
  if (url.origin !== self.location.origin) {
    // Exception: cache Google Fonts files (woff2) so offline keeps the typography
    if (url.hostname === 'fonts.gstatic.com') {
      event.respondWith(staleWhileRevalidate(req));
    }
    return;
  }

  // Same-origin GET → cache-first
  event.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) {
    // refresh in the background ("stale-while-revalidate" lite)
    fetch(req).then((resp) => {
      if (resp.ok) caches.open(CACHE_VERSION).then((c) => c.put(req, resp));
    }).catch(() => {});
    return cached;
  }
  try {
    const resp = await fetch(req);
    if (resp.ok) {
      const c = await caches.open(CACHE_VERSION);
      c.put(req, resp.clone());
    }
    return resp;
  } catch (e) {
    // total offline + nothing cached → minimal fallback
    return new Response('Hors-ligne', { status: 503, statusText: 'Offline' });
  }
}

// ---------- Push notifications (background) ----------
// The push service (APNs / FCM) wakes this worker up just long enough to
// show a system notification. The payload is the JSON sent by our Edge
// Function, encrypted in transit and decrypted by the browser.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const title = data.title || 'Nouvelle réservation';
  const body  = data.body  || 'Une demande vient d\'arriver.';
  const options = {
    body,
    icon:  '/assets/icon-192.png',
    badge: '/assets/icon-192.png',
    tag:   data.tag || 'reservation',
    renotify: true,
    requireInteraction: false,
    data: { url: data.url || '/admin.html' },
    vibrate: [200, 100, 200],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// When the chef taps the notification, focus the dashboard tab or open one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/admin.html';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.includes('/admin.html')) {
        await c.focus();
        return;
      }
    }
    await self.clients.openWindow(targetUrl);
  })());
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(req);
  const network = fetch(req).then((resp) => {
    if (resp.ok) cache.put(req, resp.clone());
    return resp;
  }).catch(() => cached);
  return cached || network;
}
