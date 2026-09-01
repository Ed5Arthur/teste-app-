/* Service worker do SISTEMA — Despertar
   Estratégia: cache primeiro para o app abrir offline, rede primeiro para o
   versao.json, que é justamente o arquivo que avisa quando há versão nova. */
const CACHE = 'sistema-despertar-v35';
const ARQUIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.jpg',
  './icon-512.jpg',
  './icon-maskable.jpg'
];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ARQUIVOS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if(req.method !== 'GET') return;

  /* o arquivo de versão nunca vem do cache, senão a checagem de atualização mente */
  if(req.url.indexOf('versao.json') >= 0){
    ev.respondWith(fetch(req, {cache:'no-store'}).catch(() => caches.match(req)));
    return;
  }

  ev.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if(res && res.status === 200 && res.type === 'basic'){
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(req, copia));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
