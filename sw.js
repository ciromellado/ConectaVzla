const CACHE_NAME = 'conectavzla-v43'; // Versión actualizada
const CORE_ASSETS = [
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './img/logo.webp',
  './img/avatar.webp',
  './img/android-chrome-192.png',
  './img/android-chrome-512.png'
];

// 1. Instalación: guardar archivos base
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of CORE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (e) {
          console.warn('No se pudo cachear (ignorado):', asset, e);
 a       }
      }
    })
  );
  self.skipWaiting(); // Fuerza la activación inmediata
});

// 2. Activación: limpiar cachés viejas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => {
      return self.clients.claim(); // Toma el control de todas las pestanas/app inmediatamente
    })
  );
});

// 3. Estrategia de carga (Blindada para Android 8)
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignorar peticiones que no son GET o son de Supabase (datos deben ser en vivo)
  if (request.method !== 'GET' || url.hostname.includes('supabase.co')) {
    return;
  }

  // A) NAVEGACIÓN (Cuando el usuario abre la app o recarga)
  if (request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Si hay internet, guardamos una copia fresca en caché
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', clone));
          }
          return response;
        })
        .catch(() => {
          // Si NO hay internet o falla la red, servimos el index.html desde caché
          return caches.match('./index.html');
        })
    );
    return;
  }

  // B) ARCHIVOS LOCALES (CSS, JS, Imágenes)
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Estrategia "Cache First": devolvemos lo que hay en caché inmediatamente (¡ultra rápido!)
          // Y actualizamos la caché en segundo plano para la próxima vez
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse.clone()));
            }
          }).catch(() => {}); // Ignoramos errores de red en segundo plano
          
          return cachedResponse;
        }
        
        // Si no está en caché, intentamos traerlo de la red
        return fetch(request).catch(() => {
          // Si falla la red y no está en caché, devolvemos una respuesta vacía segura 
          // en lugar de 'undefined' (que es lo que rompía tu app en Android 8)
          return new Response('', { status: 404, statusText: 'No encontrado' });
        });
      })
    );
  }
});
