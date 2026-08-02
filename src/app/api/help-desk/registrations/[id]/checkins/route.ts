import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission, getEventIdFromRegistration } from "@/lib/auth/api-auth"
import { isValidUUID } from "@/lib/validation"

// GET /api/help-desk/registrations/[id]/checkins -- every checkin_records row
// for this delegate across the event: which list, which station, what time
// (work order §4). Unlike /api/registrations/[id]/checkin-history (the
// checkin_audit_log event stream, including failed/duplicate attempts), this
// is the actual current STATE per list -- what the help desk's "Reverse"
// action operates on.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid registration id" }, { status: 400 })
  }

  const eventId = await getEventIdFromRegistration(id)
  if (!eventId) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 })
  }

  const { error: authError } = await requireEventAndPermission(eventId, "checkin")
  if (authError) return authError

  const supabase = await createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("checkin_records")
    .select(
      "id, checkin_list_id, checked_in_at, checked_in_by, checked_out_at, reversed_at, reversed_by, reversal_reason, station_id, checkin_lists (name), kiosk_stations (name)"
    )
    .eq("registration_id", id)
    .order("checked_in_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: "Failed to load check-ins" }, { status: 500 })
  }

  return NextResponse.json({ data: data || [] })
}

// POST /api/help-desk/registrations/[id]/checkins -- manually check this
// delegate into a list (work order §4). checkin_records keeps its existing
// UNIQUE(checkin_list_id, registration_id) constraint, so this upserts: a
// prior row for the same list (whether active, checked-out, or reversed) is
// reactivated in place rather than inserting a second row.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid registration id" }, { status: 400 })
  }

  let body: { checkin_list_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const checkinListId = body.checkin_list_id
  if (!checkinListId || !isValidUUID(checkinListId)) {
    return NextResponse.json({ error: "Valid checkin_list_id is required" }, { status: 400 })
  }

  const eventId = await getEventIdFromRegistration(id)
  if (!eventId) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 })
  }

  const { user, error: authError } = await requireEventAndPermission(eventId, "checkin")
  if (authError) return authError

  const supabase = await createAdminClient()

  // Guard: the list must belong to the same event as the registration --
  // otherwise this would silently create a check-in against an unrelated
  // event's list.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: list } = await (supabase as any)
    .from("checkin_lists")
    .select("id, event_id, name")
    .eq("id", checkinListId)
    .maybeSingle()

  if (!list || list.event_id !== eventId) {
    return NextResponse.json({ error: "Check-in list not found for this event" }, { status: 404 })
  }

  const performedBy = user!.name || user!.email || user!.id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("checkin_records")
    .select("id, checked_out_at, reversed_at")
    .eq("checkin_list_id", checkinListId)
    .eq("registration_id", id)
    .maybeSingle()

  // Bug-audit fix (2026-08): this used to reactivate ANY existing row --
  // including one that's currently ACTIVE (not reversed, not checked out)
  // -- silently overwriting its real checked_in_at/checked_in_by/station_id
  // with "now"/this operator/no-station. An operator re-checking a
  // delegate's status who taps Check In on a list they're already on would
  // permanently lose the real scan time and station attribution that
  // reconciliation and the duplicate report depend on. Only a genuinely
  // inactive row (checked out or reversed) gets reactivated; an active one
  // is rejected instead.
  if (existing && !existing.checked_out_at && !existing.reversed_at) {
    return NextResponse.json(
      { error: "Already checked in to this list. Reverse the existing check-in first if this was a mistake." },
      { status: 409 }
    )
  }

  const nowIso = new Date().toISOString()
  let recordId = existing?.id as string | undefined

  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from("checkin_records")
      .update({
        checked_in_at: nowIso,
        checked_in_by: performedBy,
        checked_out_at: null,
        reversed_at: null,
        reversed_by: null,
        reversal_reason: null,
        station_id: null,
      })
      .eq("id", existing.id)

    if (updateError) {
      return NextResponse.json({ error: "Failed to check in" }, { status: 500 })
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error: insertError } = await (supabase as any)
      .from("checkin_records")
      .insert({
        checkin_list_id: checkinListId,
        registration_id: id,
        checked_in_at: nowIso,
        checked_in_by: performedBy,
      })
      .select("id")
      .single()

    if (insertError) {
      return NextResponse.json({ error: "Failed to check in" }, { status: 500 })
    }
    recordId = inserted?.id
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("checkin_audit_log").insert({
    event_id: eventId,
    checkin_list_id: checkinListId,
    registration_id: id,
    action: "manual_checkin",
    performed_by: performedBy,
    performed_via: "help_desk",
    success: true,
  })

  return NextResponse.json({ data: { id: recordId, checkin_list_id: checkinListId, checked_in_at: nowIso } })
}
