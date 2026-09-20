const CACHE_NAME = "studtask-v14";
const THIRD_PARTY_CACHE = "studtask-third-party-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.json",
  "./IMG-20260915-WA0041.jpg",
  "./logo.svg",
  "./icon.svg",
  "./brand.js",
  "./notifications.js",
  "./sw.js"
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
  } catch {
    return null;
  }
}

async function thirdParty(request) {
  const cache = await caches.open(THIRD_PARTY_CACHE);
  const oldResponse = await cache.match(request);

  if (oldResponse) {
    fetch(request)
      .then(response => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
      })
      .catch(() => {});

    return oldResponse;
  }

  try {
    const response = await fetch(request);

    if (response.ok) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    return oldResponse || Response.error();
  }
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  if (url.hostname === "cdn.jsdelivr.net") {
    event.respondWith(thirdParty(event.request));
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.match(event.request).then(async oldResponse => {
        const networkResponse = updateCache(event.request);

        if (oldResponse) {
          event.waitUntil(networkResponse);
          return oldResponse;
        }

        return await networkResponse || caches.match("./offline.html");
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(async oldResponse => {
      const networkResponse = updateCache(event.request);

      if (oldResponse) {
        event.waitUntil(networkResponse);
        return oldResponse;
      }

      return await networkResponse || caches.match("./offline.html");
    })
  );
});
