"use client"

import { useEffect } from "react"

// One-time guarded reload helper. Prevents reload loops by recording the last
// forced reload in sessionStorage and refusing to reload again within a window.
function reloadOnce(reason: string) {
  try {
    const key = "amasi-recover-reload"
    const last = Number(sessionStorage.getItem(key) || "0")
    const now = Date.now()
    // Don't force-reload more than once per 20s for the same recovery path.
    if (now - last < 20000) return
    sessionStorage.setItem(key, String(now))
    console.warn(`[PWA] Recovering via reload (${reason})`)
    window.location.reload()
  } catch {
    window.location.reload()
  }
}

function isChunkLoadError(message: string): boolean {
  return (
    /ChunkLoadError/i.test(message) ||
    /Loading chunk [\d]+ failed/i.test(message) ||
    /Loading CSS chunk/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  )
}

export function PWARegister() {
  useEffect(() => {
    // Safety net: if a stale/missing JS chunk fails to load (the classic
    // post-deploy blank-page failure), force a one-time reload to fetch the
    // current build instead of silently rendering nothing.
    const onError = (event: ErrorEvent) => {
      const msg = event?.message || event?.error?.message || ""
      if (isChunkLoadError(String(msg))) reloadOnce("chunk error")
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event?.reason
      const msg = typeof reason === "string" ? reason : reason?.message || ""
      if (isChunkLoadError(String(msg))) reloadOnce("chunk rejection")
    }
    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)

    if ("serviceWorker" in navigator) {
      const isPrint = window.location.pathname.startsWith("/print")

      if (!isPrint) {
        // Unregister the old print SW if it was ever registered on app routes.
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) {
            const scriptURL = reg.active?.scriptURL || ""
            if (scriptURL.includes("sw.js") && !scriptURL.includes("app-sw.js")) {
              reg.unregister()
            }
          }
        })

        // When a new SW takes control (new deploy activated), reload once so the
        // page runs against fresh assets instead of the previously cached state.
        let refreshing = false
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return
          refreshing = true
          reloadOnce("sw update")
        })

        // Register and proactively check for an updated SW.
        navigator.serviceWorker
          .register("/app-sw.js")
          .then((reg) => {
            reg.update().catch(() => {})
          })
          .catch((err) => {
            console.warn("[PWA] Service worker registration failed:", err)
          })
      }
    }

    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])

  return null
}
