import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { isValidUUID } from "@/lib/validation"

const ACTIVITY_LIMIT = 20

interface ActivityItem {
  type: "check_in" | "duplicate"
  registration_name: string | null
  registration_number: string | null
  list_name: string | null
  at: string
}

// GET /api/kiosk-stations/[id]/activity -- the "recent activity" feed on the
// per-station detail page. There is no single table with "everything this
// station has done": checkin_records (has a real station_id column) covers
// first-time, successful check-ins; checkin_audit_log covers kiosk repeat-
// scan attempts, but only ever tags a station via device_info.station_id --
// see src/app/api/kiosk/checkin/route.ts's duplicate-audit insert -- because
// a repeat scan never creates a new checkin_records row at all (the
// UNIQUE(checkin_list_id, registration_id) constraint means there's nothing
// new to attribute). Both queries fetch a bounded page and filter/merge in
// JS rather than filtering the JSONB device_info column at the DB layer,
// matching this codebase's existing pattern for checkin_audit_log reads
// (see /api/registrations/[id]/checkin-history).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid station id." }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: station, error: findErr } = await (supabase as any)
    .from("kiosk_stations")
    .select("id, event_id")
    .eq("id", id)
    .maybeSingle()

  if (findErr) {
    return NextResponse.json({ error: "Failed to load station." }, { status: 500 })
  }
  if (!station) {
    return NextResponse.json({ error: "Kiosk station not found." }, { status: 404 })
  }

  const { error: authError } = await requireEventAndPermission(station.event_id, "checkin")
  if (authError) return authError

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: checkins, error: checkinsErr } = await (supabase as any)
    .from("checkin_records")
    .select("checked_in_at, registrations (attendee_name, registration_number), checkin_lists (name)")
    .eq("station_id", id)
    .order("checked_in_at", { ascending: false })
    .limit(ACTIVITY_LIMIT)

  if (checkinsErr) {
    return NextResponse.json({ error: "Failed to load check-ins." }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: auditRows, error: auditErr } = await (supabase as any)
    .from("checkin_audit_log")
    .select("created_at, device_info, registrations (attendee_name, registration_number), checkin_lists (name)")
    .eq("event_id", station.event_id)
    .eq("action", "check_in")
    .eq("success", true)
    .order("created_at", { ascending: false })
    .limit(200)

  if (auditErr) {
    return NextResponse.json({ error: "Failed to load activity log." }, { status: 500 })
  }

  const checkinItems: ActivityItem[] = (checkins || []).map((row: any) => ({
    type: "check_in",
    registration_name: row.registrations?.attendee_name ?? null,
    registration_number: row.registrations?.registration_number ?? null,
    list_name: row.checkin_lists?.name ?? null,
    at: row.checked_in_at,
  }))

  const duplicateItems: ActivityItem[] = (auditRows || [])
    .filter((row: any) => row.device_info?.duplicate === true && row.device_info?.station_id === id)
    .map((row: any) => ({
      type: "duplicate",
      registration_name: row.registrations?.attendee_name ?? null,
      registration_number: row.registrations?.registration_number ?? null,
      list_name: row.checkin_lists?.name ?? null,
      at: row.created_at,
    }))

  const activity = [...checkinItems, ...duplicateItems]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, ACTIVITY_LIMIT)

  return NextResponse.json({ activity })
}
