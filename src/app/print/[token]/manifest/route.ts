import { NextRequest, NextResponse } from "next/server"

// Per-print-station PWA manifest. Same fix as the kiosk-station one
// (src/app/kiosk-station/[token]/manifest/route.ts): the site-wide
// manifest.json has a fixed start_url ("/"), which sits behind auth
// middleware -- fine for the admin dashboard, but an unattended badge-
// printing station with no session bounces straight to /login when its
// home-screen icon launches. This scopes start_url/scope to the station's
// OWN URL instead. Icons are reused as-is from the site-wide manifest.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const stationUrl = `/print/${token}`

  return NextResponse.json(
    {
      name: "Print Station",
      short_name: "Print",
      start_url: stationUrl,
      scope: stationUrl,
      display: "standalone",
      // No `orientation` lock -- see the identical fix and rationale in
      // src/app/kiosk-station/[token]/manifest/route.ts.
      background_color: "#0f172a",
      theme_color: "#2563eb",
      icons: [
        { src: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any maskable" },
        { src: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  )
}
