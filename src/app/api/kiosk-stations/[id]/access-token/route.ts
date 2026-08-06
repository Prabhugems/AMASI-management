import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { newStationToken, hashStationToken } from "@/lib/kiosk-station-auth"

// POST /api/kiosk-stations/[id]/access-token -- ROTATE: mint a fresh token,
// invalidating the old one immediately (a new hash overwrites the old one).
// The physical device must be re-provisioned -- open the new /kiosk-station
// URL -- to keep working; an already-open tab on the old token 401s at its
// next roster refresh (see Task 6).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createAdminClient()

  const { data: station, error: findErr } = await (supabase as any)
    .from("kiosk_stations")
    .select("id, event_id")
    .eq("id", id)
    .maybeSingle()

  if (findErr || !station) {
    return NextResponse.json({ error: "Kiosk station not found." }, { status: 404 })
  }

  const { error: authError } = await requireEventAndPermission(station.event_id, "checkin")
  if (authError) return authError

  const access_token = newStationToken()

  const { data, error } = await (supabase as any)
    .from("kiosk_stations")
    .update({
      access_token_hash: hashStationToken(access_token),
      revoked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, name")
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to rotate access token." }, { status: 500 })
  }
  return NextResponse.json({ ...data, access_token })
}

// DELETE /api/kiosk-stations/[id]/access-token -- REVOKE: the station stops
// authenticating for /api/kiosk/delegates immediately (checked at the
// device's next page load / roster refresh, not mid-session -- same
// accepted trade-off as checkin_lists' own revoke, Stage 1).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createAdminClient()

  const { data: station, error: findErr } = await (supabase as any)
    .from("kiosk_stations")
    .select("event_id")
    .eq("id", id)
    .maybeSingle()

  if (findErr || !station) {
    return NextResponse.json({ error: "Kiosk station not found." }, { status: 404 })
  }

  const { error: authError } = await requireEventAndPermission(station.event_id, "checkin")
  if (authError) return authError

  const { error } = await (supabase as any)
    .from("kiosk_stations")
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: "Failed to revoke access." }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
