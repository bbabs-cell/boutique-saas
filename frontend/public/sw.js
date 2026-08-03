// Service worker de l'application — écrit à la main plutôt que via un plugin (next-pwa a des
// soucis de compatibilité connus avec l'App Router de Next.js 15), pour rester simple et prévisible.
//
// Rôle : rendre l'app installable et faire fonctionner l'app shell (JS/CSS/pages) hors-ligne.
// Les données métier (produits, ventes) ne transitent JAMAIS par ce cache HTTP : elles vivent
// dans IndexedDB (voir lib/offline-db.ts), gérées explicitement par l'application. Le cache
// HTTP ne sert qu'à charger l'interface elle-même sans réseau.

const CACHE_NAME = 'boutique-saas-v1';
const OFFLINE_URL = '/offline';

const PRECACHE_URLS = [
  '/dashboard',
  '/caisse',
  '/produits',
  '/offline',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {
        // Le précache est une optimisation, pas une exigence : une page visitée en ligne sera
        // de toute façon mise en cache au premier passage par le gestionnaire fetch ci-dessous.
      }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Jamais d'écriture mise en cache (POST/PATCH/PUT/DELETE) : uniquement les lectures.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Les appels API ne passent jamais par ce cache : en ligne, ils doivent refléter l'état réel
  // du serveur ; hors-ligne, c'est IndexedDB (géré par l'app) qui répond, pas un cache HTTP
  // potentiellement périmé silencieusement.
  if (url.pathname.startsWith('/api')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached || caches.match(OFFLINE_URL));

      // Stale-while-revalidate : sert le cache immédiatement si présent, tout en rafraîchissant
      // en arrière-plan pour la prochaine visite. Garantit un chargement instantané hors-ligne.
      return cached || networkFetch;
    }),
  );
});
