// WordSteps & Grammar V3.0 Offline Service Worker (sw.js)
const CACHE_VERSION = "wordsteps-static-v3.0.0";
const PRECACHE_ASSETS = [
  "./grammar.html",
  "./grammar.css?v=3.0.0",
  "./grammar-anime.min.js?v=3.0.0",
  "./grammar-meta.js?v=3.0.0",
  "./grammar-app.js?v=3.0.0",
  "./grammar-mod-0.js?v=3.0.0",
  "./grammar-mod-1.js?v=3.0.0",
  "./grammar-mod-2.js?v=3.0.0",
  "./grammar-mod-3.js?v=3.0.0",
  "./grammar-mod-4.js?v=3.0.0",
  "./grammar-mod-5.js?v=3.0.0",
  "./grammar-drills.js?v=3.0.0"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(PRECACHE_ASSETS)).catch(() => {})
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith("wordsteps-static-") && k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for HTML & daily-words.json so live updates and daily 50 words are always fresh online, with offline cache fallback!
  const isDynamicDoc = req.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith(".json");
  if (isDynamicDoc) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then(c => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match("./grammar.html")))
    );
    return;
  }

  // Cache-first with background network populate for versioned JS/CSS static chunks
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
