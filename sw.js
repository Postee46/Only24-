// ONLY24 Service Worker v3
const CACHE = 'only24-v3';
const CORE = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/app.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE)).then(()=> self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(()=> self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Não faz cache do Supabase / API - sempre rede
  if (url.hostname.includes('supabase.co')) return;
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(()=> caches.match(e.request).then(cached => {
      if (cached) return cached;
      if (e.request.mode === 'navigate') return caches.match('./index.html');
    }))
  );
});
