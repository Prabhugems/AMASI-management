import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// GET /api/badge/[token] - Get badge info for a registration
// Accepts checkin_token or registration_number
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token || token.length < 3) {
    return NextResponse.json(
      { error: "Invalid token" },
      { status: 400 }
    )
  }

  const supabase = await createAdminClient()

  // Determine if this is a checkin_token (long) or registration_number (short)
  const isSecureToken = token.length >= 20

  // Look up registration
  let query = (supabase as any)
    .from("registrations")
    .select(`
      id,
      registration_number,
      attendee_name,
      attendee_email,
      attendee_designation,
      attendee_institution,
      badge_url,
      badge_generated_at,
      badge_template_id,
      status,
      ticket_type_id,
      event_id,
      ticket_types (
        id,
        name
      ),
      events (
        id,
        name,
        short_name,
        start_date,
        end_date
      )
    `)

  if (isSecureToken) {
    query = query.eq("checkin_token", token)
  } else {
    query = query.ilike("registration_number", token)
  }

  const { data: registration, error } = await query.single()

  if (error || !registration) {
    return NextResponse.json(
      { error: "Registration not found" },
      { status: 404 }
    )
  }

  // Check if registration is confirmed
  if (registration.status !== "confirmed") {
    return NextResponse.json(
      { error: `Registration is ${registration.status}. Badge not available.` },
      { status: 400 }
    )
  }

  // Get default badge template for the event if badge_template_id not set
  let template = null
  if (registration.badge_template_id) {
    const { data } = await (supabase as any)
      .from("badge_templates")
      .select("id, name")
      .eq("id", registration.badge_template_id)
      .single()
    template = data
  } else {
    // Get default template for event
    const { data } = await (supabase as any)
      .from("badge_templates")
      .select("id, name")
      .eq("event_id", registration.event_id)
      .eq("is_default", true)
      .single()
    template = data
  }

  return NextResponse.json({
    registration: {
      id: registration.id,
      registration_number: registration.registration_number,
      attendee_name: registration.attendee_name,
      attendee_email: registration.attendee_email,
      attendee_designation: registration.attendee_designation,
      attendee_institution: registration.attendee_institution,
      badge_url: registration.badge_url,
      badge_generated_at: registration.badge_generated_at,
      ticket_type: registration.ticket_types,
      event: registration.events,
    },
    template,
  })
}
