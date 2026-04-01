/* global self, caches, fetch */

const STATIC_CACHE = "taskflow-static-v1";
const RUNTIME_CACHE = "taskflow-runtime-v3";

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

async function networkFirst(request, opts) {
  const cacheWrites = opts?.cacheWrites !== false;
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    // credentials: "include" helps some PWA/WebView stacks send session cookies on SW-mediated fetches
    const response = await fetch(request, { credentials: "include" });
    if (cacheWrites && request.method === "GET" && response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("Network unavailable and no cache");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Top-level document loads to tenant/platform: never cache (avoids stale login UI in PWA).
  if (
    request.mode === "navigate" &&
    (url.pathname.startsWith("/t/") || url.pathname.startsWith("/platform/"))
  ) {
    event.respondWith(fetch(request, { credentials: "include" }));
    return;
  }

  // Never cache API GETs — avoids stale JSON/auth-related responses in PWA.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, { cacheWrites: false }));
    return;
  }

  // App HTML/RSC: network-first with cache (non-navigate GETs only).
  if (url.pathname.startsWith("/t/") || url.pathname.startsWith("/platform/")) {
    event.respondWith(networkFirst(request));
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
