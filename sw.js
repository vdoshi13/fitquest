// FitQuest offline helper.
// The page itself is fetched fresh whenever you're online (so updates show up on the next open),
// and falls back to the saved copy when you're offline or the network is slow.
const CACHE = 'fitquest-shell-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
const PAGE_TIMEOUT_MS = 3000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'fitquest-fonts').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // API calls go straight to Google
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;

  const isPage = sameOrigin && (req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname));
  if (isPage) {
    // Network first (fresh version), saved copy if offline or slow
    e.respondWith(caches.open(CACHE).then(async cache => {
      const cached = await cache.match('./index.html');
      const network = fetch(new Request('./index.html', { cache: 'no-store' })).then(res => {
        if (res && res.ok) cache.put('./index.html', res.clone());
        return res;
      });
      if (!cached) return network;
      const timeout = new Promise(r => setTimeout(() => r(cached), PAGE_TIMEOUT_MS));
      return Promise.race([network.catch(() => cached), timeout]);
    }));
    return;
  }

  // Icons, manifest and fonts: saved copy first, refreshed in the background
  const cacheName = isFont ? 'fitquest-fonts' : CACHE;
  e.respondWith(caches.open(cacheName).then(async cache => {
    const cached = await cache.match(req);
    const network = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});
