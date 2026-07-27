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
    .select("id, event_id, name, mode, list_id, last_seen_at, revoked_at, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: "Failed to load kiosk stations." }, { status: 500 })
  }
  return NextResponse.json({ stations: data || [] })
}

// POST /api/kiosk-stations -- create a station and mint its access token.
// mode is hardcoded "checkin" -- this stage never creates a "print"-mode
// station (see this plan's Global Constraints).
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const eventId = body.event_id as string | undefined
  const name = (body.name as string | undefined)?.trim()
  const listId = body.list_id as string | undefined

  if (!eventId || !isValidUUID(eventId)) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 })
  }
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 })
  }
  if (!listId || !isValidUUID(listId)) {
    return NextResponse.json({ error: "A check-in list must be selected." }, { status: 400 })
  }

  const { error: authError } = await requireEventAndPermission(eventId, "checkin")
  if (authError) return authError

  const supabase = await createAdminClient()

  // Confirm the list actually belongs to this event -- a station bound to a
  // list from a different event would be a real authorization hole, not
  // just bad data.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: list } = await (supabase as any)
    .from("checkin_lists")
    .select("id, event_id")
    .eq("id", listId)
    .maybeSingle()

  if (!list || list.event_id !== eventId) {
    return NextResponse.json({ error: "Check-in list not found for this event." }, { status: 404 })
  }

  const access_token = newStationToken()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: station, error } = await (supabase as any)
    .from("kiosk_stations")
    .insert({
      event_id: eventId,
      name,
      mode: "checkin",
      list_id: listId,
      access_token_hash: hashStationToken(access_token),
    })
    .select("id, event_id, name, mode, list_id, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to create kiosk station." }, { status: 500 })
  }

  // access_token is returned ONLY in this creation response -- it is never
  // retrievable again (only its hash is stored server-side). If lost, the
  // only recourse is Task 3's regenerate endpoint.
  return NextResponse.json({ ...station, access_token }, { status: 201 })
}
