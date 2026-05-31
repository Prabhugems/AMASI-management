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

  // The token can be either a registration_number (e.g. REG-20260430-YZW9ZGK)
  // or a 64-char secure checkin_token. Their lengths overlap, so a length
  // heuristic mis-routes lookups. Match either column.
  const safeToken = token.replace(/[,()]/g, "")

  // Look up registration
  const { data: registration, error } = await (supabase as any)
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
    .or(`registration_number.ilike.${safeToken},checkin_token.eq.${safeToken}`)
    .maybeSingle()

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
      .maybeSingle()
    template = data
  } else {
    // Get default template for event
    const { data } = await (supabase as any)
      .from("badge_templates")
      .select("id, name")
      .eq("event_id", registration.event_id)
      .eq("is_default", true)
      .maybeSingle()
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
