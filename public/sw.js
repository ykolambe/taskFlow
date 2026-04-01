/* global self, caches, fetch */

const STATIC_CACHE = "taskflow-static-v1";
const RUNTIME_CACHE = "taskflow-runtime-v4";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll([
        "/",
        "/manifest.webmanifest",
        "/icon-192.png",
        "/icon-512.png",
      ])
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request, { credentials: "include" });
    if (request.method === "GET" && response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("Network unavailable and no cache");
  }
}

/** Never cache app/API — RSC + JSON must always be fresh or PWA shows stale login/session. */
function networkOnly(request) {
  return fetch(request, { credentials: "include" });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Tenant, platform, API: always network, never write to runtime cache (fixes re-login after PWA close).
  if (
    url.pathname.startsWith("/t/") ||
    url.pathname.startsWith("/platform/") ||
    url.pathname.startsWith("/api/")
  ) {
    event.respondWith(networkOnly(request));
    return;
  }

  // Static assets can use cache-first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".webmanifest")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((resp) => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
        }
        return resp;
      }))
    );
    return;
  }

  event.respondWith(networkFirst(request));
});
