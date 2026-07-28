import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/server"
import { hashStationToken } from "@/lib/kiosk-station-auth"
import { KioskCheckinScreen } from "@/components/kiosk/KioskCheckinScreen"

// Server component: resolves a kiosk_stations row from its token, entirely
// server-side, and renders the same KioskCheckinScreen every other kiosk
// entry point uses -- parameterized by this station's own token, never the
// underlying check-in list's own access_token, which this component never
// even fetches on this path (see KioskCheckinScreen and
// /api/kiosk/delegates's station_token branch).
export default async function KioskStationPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: station, error } = await (supabase as any)
    .from("kiosk_stations")
    .select("id, event_id, mode, list_id, revoked_at")
    .eq("access_token_hash", hashStationToken(token))
    .maybeSingle()

  // A truthy `error` here is a genuine lookup failure (transient Supabase/
  // infra issue) -- .maybeSingle() returns { data: null, error: null } for a
  // legitimate zero-row result, so this branch is never reached for a simply
  // invalid/unknown token. Left undistinguished from "not found", an
  // unattended device would render a permanent-looking "Station Not Found"
  // with zero telemetry on every transient blip.
  if (error) {
    Sentry.captureException(error, { tags: { route: "kiosk-station/[token]" } })
    return <StationLookupError />
  }

  if (!station || station.revoked_at || station.mode !== "checkin") {
    return <StationNotFound />
  }
  if (!station.list_id) {
    return <StationListRemoved />
  }

  // Best-effort presence touch -- never blocks rendering on failure.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("kiosk_stations")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", station.id)

  return <KioskCheckinScreen eventId={station.event_id} listId={station.list_id} stationToken={token} />
}

function StationLookupError() {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md text-center text-white">
        <h1 className="text-2xl font-bold mb-2">Something Went Wrong</h1>
        <p className="text-gray-400">
          Something went wrong loading this station. Please try reloading, or contact an admin if this continues.
        </p>
      </div>
    </div>
  )
}

function StationNotFound() {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md text-center text-white">
        <h1 className="text-2xl font-bold mb-2">Station Not Found</h1>
        <p className="text-gray-400">
          This kiosk station link is invalid or has been revoked. Please contact the event organizer.
        </p>
      </div>
    </div>
  )
}

function StationListRemoved() {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md text-center text-white">
        <h1 className="text-2xl font-bold mb-2">Station Needs Reassignment</h1>
        <p className="text-gray-400">
          This station&apos;s check-in list was removed. Please contact an admin to assign a new one.
        </p>
      </div>
    </div>
  )
}
