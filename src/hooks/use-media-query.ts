"use client"

import { useEffect, useState } from "react"

// SSR-safe: renders as `defaultValue` (desktop, for this page's only
// consumer -- kiosk-stations would rather assume desktop and correct on
// mount than flash a forced-mobile layout to every user on first paint),
// then syncs to the real value via matchMedia once mounted, and stays live
// across viewport/zoom changes for the lifetime of the component.
export function useMediaQuery(query: string, defaultValue = true): boolean {
  const [matches, setMatches] = useState(defaultValue)

  useEffect(() => {
    const mql = window.matchMedia(query)
    setMatches(mql.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [query])

  return matches
}
