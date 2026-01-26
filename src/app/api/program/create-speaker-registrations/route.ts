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
    const { data: sessions } = await (supabase as any)
      .from("sessions")
      .select("description")
      .eq("event_id", event_id)
      .not("description", "is", null)

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ error: "No sessions with faculty found" }, { status: 400 })
    }

    // Helper to strip title from name
    const stripTitle = (name: string) => {
      return name.replace(/^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Shri\.?)\s+/i, "").trim()
    }

    // Extract unique faculty from sessions (format: "Name | Email | Phone")
    const facultyMap = new Map<string, { name: string; email: string; phone: string }>()
    sessions.forEach((session: any) => {
      if (session.description) {
        const parts = session.description.split(" | ")
        const rawName = parts[0]?.trim()
        const name = stripTitle(rawName) // Remove Dr/Prof prefix
        const email = parts[1]?.trim()?.toLowerCase()
        const phone = parts[2]?.trim()

        if (email && email.includes("@")) {
          facultyMap.set(email, { name, email, phone })
        }
      }
    })

    if (facultyMap.size === 0) {
      return NextResponse.json({ error: "No faculty with email found in sessions" }, { status: 400 })
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

    for (const [email, faculty] of facultyMap.entries()) {
      // Check if already registered
      const { data: existing } = await (supabase as any)
        .from("registrations")
        .select("id")
        .eq("event_id", event_id)
        .eq("attendee_email", email)
        .maybeSingle()

      if (existing) {
        skipped++
        continue
      }

      const registrationNumber = await generateRegistrationNumber(supabase, event_id)

      // Generate portal token for speaker to accept/decline
      const portalToken = crypto.randomUUID()

      const { error: regError } = await (supabase as any)
        .from("registrations")
        .insert({
          event_id: event_id,
          ticket_type_id: speakerTicket.id,
          registration_number: registrationNumber,
          attendee_name: faculty.name,
          attendee_email: email,
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
