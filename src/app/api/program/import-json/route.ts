import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { DEFAULTS } from "@/lib/config"

type EventSettings = {
  customize_registration_id: boolean
  registration_prefix: string | null
  registration_start_number: number | null
  registration_suffix: string | null
  current_registration_number: number | null
}

// Generate custom registration number based on event settings
async function generateRegistrationNumber(supabase: Awaited<ReturnType<typeof createAdminClient>>, eventId: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  // Try to get event settings - use maybeSingle since settings might not exist yet
  const { data: settingsData } = await db
    .from("event_settings")
    .select("customize_registration_id, registration_prefix, registration_start_number, registration_suffix, current_registration_number")
    .eq("event_id", eventId)
    .maybeSingle()

  const settings = settingsData as EventSettings | null

  if (settings?.customize_registration_id) {
    // Use custom format
    const prefix = settings.registration_prefix || ""
    const suffix = settings.registration_suffix || ""
    const startNumber = settings.registration_start_number || 1
    const currentNumber = (settings.current_registration_number || 0) + 1
    const regNumber = Math.max(startNumber, currentNumber)

    // Update the current registration number
    await db
      .from("event_settings")
      .update({ current_registration_number: regNumber })
      .eq("event_id", eventId)

    // Format: PREFIX + NUMBER + SUFFIX
    return `${prefix}${regNumber}${suffix}`
  }

  // Default format: REG-YYYYMMDD-XXXX (for registrations)
  const date = new Date()
  const dateStr = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, "0") +
    date.getDate().toString().padStart(2, "0")
  const random = Math.floor(1000 + Math.random() * 9000)
  return `REG-${dateStr}-${random}`
}

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const { user: _user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { event_id, sessions, createSpeakerRegistrations = false } = await request.json()

    if (!event_id || !sessions || !Array.isArray(sessions)) {
      return NextResponse.json(
        { error: "event_id and sessions array are required" },
        { status: 400 }
      )
    }

    if (sessions.length === 0) {
      return NextResponse.json(
        { error: "No sessions to import" },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Helper to normalize faculty name and extract title
    const normalizeFacultyName = (rawName: string) => {
      let name = rawName.trim()
      let title = ""

      // Extract common titles (Dr, Dr., Prof, Prof., etc.)
      const titleMatch = name.match(/^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Shri\.?)\s+/i)
      if (titleMatch) {
        title = titleMatch[1].replace(/\.$/, "") // Remove trailing dot
        name = name.slice(titleMatch[0].length).trim()
      }

      return { name, title }
    }

    // Extract unique faculty members from sessions
    const facultyMap = new Map<string, { name: string; title: string; email: string; phone: string; needsTravel: boolean; needsAccommodation: boolean }>()

    sessions.forEach((session: any) => {
      if (session.faculty_email && session.faculty_name) {
        const email = session.faculty_email.toLowerCase().trim()
        // Only add if we have a valid email
        if (email && email.includes("@")) {
          const { name, title } = normalizeFacultyName(session.faculty_name)
          // Parse needs_travel from session - accepts "yes", "true", "1", etc.
          const needsTravelRaw = session.needs_travel?.toString().toLowerCase().trim() || ""
          const needsTravel = ["yes", "true", "1", "y"].includes(needsTravelRaw)
          // Parse needs_accommodation from session
          const needsAccomRaw = session.needs_accommodation?.toString().toLowerCase().trim() || ""
          const needsAccommodation = ["yes", "true", "1", "y"].includes(needsAccomRaw)

          // Get existing entry to preserve travel flags (OR logic - if ANY session has Yes, keep it)
          const existing = facultyMap.get(email)

          facultyMap.set(email, {
            name: name,
            title: title,
            email: email,
            phone: session.faculty_phone?.trim() || existing?.phone || "",
            // Use OR logic: if existing has travel OR this session has travel, set true
            needsTravel: needsTravel || (existing?.needsTravel ?? false),
            needsAccommodation: needsAccommodation || (existing?.needsAccommodation ?? false),
          })
        }
      }
    })

    // Create/update faculty members
    let facultyCreated = 0
    let facultyUpdated = 0

    for (const [email, faculty] of facultyMap.entries()) {
      // Check if faculty exists - use maybeSingle to avoid error when not found
      const { data: existing } = await db
        .from("faculty")
        .select("id")
        .eq("email", email)
        .maybeSingle()

      if (existing) {
        // Update existing faculty with phone/title if missing
        const { error: updateError } = await db
          .from("faculty")
          .update({
            phone: faculty.phone || undefined,
            title: faculty.title || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)

        if (!updateError) facultyUpdated++
      } else {
        // Create new faculty (name without Dr prefix, title stored separately)
        const { error: insertError } = await db
          .from("faculty")
          .insert({
            name: faculty.name,
            title: faculty.title || null,
            email: faculty.email,
            phone: faculty.phone || null,
            country: DEFAULTS.country,
            status: "active",
            total_events: 0,
            total_sessions: 0,
          })

        if (!insertError) facultyCreated++
      }
    }

    // Create registrations for faculty if admin enabled this option
    let registrationsCreated = 0
    let registrationsSkipped = 0
    let facultyTicket = null

    if (createSpeakerRegistrations) {
      // Find Faculty/Speaker ticket type for this event - use maybeSingle since it might not exist
      const { data: ticketData } = await db
        .from("ticket_types")
        .select("id, name, price")
        .eq("event_id", event_id)
        .or("name.ilike.%faculty%,name.ilike.%speaker%")
        .limit(1)
        .maybeSingle()

      facultyTicket = ticketData

      // If no speaker/faculty ticket exists, create one automatically
      if (!facultyTicket) {
        const { data: newTicket, error: ticketError } = await db
          .from("ticket_types")
          .insert({
            event_id: event_id,
            name: "Speaker",
            description: "Complimentary ticket for speakers and faculty",
            price: 0,
            quantity_available: 1000,
            quantity_sold: 0,
            is_active: true,
            sort_order: 0,
          })
          .select()
          .single()

        if (!ticketError && newTicket) {
          facultyTicket = newTicket
        }
      }

      if (facultyTicket) {
        for (const [email, faculty] of facultyMap.entries()) {
          // Check if registration already exists for this email and event
          const { data: existingReg } = await db
            .from("registrations")
            .select("id, custom_fields")
            .eq("event_id", event_id)
            .eq("attendee_email", email)
            .maybeSingle()

          if (existingReg) {
            // UPDATE existing registration with travel data
            const existingCustomFields = existingReg.custom_fields || {}
            const portalToken = existingCustomFields.portal_token || crypto.randomUUID()

            const { error: updateError } = await db
              .from("registrations")
              .update({
                custom_fields: {
                  ...existingCustomFields,
                  portal_token: portalToken,
                  needs_travel: faculty.needsTravel || faculty.needsAccommodation,
                  travel_details: (faculty.needsTravel || faculty.needsAccommodation) ? {
                    ...(existingCustomFields.travel_details || {}),
                    mode: faculty.needsTravel ? "flight" : (existingCustomFields.travel_details?.mode || "self"),
                    hotel_required: faculty.needsAccommodation,
                  } : existingCustomFields.travel_details,
                },
              })
              .eq("id", existingReg.id)

            if (!updateError) {
              registrationsSkipped++ // Count as "updated existing"
            }
            continue
          }

          // Generate registration number
          const registrationNumber = await generateRegistrationNumber(supabase, event_id)

          // Generate portal token for speaker to accept/decline
          const portalToken = crypto.randomUUID()

          // Create registration for faculty as Speaker
          const fullName = faculty.title ? `${faculty.title} ${faculty.name}` : faculty.name
          const { error: regError } = await db
            .from("registrations")
            .insert({
              event_id: event_id,
              ticket_type_id: facultyTicket.id,
              registration_number: registrationNumber,
              attendee_name: fullName,
              attendee_email: email,
              attendee_phone: faculty.phone || null,
              attendee_designation: "Speaker", // Role for this event
              attendee_country: DEFAULTS.country,
              quantity: 1,
              unit_price: 0, // Speaker tickets are typically free
              tax_amount: 0,
              discount_amount: 0,
              total_amount: 0,
              status: "pending", // Speaker needs to confirm via portal
              payment_status: "completed",
              custom_fields: {
                portal_token: portalToken,
                invitation_sent: new Date().toISOString(),
                needs_travel: faculty.needsTravel || faculty.needsAccommodation, // True if either is needed
                travel_details: (faculty.needsTravel || faculty.needsAccommodation) ? {
                  mode: faculty.needsTravel ? "flight" : "self",
                  hotel_required: faculty.needsAccommodation,
                } : null,
              },
            })

          if (!regError) {
            registrationsCreated++
          }
        }
      }
    }

    // Group sessions by unique key (date + time + hall + topic) to avoid duplicates
    // This handles CSVs where each row is a speaker, not a unique session
    const sessionMap = new Map<string, any>()

    sessions.forEach((session: any) => {
      // Create unique key from date, start_time, hall, and session_name
      const key = `${session.session_date}|${session.start_time}|${session.hall || ''}|${session.session_name}`

      if (sessionMap.has(key)) {
        // Session exists - aggregate faculty info
        const existing = sessionMap.get(key)
        if (session.faculty_name) {
          const facultyInfo = session.faculty_role
            ? `${session.faculty_name} (${session.faculty_role})`
            : session.faculty_name
          existing.speakers = existing.speakers || []
          existing.speakers.push(facultyInfo)
        }
      } else {
        // New session
        const speakers = session.faculty_name
          ? [session.faculty_role ? `${session.faculty_name} (${session.faculty_role})` : session.faculty_name]
          : []

        sessionMap.set(key, {
          event_id: event_id,
          session_name: session.session_name,
          session_type: session.session_type || "lecture",
          session_date: session.session_date,
          start_time: session.start_time,
          end_time: session.end_time || session.start_time,
          duration_minutes: session.duration_minutes || null,
          hall: session.hall || null,
          specialty_track: session.specialty_track || null,
          speakers: speakers,
        })
      }
    })

    // Fetch existing sessions for this event to avoid duplicates
    const { data: existingSessions } = await db
      .from("sessions")
      .select("session_name, session_date, start_time, hall")
      .eq("event_id", event_id)

    // Create a set of existing session keys
    const existingKeys = new Set(
      (existingSessions || []).map((s: any) =>
        `${s.session_date}|${s.start_time}|${s.hall || ''}|${s.session_name}`
      )
    )

    // Prepare sessions for insert, filtering out existing ones
    const sessionsToInsert = Array.from(sessionMap.values())
      .filter(session => {
        const key = `${session.session_date}|${session.start_time}|${session.hall || ''}|${session.session_name}`
        return !existingKeys.has(key)
      })
      .map(session => ({
        event_id: session.event_id,
        session_name: session.session_name,
        session_type: session.session_type,
        session_date: session.session_date,
        start_time: session.start_time,
        end_time: session.end_time,
        duration_minutes: session.duration_minutes,
        hall: session.hall,
        specialty_track: session.specialty_track,
        description: session.speakers?.length > 0 ? session.speakers.join(', ') : null,
      }))

    const skippedDuplicates = sessionMap.size - sessionsToInsert.length

    // Insert sessions (only new ones)
    let data = null
    let error = null
    if (sessionsToInsert.length > 0) {
      const result = await db
        .from("sessions")
        .insert(sessionsToInsert as any)
        .select()
      data = result.data
      error = result.error
    }

    if (error) {
      console.error("Insert error:", error)
      return NextResponse.json(
        { error: "Failed to import sessions" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      imported: data?.length || 0,
      skippedDuplicates,
      faculty: {
        created: facultyCreated,
        updated: facultyUpdated,
      },
      registrations: {
        created: registrationsCreated,
        skipped: registrationsSkipped,
        ticketFound: !!facultyTicket,
        ticketName: facultyTicket?.name || null,
      },
    })
  } catch (error: any) {
    console.error("Import error:", error)
    return NextResponse.json(
      { error: "Import failed" },
      { status: 500 }
    )
  }
}
