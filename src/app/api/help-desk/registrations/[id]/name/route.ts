import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission, getEventIdFromRegistration } from "@/lib/auth/api-auth"
import { isValidUUID } from "@/lib/validation"

// POST /api/help-desk/registrations/[id]/name -- edit a delegate's name
// (work order §4), audit-logged. Deliberately NOT reusing the general
// PATCH /api/registrations/[id] route: that route also cross-syncs the name
// into sessions.speakers/chairpersons/moderators and faculty/
// faculty_assignments by email-match (regex replace) -- surprising,
// speaker-specific side effects that a help desk operator fixing a typo'd
// delegate name should not silently trigger.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid registration id" }, { status: 400 })
  }

  let body: { attendee_name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const newName = body.attendee_name?.trim()
  if (!newName) {
    return NextResponse.json({ error: "attendee_name is required" }, { status: 400 })
  }

  const eventId = await getEventIdFromRegistration(id)
  if (!eventId) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 })
  }

  // Bug-audit fix (2026-08): this edits registrations.attendee_name, the
  // exact field the general-purpose PATCH /api/registrations/[id] route
  // gates behind the 'registrations' permission -- this route wrongly used
  // 'checkin' instead, letting a volunteer deliberately granted check-in-
  // only access (and no 'registrations' permission, specifically to prevent
  // them editing attendee records) rename any delegate on the event anyway.
  const { user, error: authError } = await requireEventAndPermission(eventId, "registrations")
  if (authError) return authError

  const supabase = await createAdminClient()

  const { data: current } = await (supabase as any)
    .from("registrations")
    .select("attendee_name")
    .eq("id", id)
    .maybeSingle()

  const oldName = current?.attendee_name ?? null

  const { error: updateError } = await (supabase as any)
    .from("registrations")
    .update({ attendee_name: newName })
    .eq("id", id)

  if (updateError) {
    return NextResponse.json({ error: "Failed to update name" }, { status: 500 })
  }

  const performedBy = user!.name || user!.email || user!.id

  await (supabase as any).from("checkin_audit_log").insert({
    event_id: eventId,
    registration_id: id,
    action: "name_edit",
    performed_by: performedBy,
    performed_via: "help_desk",
    success: true,
    device_info: { old_name: oldName, new_name: newName },
  })

  return NextResponse.json({ data: { attendee_name: newName } })
}
