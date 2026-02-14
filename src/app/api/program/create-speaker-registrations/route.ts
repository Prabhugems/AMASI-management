import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { DEFAULTS } from "@/lib/config"

// Generate registration number
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

export async function POST(request: NextRequest) {
  try {
    const { event_id } = await request.json()

    if (!event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Get sessions with faculty info for this event
    // AI import stores faculty in speakers_text, chairpersons_text, moderators_text columns
    // Legacy format stores in description as "Name | Email | Phone"
    const { data: sessions } = await (supabase as any)
      .from("sessions")
      .select("description, speakers_text, chairpersons_text, moderators_text")
      .eq("event_id", event_id)

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ error: "No sessions found" }, { status: 400 })
    }

    // Helper to strip title from name
    const stripTitle = (name: string) => {
      return name.replace(/^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Shri\.?)\s+/i, "").trim()
    }

    // Parse contact text format: "Name (email, phone) | Name2 (email, phone)"
    const parseContactText = (text: string): Array<{ name: string; email: string; phone: string }> => {
      if (!text) return []
      return text.split(" | ").map(part => {
        const nameMatch = part.split("(")[0].trim()
        const name = stripTitle(nameMatch)
        const detailsMatch = part.match(/\(([^)]*)\)/)
        if (detailsMatch) {
          const details = detailsMatch[1].split(",").map(s => s.trim())
          const email = details.find(d => d.includes("@"))?.toLowerCase() || ""
          const phone = details.find(d => !d.includes("@") && /[\d+]/.test(d)) || ""
          return { name, email, phone }
        }
        return { name, email: "", phone: "" }
      }).filter(p => p.name)
    }

    // Extract unique faculty from sessions
    const facultyMap = new Map<string, { name: string; email: string; phone: string }>()

    sessions.forEach((session: any) => {
      // Parse from *_text columns (AI import format: "Name (email, phone) | Name2 (email, phone)")
      const textFields = [session.speakers_text, session.chairpersons_text, session.moderators_text]
      textFields.forEach((text: string | null) => {
        if (text) {
          const people = parseContactText(text)
          people.forEach(person => {
            if (person.email && person.email.includes("@")) {
              facultyMap.set(person.email, person)
            } else if (person.name) {
              // Use name as key if no email
              const key = `name:${person.name.toLowerCase()}`
              if (!facultyMap.has(key)) {
                facultyMap.set(key, person)
              }
            }
          })
        }
      })

      // Legacy fallback: parse from description (format: "Name | Email | Phone")
      if (session.description) {
        const parts = session.description.split(" | ")
        if (parts.length >= 2) {
          const rawName = parts[0]?.trim()
          const name = stripTitle(rawName)
          const email = parts[1]?.trim()?.toLowerCase()
          const phone = parts[2]?.trim() || ""

          if (email && email.includes("@") && !facultyMap.has(email)) {
            facultyMap.set(email, { name, email, phone })
          }
        }
      }
    })

    if (facultyMap.size === 0) {
      return NextResponse.json({ error: "No faculty found in sessions" }, { status: 400 })
    }

    // Find or create Speaker ticket
    let { data: speakerTicket } = await (supabase as any)
      .from("ticket_types")
      .select("id, name")
      .eq("event_id", event_id)
      .or("name.ilike.%speaker%,name.ilike.%faculty%")
      .limit(1)
      .maybeSingle()

    if (!speakerTicket) {
      const { data: newTicket, error: ticketError } = await (supabase as any)
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

      if (ticketError) {
        return NextResponse.json({ error: "Failed to create Speaker ticket" }, { status: 500 })
      }
      speakerTicket = newTicket
    }

    // Create registrations for each faculty
    let created = 0
    let skipped = 0

    for (const [key, faculty] of facultyMap.entries()) {
      const email = key.startsWith("name:") ? null : key

      // Check if already registered (by email or by name)
      let existing = null
      if (email) {
        const { data } = await (supabase as any)
          .from("registrations")
          .select("id")
          .eq("event_id", event_id)
          .eq("attendee_email", email)
          .maybeSingle()
        existing = data
      } else {
        const { data } = await (supabase as any)
          .from("registrations")
          .select("id")
          .eq("event_id", event_id)
          .ilike("attendee_name", faculty.name)
          .maybeSingle()
        existing = data
      }

      if (existing) {
        skipped++
        continue
      }

      const registrationNumber = await generateRegistrationNumber(supabase, event_id)

      // Generate portal token for speaker to accept/decline
      const portalToken = crypto.randomUUID()

      // Generate placeholder email if none available
      const attendeeEmail = email || `${faculty.name.toLowerCase().replace(/\s+/g, ".")}@placeholder.speaker`

      const { error: regError } = await (supabase as any)
        .from("registrations")
        .insert({
          event_id: event_id,
          ticket_type_id: speakerTicket.id,
          registration_number: registrationNumber,
          attendee_name: faculty.name,
          attendee_email: attendeeEmail,
          attendee_phone: faculty.phone || null,
          attendee_designation: "Speaker",
          attendee_country: DEFAULTS.country,
          quantity: 1,
          unit_price: 0,
          tax_amount: 0,
          discount_amount: 0,
          total_amount: 0,
          status: "pending", // Speaker needs to confirm via portal
          payment_status: "completed",
          custom_fields: {
            portal_token: portalToken,
            invitation_sent: new Date().toISOString(),
            needs_travel: false,
          },
        })

      if (!regError) {
        created++
      }
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total_faculty: facultyMap.size,
      ticket_name: speakerTicket.name,
    })
  } catch (error: any) {
    console.error("Error creating speaker registrations:", error)
    return NextResponse.json({ error: "Failed to create speaker registrations" }, { status: 500 })
  }
}
