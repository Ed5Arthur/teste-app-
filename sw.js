/* SISTEMA — Despertar · service worker
   -------------------------------------
   Existe por um motivo só: abrir o app sem internet.

   Ele NÃO decide quando você troca de versão. Quem decide é o versao.json,
   que nunca passa por aqui — toda checagem vai direto na rede. Assim o botão
   "Procurar atualização" continua sendo a verdade, e o cache nunca mente
   dizendo que está tudo em dia quando não está.

   Regra de cada arquivo:
   · versao.json  → sempre rede, nunca guardado. É o termômetro.
   · a página     → cache primeiro (abre instantâneo e funciona offline),
                    com uma busca em segundo plano para o cache não envelhecer.
   · resto        → cache primeiro, rede atualizando por trás.

   Quando você toca em "Baixar e reiniciar", o app apaga estes caches,
   desregistra este arquivo e navega para um endereço novo. Na volta,
   tudo isto aqui é reconstruído com a versão nova. */

const VERSAO = '3.8.1';
const CACHE  = 'sistema-despertar-v' + VERSAO;

const CASCA = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.jpg',
  './icon-512.jpg',
  './icon-maskable.jpg'
];

/* Guardar um HTML pela metade é pior do que não guardar nada: o app passa a
   abrir quebrado toda vez, e nem recarregar resolve, porque o cache responde
   antes da rede. Uma página inteira termina em </html> — se não termina, a
   transferência foi cortada no meio e essa cópia não entra (nem sai) daqui. */
async function htmlInteiro(resp){
  try{
    const txt = await resp.clone().text();
    return /<\/html>\s*$/i.test(txt);
  }catch(e){ return false; }
}

self.addEventListener('install', ev => {
  ev.waitUntil((async () => {
    const c = await caches.open(CACHE);
    /* addAll falha inteiro se um arquivo faltar; um a um, o que existir entra */
    await Promise.all(CASCA.map(async u => {
      try{
        const r = await fetch(u, {cache: 'reload'});
        if(!r.ok) return;
        if(/\.html$|\/$/.test(u) && !(await htmlInteiro(r))) return;   // veio cortado: não guarda
        await c.put(u, r);
      }catch(e){}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

const BASE = self.location.pathname.replace(/sw\.js$/, '');
const ehVersao = url => url.pathname.endsWith('versao.json');
/* Só a raiz do app é a página. Antes qualquer navegação dentro da origem
   recebia o index.html, o que tornava impossível ter uma segunda página. */
const ehPagina = url => url.pathname === BASE
                     || url.pathname === BASE + 'index.html';

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if(req.method !== 'GET') return;

  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;

  /* O termômetro nunca é guardado: se a rede cair, o app trata como
     "não deu para checar" — que é a verdade — em vez de mentir "tudo em dia". */
  if(ehVersao(url)){
    ev.respondWith(fetch(req, {cache: 'no-store'}));
    return;
  }

  if(req.mode === 'navigate'){
    if(!ehPagina(url)) return;            // outra página: deixa a rede responder
    ev.respondWith((async () => {
      const c = await caches.open(CACHE);
      const guardado = await c.match('./index.html', {ignoreSearch: true})
                    || await c.match('./', {ignoreSearch: true});
      const rede = fetch(req).then(async r => {
        if(r && r.ok && await htmlInteiro(r)) c.put('./index.html', r.clone());
        return r;
      }).catch(() => null);

      /* a cópia guardada pode ter vindo de uma versão antiga deste arquivo,
         que ainda aceitava HTML cortado: confere antes de servir */
      if(guardado && await htmlInteiro(guardado)) return guardado;
      if(guardado) await c.delete('./index.html');

      return (await rede) || new Response(
        '<meta charset="utf-8"><body style="background:#04060D;color:#D8EAFB;' +
        'font-family:system-ui;padding:40px;text-align:center">' +
        '<h2>Sem conexão</h2><p>E o app ainda não tinha sido guardado inteiro. ' +
        'Abra uma vez com internet — depois disso ele funciona offline.</p>',
        {headers: {'Content-Type': 'text/html; charset=utf-8'}}
      );
    })());
    return;
  }

  ev.respondWith((async () => {
    const c = await caches.open(CACHE);
    const guardado = await c.match(req, {ignoreSearch: true});
    const rede = fetch(req).then(r => {
      if(r && r.ok) c.put(req, r.clone());
      return r;
    }).catch(() => null);
    if(guardado){ rede; return guardado; }
    const r = await rede;
    if(r) return r;
    throw new Error('offline e sem cópia guardada');
  })());
});

self.addEventListener('message', ev => {
  if(ev.data === 'skipWaiting') self.skipWaiting();
});
