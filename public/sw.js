// Guarda o app pra abrir rápido e offline. Os dados sempre vêm ao vivo do Supabase.
const CACHE = 'painel-v1'
const ROOT = new URL('./', self.location).href
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll([ROOT]))) })
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return
  // páginas: rede primeiro (pega versão nova), cache se estiver sem internet
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(ROOT, copy)); return r }).catch(() => caches.match(ROOT)))
    return
  }
  // arquivos com hash no nome: cache primeiro
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)) }
    return r
  })))
})
