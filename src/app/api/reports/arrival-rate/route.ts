import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { isValidUUID } from "@/lib/validation"

// GET /api/reports/arrival-rate?event_id= -- scans per hour, per station
// (work order §7.3). A station showing "Active" (recent last_seen_at) with
// abnormally few scans in the last hour has a problem no heartbeat alone
// reveals -- this is how the admin decides where to move people.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("event_id")

  if (!eventId || !isValidUUID(eventId)) {
    return NextResponse.json({ error: "Valid event_id is required" }, { status: 400 })
  }

  const { error: authError } = await requireEventAndPermission(eventId, "checkin")
  if (authError) return authError

  const supabase = await createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lists } = await (supabase as any).from("checkin_lists").select("id").eq("event_id", eventId)
  const listIds = (lists || []).map((l: { id: string }) => l.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stations } = await (supabase as any)
    .from("kiosk_stations")
    .select("id, name, last_seen_at, revoked_at")
    .eq("event_id", eventId)

  if (listIds.length === 0 || !stations || stations.length === 0) {
    return NextResponse.json({ data: { stations: [], hourly: [] } })
  }

  // Bug-audit fix (2026-08): this used to include every row regardless of
  // checked_out_at or reversed_at. A station whose volunteer repeatedly
  // mis-scanned (later reversed by help desk) showed inflated activity here,
  // masking a station that may actually be struggling with real, valid
  // throughput -- the exact signal this report exists to surface.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: checkins, error } = await (supabase as any)
    .from("checkin_records")
    .select("station_id, checked_in_at")
    .in("checkin_list_id", listIds)
    .not("station_id", "is", null)
    .is("checked_out_at", null)
    .is("reversed_at", null)

  if (error) {
    return NextResponse.json({ error: "Failed to load arrival-rate data" }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stationNameById = new Map<string, string>(stations.map((s: any) => [s.id, s.name]))

  // Bucket by station + local hour (e.g. "2026-08-27 09:00").
  const buckets = new Map<string, number>()
  for (const row of checkins || []) {
    const d = new Date(row.checked_in_at)
    const hourKey = `${d.toISOString().slice(0, 13)}:00`
    const key = `${row.station_id}|${hourKey}`
    buckets.set(key, (buckets.get(key) || 0) + 1)
  }

  const hourly = Array.from(buckets.entries()).map(([key, count]) => {
    const [stationId, hour] = key.split("|")
    return { stationId, stationName: stationNameById.get(stationId) || "Unknown station", hour, count }
  })
  hourly.sort((a, b) => a.hour.localeCompare(b.hour) || a.stationName.localeCompare(b.stationName))

  const oneHourAgo = Date.now() - 60 * 60 * 1000
  const lastHourCountByStation = new Map<string, number>()
  for (const row of checkins || []) {
    if (new Date(row.checked_in_at).getTime() >= oneHourAgo) {
      lastHourCountByStation.set(row.station_id, (lastHourCountByStation.get(row.station_id) || 0) + 1)
    }
  }

  const fifteenMinAgo = Date.now() - 15 * 60 * 1000
  const stationSummaries = stations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((s: any) => !s.revoked_at)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((s: any) => {
      const recentlySeen = s.last_seen_at ? new Date(s.last_seen_at).getTime() >= fifteenMinAgo : false
      const lastHourCount = lastHourCountByStation.get(s.id) || 0
      return {
        stationId: s.id,
        stationName: s.name,
        lastSeenAt: s.last_seen_at,
        recentlySeen,
        lastHourCount,
        // Heuristic flag only -- "active but quiet": the station has
        // checked in within the last 15 minutes (so it's genuinely in use,
        // not just idle/powered-on) but has very low throughput. Not a
        // hard threshold the work order specifies; the admin makes the
        // actual call.
        quietWhileActive: recentlySeen && lastHourCount <= 2,
      }
    })

  return NextResponse.json({ data: { stations: stationSummaries, hourly } })
}
