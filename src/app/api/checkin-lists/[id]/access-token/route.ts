import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

// 24-char CSPRNG token (hex), matching generate_secure_token(24).
function newAccessToken(): string {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "").slice(0, 24)
}

// Event end + 2-day grace, or 30 days when the event has no end_date.
async function expiryForEvent(supabase: any, eventId: string): Promise<string> {
  const { data: ev } = await supabase.from("events").select("end_date").eq("id", eventId).single()
  const base = ev?.end_date ? new Date(ev.end_date).getTime() + 2 * 864e5 : Date.now() + 30 * 864e5
  return new Date(base).toISOString()
}

// POST /api/checkin-lists/[id]/access-token — ROTATE: mint a fresh token +
// expiry. The previous staff link stops working immediately.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createAdminClient()

  // Resolve the list's event first, then authorize against THAT event so a
  // user can't rotate a token for an event they don't manage.
  const { data: list, error: findErr } = await (supabase as any)
    .from("checkin_lists")
    .select("id, event_id")
    .eq("id", id)
    .single()

  if (findErr || !list) {
    return NextResponse.json({ error: "Check-in list not found" }, { status: 404 })
  }

  const { error: authError } = await requireEventAndPermission(list.event_id, "checkin")
  if (authError) return authError

  const access_token = newAccessToken()
  const access_token_expires_at = await expiryForEvent(supabase, list.event_id)

  const { data, error } = await (supabase as any)
    .from("checkin_lists")
    .update({ access_token, access_token_expires_at, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, access_token, access_token_expires_at")
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to rotate access token" }, { status: 500 })
  }
  return NextResponse.json(data)
}

// DELETE /api/checkin-lists/[id]/access-token — REVOKE: expire the link now.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createAdminClient()

  // Resolve the list's event first, then authorize against THAT event.
  const { data: list, error: findErr } = await (supabase as any)
    .from("checkin_lists")
    .select("event_id")
    .eq("id", id)
    .single()

  if (findErr || !list) {
    return NextResponse.json({ error: "Check-in list not found" }, { status: 404 })
  }

  const { error: authError } = await requireEventAndPermission(list.event_id, "checkin")
  if (authError) return authError

  const { error } = await (supabase as any)
    .from("checkin_lists")
    .update({ access_token_expires_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: "Failed to revoke access" }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
