// Service worker: omogućava instalaciju aplikacije i brže otvaranje.
// Uvijek prvo pita server (da se vide najnoviji oglasi), a keš koristi samo kad nema interneta.
const V = 'pd-v3';
const SHELL = ['/', '/app.css', '/js/app.js', '/js/core.js', '/js/components.js', '/manifest.webmanifest', '/icons/icon-192.png', '/favicon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const OFFLINE = `<!doctype html><html lang="bs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nema interneta</title></head><body style="margin:0;font-family:sans-serif;background:#1B1E22;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px">
<div><div style="font-size:48px">📡</div><h1 style="font-size:22px">Nema interneta</h1><p style="color:#C4C8CE">Provjeri vezu pa pokušaj ponovo.</p>
<button onclick="location.reload()" style="background:#F5B301;border:0;border-radius:8px;padding:14px 22px;font-size:16px;font-weight:bold">Pokušaj ponovo</button></div></body></html>`;

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return; // podaci uvijek uživo

  // slike oglasa se nikad ne mijenjaju: prvo keš
  if (url.pathname.startsWith('/uploads/')) {
    e.respondWith(caches.open(V + '-img').then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }
  // stranice: server, a bez interneta zapamćena aplikacija ili poruka
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      if (res.ok && url.pathname === '/') caches.open(V).then(c => c.put('/', res.clone()));
      return res;
    }).catch(async () => (await caches.match('/')) || new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
    return;
  }
  // css, js, ikone: server, a keš kad nema interneta
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(V).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req)));
});
