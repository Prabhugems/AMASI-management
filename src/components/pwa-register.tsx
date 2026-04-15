"use client"

import { useEffect } from "react"

export function PWARegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Only register app SW on non-print routes
      if (!window.location.pathname.startsWith("/print")) {
        navigator.serviceWorker.register("/app-sw.js").catch((err) => {
          console.warn("[PWA] Service worker registration failed:", err)
        })
      }
    }
  }, [])

  return null
}
