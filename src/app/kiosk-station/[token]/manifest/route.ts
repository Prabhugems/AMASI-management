import { NextRequest, NextResponse } from "next/server"

// Per-station PWA manifest. The site-wide manifest.json has a fixed
// start_url ("/"), which sits behind auth middleware -- fine for the admin
// dashboard, but an unattended kiosk device with no session bounces
// straight to /login when its home-screen icon launches. This scopes
// start_url/scope to the station's OWN URL instead, so the installed icon
// always reopens exactly the station it was provisioned for. Icons are
// reused as-is from the site-wide manifest.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const stationUrl = `/kiosk-station/${token}`

  return NextResponse.json(
    {
      name: "Kiosk Station",
      short_name: "Kiosk",
      start_url: stationUrl,
      scope: stationUrl,
      display: "standalone",
      // No `orientation` lock -- a station's tablet may be mounted in
      // either orientation depending on the desk, and a hardcoded
      // "portrait" here prevented the installed home-screen icon from
      // ever rotating to landscape regardless of how the device was held.
      // Omitting the field lets the OS/device orientation apply normally,
      // matching how a plain (non-installed) browser tab already behaves.
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
