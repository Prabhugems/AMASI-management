import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { isValidUUID, validatePagination } from "@/lib/validation"

// GET /api/checkin/audit — failed check-in scans (checkin_audit_log where
// success = false) for an event, most recent first. Surfaces a false-scan
// pattern live during an event instead of via a manual SQL audit after the
// fact (see the 2026-07-13 incident note in CLAUDE.md: 2,205 legitimate
// repeat scans were mislogged as success:false and only found weeks later).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("event_id")
  const checkinListId = searchParams.get("checkin_list_id")

  if (!eventId || !isValidUUID(eventId)) {
    return NextResponse.json({ error: "Valid event_id is required" }, { status: 400 })
  }

  const { error: authError } = await requireEventAndPermission(eventId, "checkin")
  if (authError) return authError

  if (checkinListId && !isValidUUID(checkinListId)) {
    return NextResponse.json({ error: "Invalid checkin_list_id format" }, { status: 400 })
  }

  const { page, limit, offset } = validatePagination(
    searchParams.get("page"),
    searchParams.get("limit") || "50",
    100
  )

  const supabase = await createAdminClient()

  let query = (supabase as any)
    .from("checkin_audit_log")
    .select(
      `
      id,
      created_at,
      action,
      performed_by,
      performed_via,
      error_message,
      checkin_list_id,
      checkin_lists (name),
      registration_id,
      registrations (attendee_name, registration_number)
    `,
      { count: "exact" }
    )
    .eq("event_id", eventId)
    .eq("success", false)
    .order("created_at", { ascending: false })

  if (checkinListId) {
    query = query.eq("checkin_list_id", checkinListId)
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: "Failed to load audit log" }, { status: 500 })
  }

  return NextResponse.json({
    data: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  })
}
