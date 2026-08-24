/* SISTEMA — Despertar · service worker
   Guarda o app inteiro no aparelho: depois da primeira abertura, funciona sem internet. */
const CACHE = 'sistema-despertar-v1';
const BASE = ['./', './index.html', './manifest.webmanifest',
              './icon-192.png', './icon-512.png', './icon-maskable.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
      const copia = resp.clone();
      caches.open(CACHE).then(c => { try{ c.put(e.request, copia); }catch(err){} });
      return resp;
    }).catch(() => caches.match('./index.html')))
  );
});
