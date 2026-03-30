import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { requireEventAndPermission, getEventIdFromRegistration } from "@/lib/auth/api-auth"

// GET - Get single registration (requires event access)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get event ID from registration
    const eventId = await getEventIdFromRegistration(id)
    if (!eventId) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }

    // Check authorization
    const { error: authError } = await requireEventAndPermission(eventId, 'registrations')
    if (authError) return authError

    const supabase = await createServerSupabaseClient()

    const { data, error } = await (supabase as any)
      .from("registrations")
      .select(`
        *,
        ticket_type:ticket_types(id, name, price, description),
        event:events(id, name, short_name, start_date, end_date, venue_name, city)
      `)
      .eq("id", id)
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to process registration request" }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to process registration request" }, { status: 500 })
  }
}

// PATCH - Update registration (requires event access)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get event ID from registration
    const eventId = await getEventIdFromRegistration(id)
    if (!eventId) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }

    // Check authorization
    const { error: authError } = await requireEventAndPermission(eventId, 'registrations')
    if (authError) return authError

    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    // First, get the current registration to check status change and name
    const { data: currentReg, error: fetchError } = await (supabase as any)
      .from("registrations")
      .select("status, ticket_type_id, quantity, attendee_name, attendee_email, event_id")
      .eq("id", id)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const allowedFields = [
      "status",
      "payment_status",
      "checked_in",
      "checked_in_at",
      "attendee_name",
      "attendee_email",
      "attendee_phone",
      "attendee_institution",
      "attendee_designation",
      "registration_number",
      "notes",
    ]

    const updateData: any = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Auto-set checked_in_at when checking in
    if (body.checked_in === true && !body.checked_in_at) {
      updateData.checked_in_at = new Date().toISOString()
    }

    // Auto-set confirmed_at when confirming
    if (body.status === "confirmed" && currentReg.status !== "confirmed") {
      updateData.confirmed_at = new Date().toISOString()
    }

    const { data, error } = await (supabase as any)
      .from("registrations")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to process registration request" }, { status: 500 })
    }

    // If status changed to "confirmed", update ticket quantity_sold
    if (body.status === "confirmed" && currentReg.status !== "confirmed" && currentReg.ticket_type_id) {
      // Get current ticket to update sold count
      const { data: ticket } = await (supabase as any)
        .from("ticket_types")
        .select("quantity_sold, quantity_total")
        .eq("id", currentReg.ticket_type_id)
        .maybeSingle()

      if (ticket) {
        await (supabase as any)
          .from("ticket_types")
          .update({ quantity_sold: (ticket.quantity_sold || 0) + (currentReg.quantity || 1) })
          .eq("id", currentReg.ticket_type_id)
      }
    }

    // If status changed FROM "confirmed" to cancelled/refunded, decrement ticket count
    if (currentReg.status === "confirmed" &&
        (body.status === "cancelled" || body.status === "refunded") &&
        currentReg.ticket_type_id) {
      const { data: ticket } = await (supabase as any)
        .from("ticket_types")
        .select("quantity_sold")
        .eq("id", currentReg.ticket_type_id)
        .maybeSingle()

      if (ticket) {
        await (supabase as any)
          .from("ticket_types")
          .update({ quantity_sold: Math.max(0, (ticket.quantity_sold || 0) - (currentReg.quantity || 1)) })
          .eq("id", currentReg.ticket_type_id)
      }
    }

    // If attendee_name changed, sync to related tables
    if (
      body.attendee_name &&
      currentReg.attendee_name &&
      body.attendee_name !== currentReg.attendee_name
    ) {
      try {
        const adminClient = await createAdminClient()
        const oldName = currentReg.attendee_name
        const newName = body.attendee_name
        const email = data.attendee_email || currentReg.attendee_email

        // 1. Update sessions: replace old name in speakers, chairpersons, moderators
        if (currentReg.event_id) {
          const { data: sessions } = await (adminClient as any)
            .from("sessions")
            .select("id, speakers, chairpersons, moderators")
            .eq("event_id", currentReg.event_id)

          if (sessions && sessions.length > 0) {
            const nameRegex = new RegExp(oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')

            for (const session of sessions) {
              const updates: any = {}
              let hasChange = false

              if (session.speakers && nameRegex.test(session.speakers)) {
                updates.speakers = session.speakers.replace(nameRegex, newName)
                hasChange = true
              }
              nameRegex.lastIndex = 0

              if (session.chairpersons && nameRegex.test(session.chairpersons)) {
                updates.chairpersons = session.chairpersons.replace(nameRegex, newName)
                hasChange = true
              }
              nameRegex.lastIndex = 0

              if (session.moderators && nameRegex.test(session.moderators)) {
                updates.moderators = session.moderators.replace(nameRegex, newName)
                hasChange = true
              }
              nameRegex.lastIndex = 0

              if (hasChange) {
                await (adminClient as any)
                  .from("sessions")
                  .update(updates)
                  .eq("id", session.id)
              }
            }
          }
        }

        // 2. Update faculty name where email matches
        if (email) {
          await (adminClient as any)
            .from("faculty")
            .update({ name: newName })
            .ilike("email", email)

          // 3. Update faculty_assignments where faculty_email matches
          await (adminClient as any)
            .from("faculty_assignments")
            .update({ faculty_name: newName })
            .ilike("faculty_email", email)
        }
      } catch (syncError) {
        // Log but don't fail the main update
        console.error("Failed to sync name change to related tables:", syncError)
      }
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to process registration request" }, { status: 500 })
  }
}

// DELETE - Delete registration (requires event access)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get event ID from registration
    const eventId = await getEventIdFromRegistration(id)
    if (!eventId) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }

    // Check authorization
    const { error: authError } = await requireEventAndPermission(eventId, 'registrations')
    if (authError) return authError

    const supabase = await createServerSupabaseClient()

    const { error } = await (supabase as any)
      .from("registrations")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: "Failed to process registration request" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to process registration request" }, { status: 500 })
  }
}
