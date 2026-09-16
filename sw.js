const CACHE_NAME = "studtask-v3";
const THIRD_PARTY_CACHE = "studtask-third-party-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.json",
  "./icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== THIRD_PARTY_CACHE)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

async function updateCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok && new URL(request.url).origin === self.location.origin) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return null;
  }
}

async function loadThirdPartyScript(request) {
  const cache = await caches.open(THIRD_PARTY_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    fetch(request)
      .then(response => {
        if (response.ok) cache.put(request, response.clone());
      })
      .catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    return cached || Response.error();
  }
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.hostname === "cdn.jsdelivr.net") {
    event.respondWith(loadThirdPartyScript(event.request));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.match(event.request).then(async cached => {
        const networkPromise = updateCache(event.request);
        if (cached) {
          event.waitUntil(networkPromise);
          return cached;
        }
        const network = await networkPromise;
        return network || caches.match("./offline.html");
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(async cached => {
      const networkPromise = updateCache(event.request);
      if (cached) {
        event.waitUntil(networkPromise);
        return cached;
      }
      return (await networkPromise) || caches.match("./offline.html");
    })
  );
});
