import type { Metadata } from "next"

// page.tsx here is a Client Component ("use client"), which can't export
// generateMetadata itself -- this thin server layout carries it instead.
// Overrides the root layout's site-wide manifest (start_url "/", behind
// auth middleware) with this print station's own per-station manifest, so
// an installed home-screen icon launches back at this exact station
// instead of bouncing an unattended, session-less device to /login.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  return { manifest: `/print/${token}/manifest` }
}

export default function PrintTokenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
