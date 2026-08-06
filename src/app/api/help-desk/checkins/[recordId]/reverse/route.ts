import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { isValidUUID } from "@/lib/validation"

// POST /api/help-desk/checkins/[recordId]/reverse -- "reverse a wrong
// check-in" (work order §4), implemented as a compensating record per
// explicit product decision: the checkin_records row is updated in place
// (reversed_at/reversed_by/reversal_reason), never deleted. Distinct from
// checked_out_at (the existing "delegate legitimately left" mechanism used
// by the staff scan page's own Undo button).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const { recordId } = await params
  if (!isValidUUID(recordId)) {
    return NextResponse.json({ error: "Invalid check-in id" }, { status: 400 })
  }

  let body: { reason?: string } = {}
  try {
    body = await request.json()
  } catch {
    // No body is fine -- reason is optional.
  }

  const supabase = await createAdminClient()

  const { data: record, error: lookupError } = await (supabase as any)
    .from("checkin_records")
    .select("id, registration_id, checkin_list_id, reversed_at, checkin_lists (event_id)")
    .eq("id", recordId)
    .maybeSingle()

  if (lookupError || !record) {
    return NextResponse.json({ error: "Check-in not found" }, { status: 404 })
  }

  const eventId = record.checkin_lists?.event_id as string | undefined
  if (!eventId) {
    return NextResponse.json({ error: "Could not resolve the event for this check-in" }, { status: 500 })
  }

  const { user, error: authError } = await requireEventAndPermission(eventId, "checkin")
  if (authError) return authError

  if (record.reversed_at) {
    return NextResponse.json({ error: "This check-in has already been reversed" }, { status: 409 })
  }

  const performedBy = user!.name || user!.email || user!.id

  const { error: updateError } = await (supabase as any)
    .from("checkin_records")
    .update({
      reversed_at: new Date().toISOString(),
      reversed_by: user!.id,
      reversal_reason: body.reason || null,
    })
    .eq("id", recordId)

  if (updateError) {
    return NextResponse.json({ error: "Failed to reverse the check-in" }, { status: 500 })
  }

  await (supabase as any).from("checkin_audit_log").insert({
    event_id: eventId,
    checkin_list_id: record.checkin_list_id,
    registration_id: record.registration_id,
    action: "reversal",
    performed_by: performedBy,
    performed_via: "help_desk",
    success: true,
    device_info: body.reason ? { reason: body.reason } : null,
  })

  return NextResponse.json({ data: { id: recordId, reversed: true } })
}
