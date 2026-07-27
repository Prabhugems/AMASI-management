// AMASI Command Center - Service Worker
// Network-first navigations + offline fallback, EXCEPT the kiosk shell
// (/kiosk/*), which is stale-while-revalidate so it mounts instantly offline
// and self-heals whenever a connection exists. See
// docs/superpowers/plans/2026-07-27-kiosk-offline-first-stage1.md Task 8 for
// why: the kiosk page is the offline handler (it resolves everything itself
// from IndexedDB once mounted) -- this SW's only job for that one route
// prefix is to deliver the document (and the JS it needs to run) fast enough
// to get out of the way, not to reimplement any offline logic itself.
//
// IMPORTANT: This SW deliberately does NOT cache /_next/static/ JS/CSS chunks
// for any OTHER route. Those filenames are content-hashed and served by
// Vercel with immutable cache headers, so the browser's HTTP cache already
// handles them correctly. Caching them here under a fixed cache name caused
// stale chunks to be served after a deploy (new HTML referencing chunks the
// SW had pinned to an old build), blanking the page. Leaving them to the
// browser eliminates that class of bug -- EXCEPT for the kiosk shell cache
// below, which deliberately DOES cache the chunks a cached kiosk document
// references, because relying on the browser's own HTTP cache for those is
// not enough for an unattended device that may not reconnect for a long
// time (disk-cache eviction is a real risk over days/weeks, unlike the
// browser-session timescale the rest of this file's comment above assumes).
//
// Bump CACHE_VERSION on any change so `activate` purges every older cache.

const CACHE_VERSION = "v4"
const CACHE_NAME = `amasi-${CACHE_VERSION}`
const SHELL_CACHE_NAME = `amasi-shell-${CACHE_VERSION}`
const KEEP_CACHES = new Set([CACHE_NAME, SHELL_CACHE_NAME])

// Only an offline shell is precached. No app HTML, no JS chunks.
const PRECACHE_URLS = ["/offline"]

// Route prefixes that get the stale-while-revalidate shell strategy instead
// of network-first. Kept as a prefix list (not a single string) so Stage 3
// can extend this to a home-screen-launched PWA entry point without
// touching the fetch handler itself -- see this plan's Self-Review Notes.
const SHELL_ROUTE_PREFIXES = ["/kiosk/"]

function isShellRoute(pathname) {
  return SHELL_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

// Extract this document's own same-origin /_next/static/*.js|css references
// so we can cache them ALONGSIDE the document -- never the document without
// its chunks, which would produce a worse failure (blank page) than today's
// generic offline fallback.
function extractChunkUrls(html, origin) {
  const urls = new Set()
  const re = /(?:src|href)="(\/_next\/static\/[^"]+\.(?:js|css))"/g
  let match
  while ((match = re.exec(html))) urls.add(origin + match[1])
  return [...urls]
}

async function cacheShellAndChunks(request, response) {
  const html = await response.clone().text()
  const cache = await caches.open(SHELL_CACHE_NAME)
  // Re-wrap as a fresh Response -- the original body stream was already
  // consumed by .text() above.
  await cache.put(request, new Response(html, { headers: response.headers, status: response.status, statusText: response.statusText }))
  const chunkUrls = extractChunkUrls(html, self.location.origin)
  await Promise.all(
    chunkUrls.map(async (chunkUrl) => {
      try {
        const chunkResponse = await fetch(chunkUrl)
        if (chunkResponse.ok) await cache.put(chunkUrl, chunkResponse)
      } catch {
        // A chunk fetch failing during a background refresh is not fatal --
        // the previously cached shell/chunks (if any) are untouched, and
        // this same refresh retries on the next successful navigation.
      }
    })
  )
}

// Install: precache the offline shell and take over immediately.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  )
  self.skipWaiting()
})

// Activate: delete every previous amasi-* cache EXCEPT the current main and
// shell caches (purges old stale chunks/HTML/shell versions).
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("amasi-") && !KEEP_CACHES.has(key))
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

  // Build assets: do NOT intercept for the general case -- see header
  // comment. The kiosk shell path below caches its OWN chunks separately
  // and does not rely on this early return (those chunk fetches happen
  // inside cacheShellAndChunks, not via this fetch handler matching them).
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

  if (event.request.mode === "navigate") {
    if (isShellRoute(url.pathname)) {
      // Stale-while-revalidate: serve the cached shell instantly if present
      // (no network wait -- this is the whole point, an offline device must
      // mount immediately), while ALWAYS kicking off a background refresh so
      // a deployed fix reaches this device the moment it has a connection,
      // even if nobody ever reloads by hand. First-ever visit (nothing
      // cached yet) has no choice but to wait on that same fetch.
      event.respondWith(
        (async () => {
          const cache = await caches.open(SHELL_CACHE_NAME)
          const cached = await cache.match(event.request)
          const refresh = fetch(event.request)
            .then((response) => {
              if (response.ok) cacheShellAndChunks(event.request, response.clone())
              return response
            })
            .catch(() => null)
          if (cached) return cached
          const fresh = await refresh
          if (fresh) return fresh
          return (await caches.match("/offline")) || new Response("Offline", { status: 503 })
        })()
      )
      return
    }

    // Everywhere else, unchanged: network-first, fall back to the offline
    // page only. We do NOT cache live HTML here -- a cached shell can
    // reference chunks a later deploy has removed, which is exactly what
    // produced the blank-page bug this file's header describes.
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/offline").then((cached) => cached || new Response("Offline", { status: 503 }))
      )
    )
    return
  }

  // Everything else: pass through to the network.
})
