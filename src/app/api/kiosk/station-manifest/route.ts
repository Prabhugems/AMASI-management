import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/server"
import { isValidUUID } from "@/lib/validation"
import { resolveStationByToken } from "@/lib/kiosk-station-lookup"

// GET /api/kiosk/station-manifest?event_id=&station_token= -- the set of
// lists THIS station is assigned, with their schedule fields, so
// KioskStationShell can render the menu and recompute open/closed on-device
// (src/lib/kiosk-list-schedule.ts). Refreshed on the same 5-minute cadence
// KioskCheckinScreen's own roster refresh already uses, and cached in
// kiosk-offline-store.ts so the menu works fully offline from a cold reload.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("event_id")
  const stationToken = searchParams.get("station_token")

  if (!eventId || !isValidUUID(eventId)) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 })
  }
  if (!stationToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 })
  }

  const supabase = await createAdminClient()
  const { station } = await resolveStationByToken(supabase, stationToken)

  if (!station || station.revoked_at || (station.mode !== "checkin" && station.mode !== "checkin_and_print")) {
    return NextResponse.json({ error: "Invalid access token." }, { status: 401 })
  }
  if (station.event_id !== eventId) {
    return NextResponse.json({ error: "Station not found." }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: joinRows, error: joinError } = await (supabase as any)
    .from("kiosk_station_lists")
    .select("checkin_list_id")
    .eq("station_id", station.id)

  if (joinError) {
    // A transient DB error here looks identical to "this station has zero
    // assigned lists" unless distinguished -- and this response is cached
    // client-side for offline use (KioskStationShell), so silently treating
    // it as empty could overwrite a correct on-device menu with an empty
    // one. Match /api/kiosk/delegates' convention: 503, not 200 + [].
    Sentry.captureException(joinError, { tags: { route: "kiosk/station-manifest" }, extra: { eventId, stationId: station.id } })
    return NextResponse.json({ error: "Something went wrong looking up this station's lists." }, { status: 503 })
  }

  const listIds = (joinRows || []).map((r: any) => r.checkin_list_id)

  let lists: any[] = []
  if (listIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: listsError } = await (supabase as any)
      .from("checkin_lists")
      .select("id, name, list_purpose, category, prints_badge, kiosk_opens_at, kiosk_closes_at, kiosk_force_state")
      .in("id", listIds)

    if (listsError) {
      Sentry.captureException(listsError, { tags: { route: "kiosk/station-manifest" }, extra: { eventId, stationId: station.id } })
      return NextResponse.json({ error: "Something went wrong looking up this list." }, { status: 503 })
    }
    lists = data || []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stationRow = station as any
  return NextResponse.json({
    station_name: stationRow.name,
    mode: stationRow.mode,
    print_station_id: stationRow.print_station_id ?? null,
    auto_print_badge: !!stationRow.auto_print_badge,
    attended: stationRow.attended === true,
    lists,
  })
}
