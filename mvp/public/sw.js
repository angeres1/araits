// Minimal offline shell: cache static assets, never cache /api.
const C = 'logproj-v1';
const ASSETS = ['/', '/app.js', '/app.css', '/manifest.json', '/icon.svg'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(C).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.pathname.startsWith('/api/') || e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(C).then((c) => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
