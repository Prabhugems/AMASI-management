import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { isValidUUID } from "@/lib/validation"

// GET /api/reports/duplicates?event_id= -- every cross-desk duplicate caught
// after sync (work order §7.2): delegate, both stations, both times. This is
// the evidence when a count is questioned.
//
// Scoped to the KIOSK path only (checkin_audit_log rows the kiosk itself
// writes with device_info.duplicate=true, see
// src/app/api/kiosk/checkin/route.ts's logKioskDuplicateAudit) -- the
// separate staff-scanner endpoint (/api/verify/[token]) marks its own
// duplicates differently (action variable + error_message, no consistent
// device_info marker), and reconciling both conventions into one query
// needs more archaeology than this pass covers. Noted here rather than
// silently missing: a staff-scanner-caught duplicate will NOT appear in
// this report yet.
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
  const { data: duplicateRows, error } = await (supabase as any)
    .from("checkin_audit_log")
    .select(
      "id, created_at, checkin_list_id, registration_id, device_info, checkin_lists (name), registrations (attendee_name, registration_number)"
    )
    .eq("event_id", eventId)
    .eq("performed_via", "kiosk")
    .contains("device_info", { duplicate: true })
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: "Failed to load duplicate report" }, { status: 500 })
  }

  if (!duplicateRows || duplicateRows.length === 0) {
    return NextResponse.json({ data: [] })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stations } = await (supabase as any).from("kiosk_stations").select("id, name").eq("event_id", eventId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stationNameById = new Map<string, string>((stations || []).map((s: any) => [s.id, s.name]))

  // For each duplicate attempt, find the ORIGINAL (currently-active) check-in
  // for the same registration+list, to show "both stations, both times".
  const results = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    duplicateRows.map(async (row: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: original } = await (supabase as any)
        .from("checkin_records")
        .select("station_id, checked_in_at")
        .eq("registration_id", row.registration_id)
        .eq("checkin_list_id", row.checkin_list_id)
        .is("checked_out_at", null)
        .maybeSingle()

      const duplicateStationId = row.device_info?.station_id as string | undefined

      return {
        id: row.id,
        attendeeName: row.registrations?.attendee_name || "Unknown",
        registrationNumber: row.registrations?.registration_number || "",
        listName: row.checkin_lists?.name || "Unknown list",
        originalStation: original?.station_id ? stationNameById.get(original.station_id) || "Unknown station" : "Unknown station",
        originalTime: original?.checked_in_at || null,
        duplicateStation: duplicateStationId ? stationNameById.get(duplicateStationId) || "Unknown station" : "Unknown station",
        duplicateTime: row.created_at,
        crossDesk: Boolean(
          original?.station_id && duplicateStationId && original.station_id !== duplicateStationId
        ),
      }
    })
  )

  return NextResponse.json({ data: results })
}
