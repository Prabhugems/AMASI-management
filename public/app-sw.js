// AMASI Command Center - Service Worker
// Network-first navigations + offline fallback.
//
// IMPORTANT: This SW deliberately does NOT cache /_next/static/ JS/CSS chunks.
// Those filenames are content-hashed and served by Vercel with immutable cache
// headers, so the browser's HTTP cache already handles them correctly. Caching
// them here under a fixed cache name caused stale chunks to be served after a
// deploy (new HTML referencing chunks the SW had pinned to an old build),
// blanking the page. Leaving them to the browser eliminates that class of bug.
//
// Bump CACHE_VERSION on any change so `activate` purges every older cache.

const CACHE_VERSION = "v3"
const CACHE_NAME = `amasi-${CACHE_VERSION}`

// Only an offline shell is precached. No app HTML, no JS chunks.
const PRECACHE_URLS = ["/offline"]

// Install: precache the offline shell and take over immediately.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  )
  self.skipWaiting()
})

// Activate: delete every previous amasi-* cache (purges old stale chunks/HTML).
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("amasi-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // Only handle same-origin GETs. Never touch APIs, Supabase, or cross-origin.
  if (
    event.request.method !== "GET" ||
    url.hostname !== self.location.hostname ||
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("supabase")
  ) {
    return
  }

  // Build assets: do NOT intercept. Let the browser + Vercel immutable cache
  // headers serve content-hashed chunks. This is the core fix for stale chunks.
  if (url.pathname.startsWith("/_next/")) {
    return
  }

  // Images / icons / fonts: cache-first is safe (content is static, and a stale
  // image never breaks the app the way a stale JS chunk does).
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|gif|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Navigations / HTML: network-first, fall back to the offline page only.
  // We do NOT cache live HTML — a cached shell can reference chunks that a later
  // deploy has removed, which is exactly what produced the blank-page bug.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/offline").then((cached) => cached || new Response("Offline", { status: 503 }))
      )
    )
    return
  }

  // Everything else: pass through to the network.
})
