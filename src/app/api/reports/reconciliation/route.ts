import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { isValidUUID } from "@/lib/validation"

// GET /api/reports/reconciliation?event_id= -- end-of-day reconciliation,
// per list and per station (work order §7.1). "Eligible" mirrors
// /api/checkin-lists' own stats computation (ticket_type_ids/addon_ids
// match, status=confirmed) -- there's no literal "meals ordered" or "kits
// stocked" count anywhere in this schema, so eligible-registrant count is
// the closest real denominator; each list's own type (entry_access /
// food_drink / goods_kits) is returned so the UI can label it honestly
// rather than implying a stock/order system that doesn't exist.
//
// Per-station breakdown is what catches a desk scanning into the wrong
// list: if a list's checked-in total is right but one station's share of it
// looks implausible (e.g. zero from a station known to be busy, or a
// station appearing on a list it was never assigned), that's the signal.
//
// Intentionally does not reference checkin_records.reversed_at/reversed_by
// -- those columns exist only in a migration written this session and NOT
// YET APPLIED (see supabase/migrations/20260802_checkin_records_reversal.sql).
// Referencing them here before that migration is applied would 500 this
// route in production, the exact "code shipped ahead of its migration"
// incident class this repo has hit repeatedly. Once applied, this query
// should add `.is("reversed_at", null)` alongside the existing
// `.is("checked_out_at", null)` filter.
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
  const { data: lists, error: listsError } = await (supabase as any)
    .from("checkin_lists")
    .select("id, name, category, list_purpose, ticket_type_ids, addon_ids")
    .eq("event_id", eventId)
    .order("sort_order")

  if (listsError) {
    return NextResponse.json({ error: "Failed to load check-in lists" }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stations } = await (supabase as any)
    .from("kiosk_stations")
    .select("id, name")
    .eq("event_id", eventId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stationNameById = new Map<string, string>((stations || []).map((s: any) => [s.id, s.name]))

  const report = await Promise.all(
    (lists || []).map(async (list: { id: string; name: string; category: string; list_purpose: string; ticket_type_ids: string[] | null; addon_ids: string[] | null }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let totalQuery = (supabase as any)
        .from("registrations")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("status", "confirmed")
      if (list.ticket_type_ids && list.ticket_type_ids.length > 0) {
        totalQuery = totalQuery.in("ticket_type_id", list.ticket_type_ids)
      }
      const { count: eligibleCount } = await totalQuery

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: checkinRows } = await (supabase as any)
        .from("checkin_records")
        .select("station_id")
        .eq("checkin_list_id", list.id)
        .is("checked_out_at", null)

      const byStation = new Map<string, number>()
      for (const row of checkinRows || []) {
        const key = row.station_id ? stationNameById.get(row.station_id) || "Unknown station" : "No station (link/manual)"
        byStation.set(key, (byStation.get(key) || 0) + 1)
      }

      const checkedIn = (checkinRows || []).length
      return {
        listId: list.id,
        listName: list.name,
        category: list.category,
        listPurpose: list.list_purpose,
        eligible: eligibleCount || 0,
        checkedIn,
        remaining: Math.max(0, (eligibleCount || 0) - checkedIn),
        percentage: eligibleCount ? Math.round((checkedIn / eligibleCount) * 100) : 0,
        byStation: Array.from(byStation.entries()).map(([station, count]) => ({ station, count })),
      }
    })
  )

  return NextResponse.json({ data: report })
}
