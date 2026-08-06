import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { isValidUUID } from "@/lib/validation"
import { newStationToken, hashStationToken } from "@/lib/kiosk-station-auth"

// GET /api/kiosk-stations?event_id= -- admin dashboard list. Never selects
// access_token_hash; the hash is not the admin's business once minted, only
// the "is a token configured" fact (implicit here: every row always has one).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("event_id")

  if (!eventId || !isValidUUID(eventId)) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 })
  }

  const { error: authError } = await requireEventAndPermission(eventId, "checkin")
  if (authError) return authError

  const supabase = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("kiosk_stations")
    .select("id, event_id, name, mode, print_station_id, auto_print_badge, attended, last_seen_at, revoked_at, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: "Failed to load kiosk stations." }, { status: 500 })
  }

  const stations = data || []
  const stationIds = stations.map((s: any) => s.id)
  const { data: joinRows } = stationIds.length > 0
    ? await (supabase as any).from("kiosk_station_lists").select("station_id, checkin_list_id").in("station_id", stationIds)
    : { data: [] }

  const listIdsByStation = new Map<string, string[]>()
  for (const row of joinRows || []) {
    const existing = listIdsByStation.get(row.station_id) || []
    existing.push(row.checkin_list_id)
    listIdsByStation.set(row.station_id, existing)
  }

  return NextResponse.json({
    stations: stations.map((s: any) => ({ ...s, list_ids: listIdsByStation.get(s.id) || [] })),
  })
}

// POST /api/kiosk-stations -- create a station and mint its access token.
// mode defaults to "checkin"; "checkin_and_print" is a validated option that
// requires a usb-type Print Station in the same event. mode: "print"
// (print-only, no check-in) remains unbuilt/unsupported by this route.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const eventId = body.event_id as string | undefined
  const name = (body.name as string | undefined)?.trim()
  const listIds = Array.isArray(body.list_ids) ? (body.list_ids as string[]) : []

  if (!eventId || !isValidUUID(eventId)) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 })
  }
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 })
  }
  if (listIds.length === 0 || !listIds.every(isValidUUID)) {
    return NextResponse.json({ error: "At least one check-in list must be selected." }, { status: 400 })
  }

  const mode = (body.mode as string | undefined) === "checkin_and_print" ? "checkin_and_print" : "checkin"
  const printStationId = body.print_station_id as string | undefined
  const autoPrintBadge = body.auto_print_badge === true
  const attended = body.attended === true

  if (mode === "checkin_and_print" && (!printStationId || !isValidUUID(printStationId))) {
    return NextResponse.json({ error: "A Print Station must be selected for check-in + print mode." }, { status: 400 })
  }

  const { error: authError } = await requireEventAndPermission(eventId, "checkin")
  if (authError) return authError

  const supabase = await createAdminClient()

  // Every requested list must belong to this event -- a station bound to a
  // list from a different event would be a real authorization hole.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lists } = await (supabase as any)
    .from("checkin_lists")
    .select("id, event_id")
    .in("id", listIds)

  const foundIds = new Set((lists || []).map((l: any) => l.id))
  if (listIds.some((id) => !foundIds.has(id)) || (lists || []).some((l: any) => l.event_id !== eventId)) {
    return NextResponse.json({ error: "Check-in list not found for this event." }, { status: 404 })
  }

  if (mode === "checkin_and_print") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: printStation } = await (supabase as any)
      .from("print_stations")
      .select("id, event_id, print_settings")
      .eq("id", printStationId)
      .maybeSingle()

    if (!printStation || printStation.event_id !== eventId) {
      return NextResponse.json({ error: "Print Station not found for this event." }, { status: 404 })
    }
    if (printStation.print_settings?.printer_type !== "usb") {
      return NextResponse.json({ error: "Check-in + Print Badge stations require a USB-type Print Station." }, { status: 400 })
    }
  }

  const access_token = newStationToken()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: station, error } = await (supabase as any)
    .from("kiosk_stations")
    .insert({
      event_id: eventId,
      name,
      mode,
      // list_id is deliberately left unset -- kiosk_station_lists is the
      // source of truth for every station created from here on. The column
      // stays on the table only for stations created before this change.
      print_station_id: mode === "checkin_and_print" ? printStationId : null,
      auto_print_badge: mode === "checkin_and_print" ? autoPrintBadge : false,
      attended,
      access_token_hash: hashStationToken(access_token),
    })
    .select("id, event_id, name, mode, print_station_id, auto_print_badge, attended, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to create kiosk station." }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: joinError } = await (supabase as any)
    .from("kiosk_station_lists")
    .insert(listIds.map((checkin_list_id) => ({ station_id: station.id, checkin_list_id })))

  if (joinError) {
    return NextResponse.json({ error: "Station created but failed to assign lists." }, { status: 500 })
  }

  // access_token is returned ONLY in this creation response -- it is never
  // retrievable again (only its hash is stored server-side). If lost, the
  // only recourse is Task 3's regenerate endpoint.
  return NextResponse.json({ ...station, list_ids: listIds, access_token }, { status: 201 })
}
