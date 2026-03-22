import { NextResponse } from "next/server"
import { getApiUser } from "@/lib/auth/api-auth"
import { createAdminClient } from "@/lib/supabase/server"

interface Notification {
  id: string
  title: string
  message: string
  type: "info" | "warning" | "success" | "error"
  count: number
  link: string | null
  created_at: string
}

// GET /api/notifications - Get real-time notifications for the logged-in user
export async function GET() {
  try {
    const { user, error: authError } = await getApiUser()
    if (authError || !user) return authError || NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = await createAdminClient()
    const now = new Date()
    const notifications: Notification[] = []

    // 1. Get events the user has access to
    let eventFilter: string[] | null = null

    if (!user.is_super_admin) {
      // Check team membership for event scoping
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: teamMember } = await (supabase as any)
        .from("team_members")
        .select("event_ids")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle()

      const eventIds = teamMember?.event_ids as string[] | null
      if (eventIds && eventIds.length > 0) {
        eventFilter = eventIds
      }
    }

    // Get active events (not completed/cancelled)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let eventsQuery = (supabase as any)
      .from("events")
      .select("id, name, short_name, start_date, end_date, status")
      .not("status", "in", '("completed","cancelled")')

    if (eventFilter) {
      eventsQuery = eventsQuery.in("id", eventFilter)
    }

    const { data: events } = await eventsQuery

    if (!events || events.length === 0) {
      return NextResponse.json({ notifications: [], unread_count: 0 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eventIds = events.map((e: any) => e.id)

    // Run all notification queries in parallel
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

    const [
      pendingPaymentsResult,
      newRegistrationsResult,
      failedEmailsResult,
      ticketTypesResult,
    ] = await Promise.all([
      // 2. Pending payments - registrations with payment_status='pending' older than 24 hours
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("registrations")
        .select("id, event_id, created_at", { count: "exact", head: true })
        .in("event_id", eventIds)
        .eq("payment_status", "pending")
        .neq("status", "cancelled")
        .lt("created_at", twentyFourHoursAgo),

      // 3. New registrations in last 24 hours
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("registrations")
        .select("id, event_id", { count: "exact", head: true })
        .in("event_id", eventIds)
        .neq("status", "cancelled")
        .gte("created_at", twentyFourHoursAgo),

      // 4. Failed emails in last 7 days
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("email_logs")
        .select("id", { count: "exact", head: true })
        .in("event_id", eventIds)
        .eq("status", "failed")
        .gte("sent_at", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()),

      // 5. Ticket types with quantity tracking
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("ticket_types")
        .select("id, name, event_id, quantity_total, quantity_sold, status")
        .in("event_id", eventIds)
        .eq("status", "active")
        .gt("quantity_total", 0),
    ])

    // Process pending payments
    const pendingCount = pendingPaymentsResult.count || 0
    if (pendingCount > 0) {
      notifications.push({
        id: "pending-payments",
        title: "Pending Payments",
        message: `${pendingCount} registration${pendingCount > 1 ? "s" : ""} pending payment for over 24 hours`,
        type: "warning",
        count: pendingCount,
        link: events.length === 1 ? `/events/${events[0].id}/registrations?payment_status=pending` : null,
        created_at: now.toISOString(),
      })
    }

    // Process new registrations
    const newRegCount = newRegistrationsResult.count || 0
    if (newRegCount > 0) {
      notifications.push({
        id: "new-registrations",
        title: "New Registrations",
        message: `${newRegCount} new registration${newRegCount > 1 ? "s" : ""} today`,
        type: "success",
        count: newRegCount,
        link: events.length === 1 ? `/events/${events[0].id}/registrations` : null,
        created_at: now.toISOString(),
      })
    }

    // Process event countdowns
    for (const event of events) {
      const startDate = new Date(event.start_date)
      const daysUntil = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      if (daysUntil > 0 && daysUntil <= 7) {
        const eventName = event.short_name || event.name
        notifications.push({
          id: `event-countdown-${event.id}`,
          title: "Event Countdown",
          message: `${eventName} starts in ${daysUntil} day${daysUntil > 1 ? "s" : ""}!`,
          type: "info",
          count: daysUntil,
          link: `/events/${event.id}`,
          created_at: now.toISOString(),
        })
      } else if (daysUntil === 0) {
        const eventName = event.short_name || event.name
        notifications.push({
          id: `event-today-${event.id}`,
          title: "Event Today",
          message: `${eventName} starts today!`,
          type: "info",
          count: 0,
          link: `/events/${event.id}`,
          created_at: now.toISOString(),
        })
      }
    }

    // Process failed emails
    const failedCount = failedEmailsResult.count || 0
    if (failedCount > 0) {
      notifications.push({
        id: "failed-emails",
        title: "Email Delivery Failures",
        message: `${failedCount} email${failedCount > 1 ? "s" : ""} failed to deliver this week`,
        type: "error",
        count: failedCount,
        link: null,
        created_at: now.toISOString(),
      })
    }

    // Process low ticket availability
    const ticketTypes = ticketTypesResult.data || []
    for (const ticket of ticketTypes) {
      if (!ticket.quantity_total || ticket.quantity_total === 0) continue
      const soldPercent = Math.round(((ticket.quantity_sold || 0) / ticket.quantity_total) * 100)
      if (soldPercent >= 80) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const event = events.find((e: any) => e.id === ticket.event_id)
        const eventName = event?.short_name || event?.name || ""
        const remaining = ticket.quantity_total - (ticket.quantity_sold || 0)
        notifications.push({
          id: `low-tickets-${ticket.id}`,
          title: "Low Ticket Availability",
          message: `${ticket.name} ${soldPercent}% sold${eventName ? ` (${eventName})` : ""} - ${remaining} left`,
          type: soldPercent >= 95 ? "error" : "warning",
          count: remaining,
          link: event ? `/events/${event.id}/registrations` : null,
          created_at: now.toISOString(),
        })
      }
    }

    // Sort: errors first, then warnings, then info, then success
    const typePriority: Record<string, number> = { error: 0, warning: 1, info: 2, success: 3 }
    notifications.sort((a, b) => (typePriority[a.type] ?? 4) - (typePriority[b.type] ?? 4))

    return NextResponse.json({
      notifications,
      unread_count: notifications.length,
    })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Notifications API error:", error)
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }
}
