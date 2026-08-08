const CACHE_NAME = 'conectavzla-v5';
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './img/logo.webp',
  './img/avatar.webp'
];

// Instalación: guardar los archivos base
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of CORE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (e) {
          console.warn('No se pudo cachear:', asset);
        }
      }
    })
  );
  self.skipWaiting();
});

// Activación: limpiar cachés viejas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Estrategia de carga
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // NUNCA interceptar Supabase (los datos deben ser siempre en vivo)
  if (url.hostname.endsWith('supabase.co')) return;
  if (request.method !== 'GET') return;

  // Navegación: red primero, caché como respaldo (funciona sin internet)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', clone));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Archivos locales: caché primero con actualización en segundo plano
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
});
