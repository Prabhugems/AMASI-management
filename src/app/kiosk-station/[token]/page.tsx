import type { Metadata } from "next"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/server"
import { hashStationToken } from "@/lib/kiosk-station-auth"
import { KioskStationShell } from "@/components/kiosk/KioskStationShell"

// Overrides the root layout's site-wide manifest (start_url "/", behind auth
// middleware) with this station's own per-station manifest -- otherwise an
// installed home-screen icon launches at "/" and an unattended, session-less
// kiosk device bounces straight to /login.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  return { manifest: `/kiosk-station/${token}/manifest` }
}

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
    .select("id, name, event_id, mode, print_station_id, auto_print_badge, revoked_at, attended")
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

  if (!station || station.revoked_at || (station.mode !== "checkin" && station.mode !== "checkin_and_print")) {
    return <StationNotFound />
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: joinRows } = await (supabase as any)
    .from("kiosk_station_lists")
    .select("checkin_list_id")
    .eq("station_id", station.id)

  const listIds = (joinRows || []).map((r: any) => r.checkin_list_id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lists } = listIds.length > 0
    ? await (supabase as any)
        .from("checkin_lists")
        .select("id, name, list_purpose, prints_badge, kiosk_opens_at, kiosk_closes_at, kiosk_force_state")
        .in("id", listIds)
    : { data: [] }

  if (!lists || lists.length === 0) {
    return <StationListRemoved />
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let printSettings: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let badgeTemplate: any = null
  let printMode: string | undefined

  if (station.mode === "checkin_and_print" && station.print_station_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: printStation } = await (supabase as any)
      .from("print_stations")
      .select("print_settings, print_mode, badge_templates (id, name, template_data)")
      .eq("id", station.print_station_id)
      .maybeSingle()
    printSettings = printStation?.print_settings || null
    badgeTemplate = printStation?.badge_templates || null
    printMode = printStation?.print_mode || undefined
  }

  // Best-effort presence touch -- never blocks rendering on failure.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("kiosk_stations")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", station.id)

  return (
    <KioskStationShell
      eventId={station.event_id}
      stationToken={token}
      stationName={station.name}
      mode={station.mode}
      attended={station.attended === true}
      autoPrintBadge={station.auto_print_badge}
      printStationId={station.print_station_id || undefined}
      badgeTemplate={badgeTemplate || undefined}
      printSettings={printSettings || undefined}
      printMode={printMode}
      initialLists={lists}
    />
  )
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
