// Printo PWA Service Worker
// Offline-capable shell for the /print kiosk ONLY.
//
// IMPORTANT: This SW must NOT cache the whole origin. A previous version ran
// stale-while-revalidate (`cached || fetched`) on every same-origin GET, which
// served stale HTML and stale /_next/ chunks across the ENTIRE app after each
// deploy — so newly shipped UI looked missing until users cleared site data.
// It now scopes all caching to the /print kiosk, never intercepts navigations
// or build assets for the rest of the app. (Same reasoning as app-sw.js.)
//
// The /print kiosk navigation itself IS stale-while-revalidate (serve the
// cached shell instantly, refresh in the background) -- the same discipline
// app-sw.js applies to /kiosk/*, and for the same reason: /print/[token] runs
// unattended, offline, on a device that must mount immediately without a
// network round-trip, but must also self-heal the next time it has a
// connection rather than staying pinned to a stale build forever. Precaching
// a document without the /_next/static/*.js|css it references would be a
// WORSE failure than the old network-first-with-cache-fallback (a shell that
// mounts but then fails to load its own JS), so the shell and its chunks are
// always cached together, in the same background operation.
//
// Bump CACHE_NAME on any change so `activate` purges every older cache —
// including the legacy "printo-v1"/"printo-v2" caches that hold stale
// full-site or non-chunk-aware content.

const CACHE_NAME = "printo-v3"
const SHELL_CACHE_NAME = "printo-shell-v3"
const KEEP_CACHES = new Set([CACHE_NAME, SHELL_CACHE_NAME])

// Kiosk shell to precache for offline use.
const APP_SHELL = ["/print"]

// Extract this document's own same-origin /_next/static/*.js|css references
// so we can cache them ALONGSIDE the document -- never the document without
// its chunks.
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

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("printo-") && !KEEP_CACHES.has(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // Only same-origin GETs. Never touch APIs, build assets, or cross-origin.
  if (
    event.request.method !== "GET" ||
    url.hostname !== self.location.hostname ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/")
  ) {
    return
  }

  // Only the /print kiosk is handled here. Everything else (the whole app) is
  // left to the browser/network, so deploys are never served from a stale SW.
  if (!url.pathname.startsWith("/print")) {
    return
  }

  if (event.request.mode === "navigate") {
    // Stale-while-revalidate: serve the cached shell instantly if present (no
    // network wait -- an offline device must mount immediately), while
    // ALWAYS kicking off a background refresh so a deployed fix reaches this
    // device the moment it has a connection, even if nobody ever reloads by
    // hand. First-ever visit (nothing cached yet) has no choice but to wait
    // on that same fetch.
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
        // Fall back across ALL caches (not just SHELL_CACHE_NAME) so the
        // install-time APP_SHELL precache into CACHE_NAME still serves as a
        // last resort if the shell cache hasn't been populated yet.
        return (await caches.match("/print")) || new Response("Offline", { status: 503 })
      })()
    )
    return
  }

  // Everything else under /print (non-navigation same-origin GETs): keep the
  // previous network-first-with-cache-fallback behavior.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match("/print"))
      )
  )
})
