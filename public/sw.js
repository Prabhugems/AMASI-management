// Printo PWA Service Worker
// Offline-capable shell for the /print kiosk ONLY.
//
// IMPORTANT: This SW must NOT cache the whole origin. A previous version ran
// stale-while-revalidate (`cached || fetched`) on every same-origin GET, which
// served stale HTML and stale /_next/ chunks across the ENTIRE app after each
// deploy — so newly shipped UI looked missing until users cleared site data.
// It now scopes all caching to the /print kiosk, never intercepts navigations
// or build assets for the rest of the app, and is network-first so deploys are
// never served stale. (Same reasoning as app-sw.js.)
//
// Bump CACHE_NAME on any change so `activate` purges every older cache —
// including the legacy "printo-v1" cache that holds stale full-site content.

const CACHE_NAME = "printo-v2"

// Kiosk shell to precache for offline use.
const APP_SHELL = ["/print"]

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
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
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

  // Network-first for the kiosk: always try fresh, fall back to cache offline.
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
