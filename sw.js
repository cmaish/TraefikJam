// Offline-first service worker: everything the game needs is precached.
const VERSION = 'bbj-v2.1.2';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/main.js',
  'js/game.js',
  'js/draw.js',
  'js/fx.js',
  'js/audio.js',
  'js/storage.js',
  'js/levels.js',
  'js/levels-data.js',
  'js/generator.js',
  'js/worlds.js',
  'js/vehicles.js',
  'js/parent.js',
  'js/models.js',
  'js/studio.js',
  'vendor/three.module.min.js',
  'vendor/RoundedBoxGeometry.js',
  'vendor/RoomEnvironment.js',
  'vendor/BufferGeometryUtils.js',
  'fonts/rubik-latin-500-normal.woff2',
  'fonts/rubik-latin-700-normal.woff2',
  'fonts/rubik-latin-800-normal.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
    }),
  );
});
