/**
 * service-worker.js — FileHub PWA
 * Estratégia: Cache-first para assets estáticos, Network-first para dados.
 */

const CACHE_NAME  = 'fhub-v1';
const DATA_CACHE  = 'fhub-data-v1';

// Assets principais a pré-cachear na instalação
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './manifest.json',
  // CDN — marked.js (Markdown renderer)
  'https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js',
];

/* ── Install ── */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

/* ── Activate — limpar caches antigos ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== DATA_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Dados dinâmicos (index.json, content/) → Network-first
  if (url.pathname.includes('/data/') || url.pathname.includes('/content/')) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // Assets estáticos → Cache-first
  event.respondWith(cacheFirst(request, CACHE_NAME));
});

/** Cache-first: tenta cache, senão busca na rede e guarda */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

/** Network-first: tenta rede, em caso de falha usa cache */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}
