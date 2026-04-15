"use client"

import { useEffect } from "react"

export function PWARegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const isprint = window.location.pathname.startsWith("/print")

      if (!isprint) {
        // Unregister old Printo SW if it was registered on non-print routes
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) {
            if (reg.active?.scriptURL?.includes("sw.js") && !reg.active.scriptURL.includes("app-sw.js")) {
              reg.unregister()
            }
          }
        })

        // Register the app SW
        navigator.serviceWorker.register("/app-sw.js").catch((err) => {
          console.warn("[PWA] Service worker registration failed:", err)
        })
      }
    }
  }, [])

  return null
}
