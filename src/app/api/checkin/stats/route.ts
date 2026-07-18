import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isValidUUID } from "@/lib/validation"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

// Fetch all rows from a paginated PostgREST query, working around the default
// 1000-row cap so 2000+ delegate events count correctly. The factory rebuilds
// the query per page because Supabase query builders aren't reusable.
async function fetchAllRows<T>(
  makeQuery: (from: number, to: number) => any
): Promise<T[]> {
  const pageSize = 1000
  const all: T[] = []
  let from = 0
  // Hard stop well above any realistic event size to avoid an infinite loop.
  for (let page = 0; page < 50; page++) {
    const { data, error } = await makeQuery(from, from + pageSize - 1)
    if (error) throw error
    const rows = (data || []) as T[]
    all.push(...rows)
    if (rows.length < pageSize) break
    from += pageSize
  }
  return all
}

// GET /api/checkin/stats - Get check-in statistics for a specific list
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")
    const checkinListId = searchParams.get("checkin_list_id")

    if (!eventId || !isValidUUID(eventId)) {
      return NextResponse.json({ error: "Valid event_id is required" }, { status: 400 })
    }

    // Response includes the list's staff access_token — scope to the
    // caller's actual permission on THIS event, not just any logged-in user.
    const { error: authError } = await requireEventAndPermission(eventId, "checkin")
    if (authError) return authError

    if (!checkinListId || !isValidUUID(checkinListId)) {
      return NextResponse.json({ error: "Valid checkin_list_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Get the check-in list details
    const { data: checkinList, error: listError } = await (supabase as any)
      .from("checkin_lists")
      .select("*")
      .eq("id", checkinListId)
      .maybeSingle()

    if (listError || !checkinList) {
      return NextResponse.json({ error: "Check-in list not found" }, { status: 404 })
    }

    // If addon_ids filter is set, get registration IDs that have purchased those addons
    let addonFilteredRegIds: string[] | null = null
    if (checkinList.addon_ids?.length > 0) {
      const { data: addonRegs } = await (supabase as any)
        .from("registration_addons")
        .select("registration_id")
        .in("addon_id", checkinList.addon_ids)

      addonFilteredRegIds = [...new Set((addonRegs || []).map((r: any) => r.registration_id))] as string[]
    }

    // If an addon filter is set but matched no registrations, return zero stats
    if (addonFilteredRegIds !== null && addonFilteredRegIds.length === 0) {
      return NextResponse.json({
        list: {
          id: checkinList.id,
          name: checkinList.name,
          description: checkinList.description,
          access_token: checkinList.access_token,
          access_token_expires_at: checkinList.access_token_expires_at
        },
        total: 0,
        checkedIn: 0,
        notCheckedIn: 0,
        percentage: 0,
        byTicketType: [],
        recentCheckins: [],
        hourlyDistribution: {},
        todayCheckins: 0
      })
    }

    // Fetch every eligible registration ONCE (id + ticket_type_id), paginated to
    // beat the 1000-row cap. Everything that used to be a per-ticket-type query
    // (total + checked-in) is now grouped in JS over this single result set.
    const eligibleRegs = await fetchAllRows<{ id: string; ticket_type_id: string | null }>(
      (from, to) => {
        let q = (supabase as any)
          .from("registrations")
          .select("id, ticket_type_id")
          .eq("event_id", eventId)
          .eq("status", "confirmed")
        if (checkinList.ticket_type_ids?.length > 0) {
          q = q.in("ticket_type_id", checkinList.ticket_type_ids)
        }
        if (addonFilteredRegIds !== null) {
          q = q.in("id", addonFilteredRegIds)
        }
        return q.range(from, to)
      }
    )

    const totalCount = eligibleRegs.length
    const eligibleIdSet = new Set(eligibleRegs.map((r) => r.id))
    const regToTicket = new Map(eligibleRegs.map((r) => [r.id, r.ticket_type_id]))

    // Per-ticket-type totals, grouped in JS (no per-ticket round-trips)
    const totalByTicket = new Map<string, number>()
    for (const r of eligibleRegs) {
      if (r.ticket_type_id) {
        totalByTicket.set(r.ticket_type_id, (totalByTicket.get(r.ticket_type_id) || 0) + 1)
      }
    }

    // Fetch active check-in records for this list ONCE (registration_id only),
    // paginated. No eligible-UUID array is sent back into an .in() filter;
    // eligibility + per-ticket grouping are resolved in JS via the maps above.
    // Distinct registration_ids handle allow_multiple_checkins correctly.
    const activeCheckins = await fetchAllRows<{ registration_id: string }>(
      (from, to) => (supabase as any)
        .from("checkin_records")
        .select("registration_id")
        .eq("checkin_list_id", checkinListId)
        .is("checked_out_at", null)
        .range(from, to)
    )

    const distinctCheckedIn = new Set<string>()
    const checkedInByTicket = new Map<string, Set<string>>()
    for (const rec of activeCheckins) {
      const regId = rec.registration_id
      if (!eligibleIdSet.has(regId)) continue
      distinctCheckedIn.add(regId)
      const ticketId = regToTicket.get(regId)
      if (ticketId) {
        if (!checkedInByTicket.has(ticketId)) checkedInByTicket.set(ticketId, new Set())
        checkedInByTicket.get(ticketId)!.add(regId)
      }
    }
    const checkedInCount = distinctCheckedIn.size

    // Get stats by ticket type
    const { data: ticketTypes } = await (supabase as any)
      .from("ticket_types")
      .select("id, name")
      .eq("event_id", eventId)
      .eq("status", "active")
      .order("sort_order")

    // Filter ticket types if list has restrictions
    const filteredTicketTypes = checkinList.ticket_type_ids?.length > 0
      ? (ticketTypes || []).filter((t: any) => checkinList.ticket_type_ids.includes(t.id))
      : ticketTypes || []

    const ticketStats = filteredTicketTypes.map((ticket: any) => {
      const ticketTotal = totalByTicket.get(ticket.id) || 0
      const ticketCheckedIn = checkedInByTicket.get(ticket.id)?.size || 0
      return {
        id: ticket.id,
        name: ticket.name,
        total: ticketTotal,
        checkedIn: ticketCheckedIn,
        notCheckedIn: ticketTotal - ticketCheckedIn,
        percentage: ticketTotal ? Math.round(ticketCheckedIn / ticketTotal * 100) : 0
      }
    })

    // Get recent check-ins (last 10)
    const { data: recentCheckins } = await (supabase as any)
      .from("checkin_records")
      .select(`
        id,
        checked_in_at,
        registrations (
          id,
          registration_number,
          attendee_name,
          ticket_types (name)
        )
      `)
      .eq("checkin_list_id", checkinListId)
      .is("checked_out_at", null)
      .order("checked_in_at", { ascending: false })
      .limit(10)

    // Format recent check-ins
    const formattedRecentCheckins = (recentCheckins || []).map((r: any) => ({
      id: r.id,
      registration_number: r.registrations?.registration_number,
      attendee_name: r.registrations?.attendee_name,
      checked_in_at: r.checked_in_at,
      ticket_type: r.registrations?.ticket_types?.name
    }))

    // Get hourly check-in distribution for today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { data: todayCheckins } = await (supabase as any)
      .from("checkin_records")
      .select("checked_in_at")
      .eq("checkin_list_id", checkinListId)
      .gte("checked_in_at", today.toISOString())

    const hourlyDistribution: Record<number, number> = {}
    for (let i = 0; i < 24; i++) {
      hourlyDistribution[i] = 0
    }

    for (const checkin of todayCheckins || []) {
      if (checkin.checked_in_at) {
        const hour = new Date(checkin.checked_in_at).getHours()
        hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1
      }
    }

    return NextResponse.json({
      list: {
        id: checkinList.id,
        name: checkinList.name,
        description: checkinList.description,
        access_token: checkinList.access_token,
        access_token_expires_at: checkinList.access_token_expires_at
      },
      total: totalCount || 0,
      checkedIn: checkedInCount || 0,
      notCheckedIn: (totalCount || 0) - (checkedInCount || 0),
      percentage: totalCount ? Math.round((checkedInCount || 0) / totalCount * 100) : 0,
      byTicketType: ticketStats,
      recentCheckins: formattedRecentCheckins,
      hourlyDistribution,
      todayCheckins: todayCheckins?.length || 0
    })
  } catch (error: any) {
    console.error("Error fetching check-in stats:", error)
    return NextResponse.json({ error: "Failed to fetch check-in stats" }, { status: 500 })
  }
}
