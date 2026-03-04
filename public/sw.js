// Printo PWA Service Worker
// Caches app shell for offline-capable kiosk mode

const CACHE_NAME = "printo-v1"

// App shell files to cache on install
const APP_SHELL = ["/print"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // Never cache API calls or printer requests
  if (url.pathname.startsWith("/api/") || url.hostname !== self.location.hostname) {
    return
  }

  // Stale-while-revalidate for app shell
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request)
      const fetched = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            cache.put(event.request, response.clone())
          }
          return response
        })
        .catch(() => cached)

      return cached || fetched
    })
  )
})
