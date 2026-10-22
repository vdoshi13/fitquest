// FitQuest offline helper: the app opens instantly from the phone, and updates
// download quietly in the background (they show up the next time you open it).
const CACHE = 'fitquest-shell-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'fitquest-fonts').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // API calls go straight to Google
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;

  const cacheName = isFont ? 'fitquest-fonts' : CACHE;
  e.respondWith(caches.open(cacheName).then(async cache => {
    const key = sameOrigin && req.mode === 'navigate' ? './index.html' : req;
    const cached = await cache.match(key);
    const network = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(key, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;                             // cached first, refreshed in the background
  }));
});
