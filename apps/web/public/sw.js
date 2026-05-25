// diyaa.ai service worker — minimal offline shell + cache-first for static assets,
// network-first for API + HTML so live data wins when online.
const CACHE_NAME = 'diyaa-shell-v1';
const SHELL = ['/offline', '/manifest.webmanifest', '/icons/icon-192.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Don't cache API / websocket / cross-origin.
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/auth') || url.pathname.startsWith('/webhooks')) return;

  // HTML: network-first with offline fallback.
  if (req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match('/offline'))),
    );
    return;
  }

  // Static: cache-first.
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
