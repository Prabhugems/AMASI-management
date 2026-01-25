import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// GET /api/checkin/stats - Get check-in statistics for a specific list
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")
    const checkinListId = searchParams.get("checkin_list_id")

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    if (!checkinListId) {
      return NextResponse.json({ error: "checkin_list_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Get the check-in list details
    const { data: checkinList, error: listError } = await (supabase as any)
      .from("checkin_lists")
      .select("*")
      .eq("id", checkinListId)
      .single()

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

    // Build query for total eligible registrations
    let totalQuery = (supabase as any)
      .from("registrations")
      .select("id", { count: "exact" })
      .eq("event_id", eventId)
      .eq("status", "confirmed")

    // Filter by ticket types if specified
    if (checkinList.ticket_type_ids?.length > 0) {
      totalQuery = totalQuery.in("ticket_type_id", checkinList.ticket_type_ids)
    }

    // Filter by addon purchases if specified
    if (addonFilteredRegIds !== null) {
      if (addonFilteredRegIds.length === 0) {
        // No registrations with these addons, return zero stats
        return NextResponse.json({
          list: {
            id: checkinList.id,
            name: checkinList.name,
            description: checkinList.description
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
      totalQuery = totalQuery.in("id", addonFilteredRegIds)
    }

    const { data: eligibleRegs, count: totalCount } = await totalQuery

    // Get checked-in count for this list - only for ELIGIBLE registrations
    let checkedInCount = 0
    if (eligibleRegs && eligibleRegs.length > 0) {
      const eligibleRegIds = eligibleRegs.map((r: any) => r.id)
      const { count } = await (supabase as any)
        .from("checkin_records")
        .select("*", { count: "exact", head: true })
        .eq("checkin_list_id", checkinListId)
        .in("registration_id", eligibleRegIds)
        .is("checked_out_at", null)
      checkedInCount = count || 0
    }

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

    const ticketStats = []
    for (const ticket of filteredTicketTypes) {
      let ticketTotalQuery = (supabase as any)
        .from("registrations")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("ticket_type_id", ticket.id)
        .eq("status", "confirmed")

      // Apply addon filter to ticket stats too
      if (addonFilteredRegIds !== null) {
        ticketTotalQuery = ticketTotalQuery.in("id", addonFilteredRegIds)
      }

      const { count: ticketTotal } = await ticketTotalQuery

      // Get checked-in count for this ticket type in this list
      let ticketRegsQuery = (supabase as any)
        .from("registrations")
        .select("id")
        .eq("event_id", eventId)
        .eq("ticket_type_id", ticket.id)
        .eq("status", "confirmed")

      // Apply addon filter
      if (addonFilteredRegIds !== null) {
        ticketRegsQuery = ticketRegsQuery.in("id", addonFilteredRegIds)
      }

      const { data: ticketRegs } = await ticketRegsQuery

      const regIds = (ticketRegs || []).map((r: any) => r.id)

      let ticketCheckedIn = 0
      if (regIds.length > 0) {
        const { count } = await (supabase as any)
          .from("checkin_records")
          .select("*", { count: "exact", head: true })
          .eq("checkin_list_id", checkinListId)
          .in("registration_id", regIds)
          .is("checked_out_at", null)
        ticketCheckedIn = count || 0
      }

      ticketStats.push({
        id: ticket.id,
        name: ticket.name,
        total: ticketTotal || 0,
        checkedIn: ticketCheckedIn,
        notCheckedIn: (ticketTotal || 0) - ticketCheckedIn,
        percentage: ticketTotal ? Math.round(ticketCheckedIn / ticketTotal * 100) : 0
      })
    }

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
        description: checkinList.description
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
