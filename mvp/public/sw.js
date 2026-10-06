// Offline app shell: static assets cached (network-first, so updates land), /api never cached.
const C = 'logproj-v2';
const ASSETS = ['/', '/css/app.css', '/js/app.js', '/js/core.js', '/js/queue.js', '/manifest.json', '/icon.svg'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(C).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.pathname.startsWith('/api/') || e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(C).then((c) => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request)));
});
