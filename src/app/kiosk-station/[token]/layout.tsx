import type { Viewport } from "next"

// Locks the surface down like a kiosk, not a general webpage -- no
// pinch-zoom, no accidental double-tap zoom, safe-area insets respected on
// notched tablets in landscape. Scoped to /kiosk-station/[token]/* only via
// this layout's own export (covers both the station shell and self-test
// pages), which overrides the root layout's viewport (still allows
// pinch-zoom up to 5x for the rest of the app).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export default function KioskStationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
