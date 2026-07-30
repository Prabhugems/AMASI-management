import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission, getEventIdFromRegistration } from "@/lib/auth/api-auth"

// GET /api/registrations/[id]/checkin-history -- every checkin_audit_log row
// for this registration (both success and failure, staff-scanner and kiosk),
// unlike /api/checkin/audit which only surfaces success:false rows. Needed
// because checkin_audit_log has RLS enabled with zero policies (same gap
// documented elsewhere in this codebase for checkin_lists) -- a direct
// browser query against it always silently returns zero rows regardless of
// actual data, so this admin-client route is required to read it at all.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const eventId = await getEventIdFromRegistration(id)
    if (!eventId) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }

    const { error: authError } = await requireEventAndPermission(eventId, "checkin")
    if (authError) return authError

    const supabase = await createAdminClient()

    const { data, error } = await (supabase as any)
      .from("checkin_audit_log")
      .select("id, created_at, action, performed_via, success, device_info, checkin_list_id, checkin_lists(name)")
      .eq("registration_id", id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: "Failed to load check-in history" }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch {
    return NextResponse.json({ error: "Failed to load check-in history" }, { status: 500 })
  }
}
