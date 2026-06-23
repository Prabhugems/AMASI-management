import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { DEFAULTS } from "@/lib/config"
import { getNextRegistrationNumber } from "@/lib/services/registration-number"

/**
 * POST /api/events/[eventId]/team/create-registrations
 *
 * Org/admin team members live in `team_members`, which the check-in engine
 * never reads (check-in is registration-based). To let the door check the
 * organising team in, we materialise each active team member assigned to this
 * event as a complimentary, confirmed registration under an "Organising Team"
 * ticket type. They then appear in check-in search, get a QR badge, and work in
 * every existing registration flow — no changes to the check-in engine.
 *
 * Idempotent: members who already have a registration for this event (matched
 * by email) are skipped, so it's safe to re-run after adding new team members.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId } = await params
    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Confirm the event exists
    const { data: event } = await (supabase as any)
      .from("events")
      .select("id")
      .eq("id", eventId)
      .maybeSingle()

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Fetch active team members assigned to THIS event. This mirrors the
    // membership shown on the event team page (event_ids includes eventId), so
    // the created count matches what the organiser sees there. All-events
    // platform admins (empty event_ids) are intentionally excluded — they are
    // not necessarily attending and shouldn't get junk registrations.
    const { data: allMembers } = await (supabase as any)
      .from("team_members")
      .select("id, email, name, phone, role, event_ids")
      .eq("is_active", true)
      .order("name", { ascending: true })

    const teamMembers = (allMembers || []).filter((m: any) => {
      const ids = m.event_ids as string[] | null | undefined
      return Array.isArray(ids) && ids.includes(eventId)
    })

    if (teamMembers.length === 0) {
      return NextResponse.json({
        success: true,
        created: 0,
        skipped: 0,
        total_team: 0,
        message: "No active team members are assigned to this event.",
      })
    }

    // Find or create the "Organising Team" ticket type (complimentary)
    let { data: teamTicket } = await (supabase as any)
      .from("ticket_types")
      .select("id, name")
      .eq("event_id", eventId)
      .ilike("name", "%organising team%")
      .limit(1)
      .maybeSingle()

    if (!teamTicket) {
      const { data: newTicket, error: ticketError } = await (supabase as any)
        .from("ticket_types")
        .insert({
          event_id: eventId,
          name: "Organising Team",
          description: "Complimentary ticket for the event organising team",
          price: 0,
          quantity_total: 1000,
          quantity_sold: 0,
          status: "active",
          sort_order: 0,
        })
        .select()
        .single()

      if (ticketError || !newTicket) {
        return NextResponse.json(
          { error: "Failed to create Organising Team ticket" },
          { status: 500 }
        )
      }
      teamTicket = newTicket
    }

    let created = 0
    let skipped = 0

    for (const member of teamMembers) {
      const email = (member.email || "").toLowerCase()
      if (!email) {
        skipped++
        continue
      }

      // Idempotency: skip if this member already has a registration for the event
      const { data: existing } = await (supabase as any)
        .from("registrations")
        .select("id")
        .eq("event_id", eventId)
        .eq("attendee_email", email)
        .maybeSingle()

      if (existing) {
        skipped++
        continue
      }

      const registrationNumber = await getNextRegistrationNumber(supabase, eventId)

      const { error: regError } = await (supabase as any)
        .from("registrations")
        .insert({
          event_id: eventId,
          ticket_type_id: teamTicket.id,
          registration_number: registrationNumber,
          attendee_name: member.name,
          attendee_email: email,
          attendee_phone: member.phone || null,
          attendee_designation: "Organising Team",
          attendee_country: DEFAULTS.country,
          checkin_token: crypto.randomUUID(),
          quantity: 1,
          unit_price: 0,
          tax_amount: 0,
          discount_amount: 0,
          total_amount: 0,
          status: "confirmed",
          payment_status: "completed",
          participation_mode: "offline",
          custom_fields: {
            source: "team_member",
            team_member_id: member.id,
            team_role: member.role || null,
          },
        })

      if (!regError) {
        created++
      } else {
        skipped++
      }
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total_team: teamMembers.length,
      ticket_name: teamTicket.name,
    })
  } catch (error: any) {
    console.error("Error creating team registrations:", error)
    return NextResponse.json(
      { error: "Failed to create team registrations" },
      { status: 500 }
    )
  }
}
