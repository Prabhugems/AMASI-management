import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/server"
import { isValidUUID } from "@/lib/validation"
import { resolveStationByToken } from "@/lib/kiosk-station-lookup"

// GET /api/kiosk/station-names?event_id=&station_token= -- the names of
// EVERY kiosk station belonging to this event (not just the requesting
// one), so a tablet can later resolve "which station attributed a prior
// check-in" purely from a local cache (see kiosk-offline-store.ts's
// cacheStationNames/getStationNames), without a live lookup at read time.
// Names aren't sensitive, so unlike station-manifest this does not need to
// check `attended` -- any valid station for this event can know the other
// stations' names.
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
  const { data: stations, error } = await (supabase as any)
    .from("kiosk_stations")
    .select("id, name")
    .eq("event_id", eventId)

  if (error) {
    Sentry.captureException(error, { tags: { route: "kiosk/station-names" }, extra: { eventId, stationId: station.id } })
    return NextResponse.json({ error: "Something went wrong looking up this event's stations." }, { status: 503 })
  }

  return NextResponse.json({ stations: stations || [] })
}
