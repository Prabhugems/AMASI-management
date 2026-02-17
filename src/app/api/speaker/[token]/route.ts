import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { webhookSpeakerResponded, webhookTravelSubmitted } from "@/lib/webhooks"
import { syncSpeakerStatus } from "@/lib/services/sync-speaker-status"
import { DEFAULTS } from "@/lib/config"

// Generate registration number (same pattern as create-speaker-registrations / respond API)
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

// Helper: resolve token to either a portal_token registration or an invitation_token assignment
async function resolveToken(db: any, token: string): Promise<{
  tokenType: "portal" | "invitation"
  registration: any | null
  assignment: any | null
  allAssignments: any[]
  event: any | null
  faculty: { name: string; email: string | null; phone: string | null } | null
}> {
  // Strategy 1: Try portal_token lookup on registrations
  const { data: registration, error } = await db
    .from("registrations")
    .select(`
      id,
      registration_number,
      attendee_name,
      attendee_email,
      attendee_phone,
      attendee_institution,
      attendee_designation,
      status,
      custom_fields,
      event_id,
      event:events(id, name, short_name, start_date, end_date, venue_name, city),
      ticket_type:ticket_types(name)
    `)
    .filter("custom_fields->>portal_token", "eq", token)
    .maybeSingle()

  if (!error && registration) {
    return {
      tokenType: "portal",
      registration,
      assignment: null,
      allAssignments: [],
      event: registration.event,
      faculty: null,
    }
  }

  // Strategy 2: Try invitation_token lookup on faculty_assignments
  const { data: assignment, error: assignmentError } = await db
    .from("faculty_assignments")
    .select("*")
    .eq("invitation_token", token)
    .maybeSingle()

  if (assignmentError || !assignment) {
    return { tokenType: "portal", registration: null, assignment: null, allAssignments: [], event: null, faculty: null }
  }

  // Fetch ALL assignments for this faculty member in this event
  let allAssignments: any[] = []
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
    .select("id, name, short_name, logo_url, start_date, end_date, venue_name, city")
    .eq("id", assignment.event_id)
    .maybeSingle()

  // Look up linked registration
  let linkedReg = null

  // Strategy A: Check via registration_id on any assignment
  const linkedAssignment = allAssignments.find((a: any) => a.registration_id)
  if (linkedAssignment) {
    const { data } = await db
      .from("registrations")
      .select(`
        id, registration_number, attendee_name, attendee_email, attendee_phone,
        attendee_institution, attendee_designation, status, custom_fields, event_id,
        event:events(id, name, short_name, start_date, end_date, venue_name, city),
        ticket_type:ticket_types(name)
      `)
      .eq("id", linkedAssignment.registration_id)
      .maybeSingle()
    linkedReg = data
  }

  // Strategy B: Match by email
  if (!linkedReg && assignment.faculty_email) {
    const { data } = await db
      .from("registrations")
      .select(`
        id, registration_number, attendee_name, attendee_email, attendee_phone,
        attendee_institution, attendee_designation, status, custom_fields, event_id,
        event:events(id, name, short_name, start_date, end_date, venue_name, city),
        ticket_type:ticket_types(name)
      `)
      .eq("event_id", assignment.event_id)
      .eq("attendee_email", assignment.faculty_email)
      .maybeSingle()
    linkedReg = data
  }

  return {
    tokenType: "invitation",
    registration: linkedReg,
    assignment,
    allAssignments,
    event,
    faculty: {
      name: assignment.faculty_name,
      email: assignment.faculty_email,
      phone: assignment.faculty_phone,
    },
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    const db = supabase as any

    const resolved = await resolveToken(db, token)

    // --- Portal token flow (existing speaker registration) ---
    if (resolved.tokenType === "portal") {
      const registration = resolved.registration
      if (!registration) {
        return NextResponse.json(
          { error: "Invalid or expired invitation link" },
          { status: 404 }
        )
      }

      // Fire-and-forget: track portal view count and last accessed timestamp
      const existingFields = registration.custom_fields || {}
      const currentViewCount = typeof existingFields.portal_view_count === "number" ? existingFields.portal_view_count : 0
      db
        .from("registrations")
        .update({
          custom_fields: {
            ...existingFields,
            portal_last_accessed: new Date().toISOString(),
            portal_view_count: currentViewCount + 1,
          },
        })
        .eq("id", registration.id)
        .then(() => {})
        .catch((err: any) => console.error("Failed to update portal view tracking:", err))

      // Find sessions via faculty_assignments table (most reliable)
      const speakerEmail = registration.attendee_email?.toLowerCase()
      const speakerName = registration.attendee_name?.trim()

      const stripTitle = (name: string) =>
        name.replace(/^(dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?|shri\.?)\s+/i, "").trim()
      const speakerNameStripped = speakerName ? stripTitle(speakerName).toLowerCase() : ""

      const { data: assignments } = await db
        .from("faculty_assignments")
        .select("session_id")
        .eq("event_id", registration.event_id)
        .ilike("faculty_email", speakerEmail || "")

      const assignedSessionIds = new Set(
        (assignments || []).map((a: any) => a.session_id).filter(Boolean)
      )

      // Get all sessions for this event
      const { data: sessions } = await db
        .from("sessions")
        .select("id, session_name, session_date, start_time, end_time, hall, description, specialty_track, speakers, chairpersons, moderators, speakers_text, chairpersons_text, moderators_text")
        .eq("event_id", registration.event_id)
        .order("session_date")
        .order("start_time")

      // Filter sessions that belong to this speaker
      const speakerSessions = (sessions || []).filter((session: any) => {
        if (assignedSessionIds.has(session.id)) return true

        const textFields = [session.speakers_text, session.chairpersons_text, session.moderators_text]
        for (const text of textFields) {
          if (text && speakerEmail && text.toLowerCase().includes(speakerEmail)) return true
        }

        if (session.description && speakerEmail) {
          if (session.description.toLowerCase().includes(speakerEmail)) return true
        }

        if (speakerNameStripped) {
          const nameFields = [session.description, session.speakers, session.chairpersons, session.moderators]
          for (const field of nameFields) {
            if (field) {
              const fieldLower = field.toLowerCase()
              if (fieldLower.includes(speakerNameStripped)) return true
              if (speakerName && fieldLower.includes(speakerName.toLowerCase())) return true
            }
          }
        }

        return false
      })

      const cleanSessions = speakerSessions.map(({ speakers, chairpersons, moderators, speakers_text, chairpersons_text, moderators_text, ...rest }: any) => rest)

      return NextResponse.json({
        tokenType: "portal",
        registration,
        sessions: cleanSessions,
      })
    }

    // --- Invitation token flow (faculty assignment) ---
    if (!resolved.assignment) {
      return NextResponse.json(
        { error: "Invalid or expired invitation link" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      tokenType: "invitation",
      faculty: resolved.faculty,
      assignments: resolved.allAssignments,
      event: resolved.event,
      registration: resolved.registration,
    })
  } catch (error: any) {
    console.error("Speaker portal API error:", error)
    return NextResponse.json({ error: "Failed to fetch speaker data" }, { status: 500 })
  }
}

// POST handler: per-session accept/decline/change-request (invitation token flow)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { responses, globalResponse, notes } = body

    const supabase = await createAdminClient()
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
    let allAssignments: any[] = []
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
        // Create a new registration
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
    console.error("Speaker portal POST error:", error)
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

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    const db = supabase as any

    // Try portal_token lookup first
    const { data: portalReg } = await db
      .from("registrations")
      .select("id, custom_fields, event_id, attendee_email")
      .filter("custom_fields->>portal_token", "eq", token)
      .maybeSingle()

    if (portalReg) {
      // --- Portal token flow (existing speaker registration) ---
      const { action, data } = body
      let updateData: any = {}

      if (action === "accept") {
        updateData = {
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          custom_fields: {
            ...portalReg.custom_fields,
            invitation_status: "confirmed",
            response_date: new Date().toISOString(),
          },
        }
      } else if (action === "decline") {
        updateData = {
          status: "declined",
          custom_fields: {
            ...portalReg.custom_fields,
            invitation_status: "declined",
            response_date: new Date().toISOString(),
            decline_reason: data?.reason || "",
          },
        }
      } else if (action === "update") {
        updateData = {
          custom_fields: {
            ...portalReg.custom_fields,
            ...data,
          },
        }
      }

      const { error: updateError } = await db
        .from("registrations")
        .update(updateData)
        .eq("id", portalReg.id)

      if (updateError) {
        throw updateError
      }

      // Sync status to faculty_assignments when speaker accepts/declines
      if ((action === "accept" || action === "decline") && portalReg.attendee_email) {
        try {
          const syncStatus = action === "accept" ? "confirmed" : "declined"
          await syncSpeakerStatus(db, portalReg.event_id, portalReg.attendee_email, syncStatus)
        } catch (syncError) {
          console.error("Sync speaker status error:", syncError)
        }
      }

      // Trigger webhooks
      try {
        const { data: fullReg } = await db
          .from("registrations")
          .select("*, event:events(id, name)")
          .eq("id", portalReg.id)
          .single()

        if (fullReg) {
          if (action === "accept" || action === "decline") {
            await webhookSpeakerResponded({
              registration_id: fullReg.id,
              event_id: fullReg.event_id,
              event_name: fullReg.event?.name || "",
              speaker_name: fullReg.attendee_name,
              speaker_email: fullReg.attendee_email,
              response: action === "accept" ? "accepted" : "declined",
            })
          }

          if (action === "update" && data?.travel_details) {
            await webhookTravelSubmitted({
              registration_id: fullReg.id,
              event_id: fullReg.event_id,
              event_name: fullReg.event?.name || "",
              speaker_name: fullReg.attendee_name,
              speaker_email: fullReg.attendee_email,
              from_city: data.travel_details.from_city,
              arrival_date: data.travel_details.arrival_date,
              departure_date: data.travel_details.departure_date,
              hotel_required: data.travel_details.hotel_required,
              pickup_required: data.travel_details.pickup_required,
              drop_required: data.travel_details.drop_required,
            })
          }
        }
      } catch (webhookError) {
        console.error("Webhook error:", webhookError)
      }

      return NextResponse.json({ success: true })
    }

    // --- Invitation token flow ---
    const { needs_travel, travel_details, travel_id, flight_preference_images, action, data } = body

    const { data: assignment, error: assignmentError } = await db
      .from("faculty_assignments")
      .select("*, registration_id")
      .eq("invitation_token", token)
      .maybeSingle()

    if (assignmentError || !assignment) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 })
    }

    // Find linked registration
    let registration = null
    if (assignment.registration_id) {
      const { data: reg } = await db
        .from("registrations")
        .select("id, custom_fields, event_id")
        .eq("id", assignment.registration_id)
        .maybeSingle()
      registration = reg
    }

    if (!registration && assignment.faculty_email) {
      const { data: reg } = await db
        .from("registrations")
        .select("id, custom_fields, event_id")
        .eq("event_id", assignment.event_id)
        .eq("attendee_email", assignment.faculty_email)
        .maybeSingle()
      registration = reg
    }

    if (!registration) {
      return NextResponse.json(
        { error: "No registration found. Please confirm your sessions first." },
        { status: 400 }
      )
    }

    // Support both API formats:
    // Format A (speaker-style): { action: "update", data: { needs_travel, travel_details, ... } }
    // Format B (respond-style): { needs_travel, travel_details, ... }
    const travelData = action === "update" ? data : { needs_travel, travel_details, travel_id, flight_preference_images }

    const existingFields = registration.custom_fields || {}
    const updatePayload: Record<string, unknown> = {
      custom_fields: {
        ...existingFields,
        ...(travelData.needs_travel !== undefined ? { needs_travel: travelData.needs_travel } : {}),
        ...(travelData.travel_details !== undefined ? { travel_details: travelData.travel_details } : {}),
        ...(travelData.travel_id !== undefined ? { travel_id: travelData.travel_id } : {}),
        ...(travelData.flight_preference_images !== undefined ? { flight_preference_images: travelData.flight_preference_images } : {}),
      },
    }

    const { error: updateError } = await db
      .from("registrations")
      .update(updatePayload)
      .eq("id", registration.id)

    if (updateError) {
      throw updateError
    }

    // Fire webhook if travel details provided
    const td = travelData.travel_details
    if (td) {
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
            from_city: td.onward_from_city || td.from_city,
            arrival_date: td.onward_date || td.arrival_date,
            departure_date: td.return_date || td.departure_date,
            hotel_required: td.hotel_required,
            pickup_required: td.pickup_required,
            drop_required: td.drop_required,
          })
        }
      } catch (webhookError) {
        console.error("Webhook error:", webhookError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Speaker portal update error:", error)
    return NextResponse.json({ error: "Failed to update speaker data" }, { status: 500 })
  }
}
