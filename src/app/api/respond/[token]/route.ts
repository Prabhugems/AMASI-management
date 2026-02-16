import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { DEFAULTS } from "@/lib/config"
import { webhookTravelSubmitted } from "@/lib/webhooks"
import { syncSpeakerStatus } from "@/lib/services/sync-speaker-status"

// Generate registration number (same pattern as create-speaker-registrations)
async function generateRegistrationNumber(supabase: any, eventId: string): Promise<string> {
  const { data: settings } = await supabase
    .from("event_settings")
    .select("customize_registration_id, registration_prefix, registration_start_number, registration_suffix, current_registration_number")
    .eq("event_id", eventId)
    .maybeSingle()

  if (settings?.customize_registration_id) {
    const prefix = settings.registration_prefix || ""
    const suffix = settings.registration_suffix || ""
    const startNumber = settings.registration_start_number || 1
    const currentNumber = (settings.current_registration_number || 0) + 1
    const regNumber = Math.max(startNumber, currentNumber)

    await supabase
      .from("event_settings")
      .update({ current_registration_number: regNumber })
      .eq("event_id", eventId)

    return `${prefix}${regNumber}${suffix}`
  }

  const date = new Date()
  const dateStr = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, "0") +
    date.getDate().toString().padStart(2, "0")
  const random = Math.floor(1000 + Math.random() * 9000)
  return `SPK-${dateStr}-${random}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Fetch assignment by token to get faculty info
    const { data: assignment, error: assignmentError } = await db
      .from("faculty_assignments")
      .select("*")
      .eq("invitation_token", token)
      .maybeSingle()

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: "Invalid or expired invitation link" },
        { status: 404 }
      )
    }

    // Fetch ALL assignments for this faculty member in this event
    let allAssignments = []
    if (assignment.faculty_email) {
      const { data } = await db
        .from("faculty_assignments")
        .select("*")
        .eq("event_id", assignment.event_id)
        .eq("faculty_email", assignment.faculty_email)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true })
      allAssignments = data || []
    } else {
      const { data } = await db
        .from("faculty_assignments")
        .select("*")
        .eq("event_id", assignment.event_id)
        .eq("faculty_name", assignment.faculty_name)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true })
      allAssignments = data || []
    }

    // Fetch event details
    const { data: event } = await db
      .from("events")
      .select("id, name, short_name, logo_url, start_date, end_date, venue_name")
      .eq("id", assignment.event_id)
      .maybeSingle()

    // Look up linked registration
    let registration = null

    // Strategy 1: Check via registration_id on any assignment
    const linkedAssignment = allAssignments.find((a: any) => a.registration_id)
    if (linkedAssignment) {
      const { data } = await db
        .from("registrations")
        .select("id, registration_number, attendee_name, attendee_email, attendee_phone, status, custom_fields")
        .eq("id", linkedAssignment.registration_id)
        .maybeSingle()
      registration = data
    }

    // Strategy 2: Match by email
    if (!registration && assignment.faculty_email) {
      const { data } = await db
        .from("registrations")
        .select("id, registration_number, attendee_name, attendee_email, attendee_phone, status, custom_fields")
        .eq("event_id", assignment.event_id)
        .eq("attendee_email", assignment.faculty_email)
        .maybeSingle()
      registration = data
    }

    return NextResponse.json({
      faculty: {
        name: assignment.faculty_name,
        email: assignment.faculty_email,
        phone: assignment.faculty_phone,
      },
      assignments: allAssignments,
      event,
      registration,
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { responses, globalResponse, notes } = body

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Fetch assignment by token to get faculty info
    const { data: assignment, error: assignmentError } = await db
      .from("faculty_assignments")
      .select("*")
      .eq("invitation_token", token)
      .maybeSingle()

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: "Invalid or expired invitation link" },
        { status: 404 }
      )
    }

    // Get all assignments for this faculty
    let allAssignments = []
    if (assignment.faculty_email) {
      const { data } = await db
        .from("faculty_assignments")
        .select("id")
        .eq("event_id", assignment.event_id)
        .eq("faculty_email", assignment.faculty_email)
      allAssignments = data || []
    } else {
      const { data } = await db
        .from("faculty_assignments")
        .select("id")
        .eq("event_id", assignment.event_id)
        .eq("faculty_name", assignment.faculty_name)
      allAssignments = data || []
    }

    const now = new Date().toISOString()

    // If globalResponse is provided, update all assignments with same status
    if (globalResponse) {
      const updateData: Record<string, unknown> = {
        status: globalResponse,
        responded_at: now,
      }

      if (globalResponse === 'declined') {
        updateData.response_notes = notes
      } else if (globalResponse === 'change_requested') {
        updateData.change_request_details = notes
      } else if (notes) {
        updateData.response_notes = notes
      }

      for (const a of allAssignments) {
        await db
          .from("faculty_assignments")
          .update(updateData)
          .eq("id", a.id)
      }
    } else if (responses) {
      // Update each assignment individually with its own notes
      for (const [assignmentId, status] of Object.entries(responses)) {
        const updateData: Record<string, unknown> = {
          status: status,
          responded_at: now,
        }
        const assignmentNote = notes && typeof notes === 'object' ? notes[assignmentId] : null
        if (status === 'declined' && assignmentNote) {
          updateData.response_notes = assignmentNote
        } else if (status === 'change_requested' && assignmentNote) {
          updateData.change_request_details = assignmentNote
        }
        await db
          .from("faculty_assignments")
          .update(updateData)
          .eq("id", assignmentId)
      }
    }

    // Sync status to registrations
    if (assignment.faculty_email) {
      try {
        // Determine dominant status: any confirmed → confirmed, all declined → declined
        let dominantStatus: "confirmed" | "declined" | null = null
        if (globalResponse === "confirmed" || (responses && Object.values(responses).some(s => s === "confirmed"))) {
          dominantStatus = "confirmed"
        } else if (globalResponse === "declined" || (responses && Object.values(responses).every(s => s === "declined"))) {
          dominantStatus = "declined"
        }
        if (dominantStatus) {
          await syncSpeakerStatus(db, assignment.event_id, assignment.faculty_email, dominantStatus)
        }
      } catch (syncError) {
        console.error("Sync speaker status error:", syncError)
      }
    }

    // Check if any assignment is confirmed → auto-create registration
    const hasConfirmed = globalResponse === 'confirmed' ||
      (responses && Object.values(responses).some(s => s === 'confirmed'))

    let registrationId = null

    if (hasConfirmed && assignment.faculty_email) {
      // Check for existing registration (by registration_id link or email match)
      const linkedAssignment = allAssignments.find((a: any) => a.registration_id)
      let existingReg = null

      if (linkedAssignment?.registration_id) {
        const { data } = await db
          .from("registrations")
          .select("id")
          .eq("id", linkedAssignment.registration_id)
          .maybeSingle()
        existingReg = data
      }

      if (!existingReg) {
        const { data } = await db
          .from("registrations")
          .select("id")
          .eq("event_id", assignment.event_id)
          .eq("attendee_email", assignment.faculty_email)
          .maybeSingle()
        existingReg = data
      }

      if (existingReg) {
        registrationId = existingReg.id
      } else {
        // Create a new registration (same pattern as create-speaker-registrations)

        // Find or create Speaker ticket type
        let speakerTicket = null
        const { data: existingTicket } = await db
          .from("ticket_types")
          .select("id, name")
          .eq("event_id", assignment.event_id)
          .or("name.ilike.%speaker%,name.ilike.%faculty%")
          .limit(1)
          .maybeSingle()

        if (existingTicket) {
          speakerTicket = existingTicket
        } else {
          const { data: newTicket } = await db
            .from("ticket_types")
            .insert({
              event_id: assignment.event_id,
              name: "Speaker",
              description: "Complimentary ticket for speakers and faculty",
              price: 0,
              quantity_total: 1000,
              quantity_sold: 0,
              status: "active",
              sort_order: 0,
            })
            .select()
            .single()
          speakerTicket = newTicket
        }

        if (speakerTicket) {
          const registrationNumber = await generateRegistrationNumber(db, assignment.event_id)
          const portalToken = crypto.randomUUID()

          const { data: newReg } = await db
            .from("registrations")
            .insert({
              event_id: assignment.event_id,
              ticket_type_id: speakerTicket.id,
              registration_number: registrationNumber,
              attendee_name: assignment.faculty_name,
              attendee_email: assignment.faculty_email,
              attendee_phone: assignment.faculty_phone || null,
              attendee_designation: "Speaker",
              attendee_country: DEFAULTS.country,
              quantity: 1,
              unit_price: 0,
              tax_amount: 0,
              discount_amount: 0,
              total_amount: 0,
              status: "confirmed",
              payment_status: "completed",
              custom_fields: {
                portal_token: portalToken,
                invitation_sent: now,
                invitation_status: "confirmed",
                response_date: now,
                needs_travel: false,
              },
            })
            .select("id")
            .single()

          if (newReg) {
            registrationId = newReg.id
          }
        }
      }

      // Link registration_id to all faculty_assignments for this faculty in this event
      if (registrationId) {
        for (const a of allAssignments) {
          await db
            .from("faculty_assignments")
            .update({ registration_id: registrationId })
            .eq("id", a.id)
        }
      }
    }

    return NextResponse.json({ success: true, registration_id: registrationId })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { needs_travel, travel_details, travel_id, flight_preference_images } = body

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Validate token → find assignment
    const { data: assignment, error: assignmentError } = await db
      .from("faculty_assignments")
      .select("*, registration_id")
      .eq("invitation_token", token)
      .maybeSingle()

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: "Invalid or expired invitation link" },
        { status: 404 }
      )
    }

    // Find linked registration
    let registration = null
    if (assignment.registration_id) {
      const { data } = await db
        .from("registrations")
        .select("id, custom_fields, event_id")
        .eq("id", assignment.registration_id)
        .maybeSingle()
      registration = data
    }

    // Fallback: find by email
    if (!registration && assignment.faculty_email) {
      const { data } = await db
        .from("registrations")
        .select("id, custom_fields, event_id")
        .eq("event_id", assignment.event_id)
        .eq("attendee_email", assignment.faculty_email)
        .maybeSingle()
      registration = data
    }

    if (!registration) {
      return NextResponse.json(
        { error: "No registration found. Please confirm your sessions first." },
        { status: 400 }
      )
    }

    // Merge travel data into registrations.custom_fields
    const existingFields = registration.custom_fields || {}
    const updateData: Record<string, unknown> = {
      custom_fields: {
        ...existingFields,
        needs_travel: needs_travel ?? existingFields.needs_travel,
        ...(travel_details !== undefined ? { travel_details } : {}),
        ...(travel_id !== undefined ? { travel_id } : {}),
        ...(flight_preference_images !== undefined ? { flight_preference_images } : {}),
      },
    }

    const { error: updateError } = await db
      .from("registrations")
      .update(updateData)
      .eq("id", registration.id)

    if (updateError) {
      throw updateError
    }

    // Fire webhook if travel details provided
    if (travel_details) {
      try {
        const { data: fullReg } = await db
          .from("registrations")
          .select("*, event:events(id, name)")
          .eq("id", registration.id)
          .single()

        if (fullReg) {
          await webhookTravelSubmitted({
            registration_id: fullReg.id,
            event_id: fullReg.event_id,
            event_name: fullReg.event?.name || "",
            speaker_name: fullReg.attendee_name,
            speaker_email: fullReg.attendee_email,
            from_city: travel_details.onward_from_city || travel_details.from_city,
            arrival_date: travel_details.onward_date || travel_details.arrival_date,
            departure_date: travel_details.return_date || travel_details.departure_date,
            hotel_required: travel_details.hotel_required,
            pickup_required: travel_details.pickup_required,
            drop_required: travel_details.drop_required,
          })
        }
      } catch (webhookError) {
        console.error("Webhook error:", webhookError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
