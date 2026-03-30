import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { requireEventAccess } from "@/lib/auth/api-auth"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// GET /api/event-settings?event_id=xxx - Get event settings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return NextResponse.json(
        { error: "event_id is required" },
        { status: 400 }
      )
    }

    const { error: authError } = await requireEventAccess(eventId)
    if (authError) return authError

    const supabase: SupabaseClient = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from("event_settings")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle()

    if (error) {
      console.error("Error fetching event settings:", error)
      return NextResponse.json(
        { error: "Failed to fetch settings" },
        { status: 500 }
      )
    }

    // Return default settings if not found
    if (!data) {
      return NextResponse.json({
        event_id: eventId,
        allow_attendee_login: false,
        allow_multiple_ticket_types: false,
        allow_multiple_addons: true,
        customize_registration_id: false,
        registration_prefix: null,
        registration_start_number: 1,
        registration_suffix: null,
        current_registration_number: 0,
        allow_buyers: false,
        buyer_form_id: null,
        require_approval: false,
        allow_cancellation: true,
        cancellation_deadline_hours: 24,
        send_confirmation_email: true,
        send_reminder_email: true,
        confirmation_email_subject: "Registration Confirmed",
        confirmation_email_body: "Thank you for registering for our event!",
        // Automation settings
        auto_send_receipt: true,
        auto_generate_badge: false,
        auto_email_badge: false,
        auto_generate_certificate: false,
        auto_email_certificate: false,
        // Registration control
        allow_duplicate_email: true, // Allow same email to register multiple times
        show_duplicate_warning: true, // Show warning when email already registered
        // Module toggles (opt-in, default off)
        enable_abstracts: false,
        enable_examination: false,
        // Module toggles (opt-out, default on)
        enable_speakers: true,
        enable_program: true,
        enable_checkin: true,
        enable_badges: true,
        enable_certificates: true,
        enable_travel: true,
        enable_accommodation: true,
        enable_meals: true,
        enable_sponsors: true,
        enable_budget: true,
        enable_visa: true,
        enable_surveys: true,
        enable_delegate_portal: true,
        enable_print_station: true,
        enable_leads: true,
        enable_waitlist: true,
        enable_addons: true,
        enable_forms: true,
      })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in GET /api/event-settings:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/event-settings - Create or update event settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.event_id) {
      return NextResponse.json(
        { error: "event_id is required" },
        { status: 400 }
      )
    }

    const { error: eventAuthError } = await requireEventAccess(body.event_id)
    if (eventAuthError) return eventAuthError

    // Use admin client to bypass RLS for saves
    const adminClient: SupabaseClient = await createAdminClient()

    const payload: Record<string, any> = {
      event_id: body.event_id,
    }

    // Only include fields that are provided
    if (body.allow_attendee_login !== undefined) payload.allow_attendee_login = body.allow_attendee_login
    if (body.allow_multiple_ticket_types !== undefined) payload.allow_multiple_ticket_types = body.allow_multiple_ticket_types
    if (body.allow_multiple_addons !== undefined) payload.allow_multiple_addons = body.allow_multiple_addons
    if (body.customize_registration_id !== undefined) payload.customize_registration_id = body.customize_registration_id
    if (body.registration_prefix !== undefined) payload.registration_prefix = body.registration_prefix || null
    if (body.registration_start_number !== undefined) payload.registration_start_number = body.registration_start_number || 1
    if (body.registration_suffix !== undefined) payload.registration_suffix = body.registration_suffix || null
    if (body.allow_buyers !== undefined) payload.allow_buyers = body.allow_buyers
    if (body.buyer_form_id !== undefined) payload.buyer_form_id = body.buyer_form_id || null
    if (body.require_approval !== undefined) payload.require_approval = body.require_approval
    if (body.allow_cancellation !== undefined) payload.allow_cancellation = body.allow_cancellation
    if (body.cancellation_deadline_hours !== undefined) payload.cancellation_deadline_hours = body.cancellation_deadline_hours
    if (body.send_confirmation_email !== undefined) payload.send_confirmation_email = body.send_confirmation_email
    if (body.send_reminder_email !== undefined) payload.send_reminder_email = body.send_reminder_email
    if (body.confirmation_email_subject !== undefined) payload.confirmation_email_subject = body.confirmation_email_subject
    if (body.confirmation_email_body !== undefined) payload.confirmation_email_body = body.confirmation_email_body
    // Automation settings
    if (body.auto_send_receipt !== undefined) payload.auto_send_receipt = body.auto_send_receipt
    if (body.auto_generate_badge !== undefined) payload.auto_generate_badge = body.auto_generate_badge
    if (body.auto_email_badge !== undefined) payload.auto_email_badge = body.auto_email_badge
    if (body.auto_generate_certificate !== undefined) payload.auto_generate_certificate = body.auto_generate_certificate
    if (body.auto_email_certificate !== undefined) payload.auto_email_certificate = body.auto_email_certificate
    // Registration control
    if (body.allow_duplicate_email !== undefined) payload.allow_duplicate_email = body.allow_duplicate_email
    if (body.show_duplicate_warning !== undefined) payload.show_duplicate_warning = body.show_duplicate_warning
    // Module toggles
    const moduleKeys = [
      "enable_abstracts", "enable_examination", "enable_speakers", "enable_program",
      "enable_checkin", "enable_badges", "enable_certificates", "enable_travel",
      "enable_accommodation", "enable_meals", "enable_sponsors", "enable_budget",
      "enable_visa", "enable_surveys", "enable_delegate_portal", "enable_print_station",
      "enable_leads", "enable_waitlist", "enable_addons", "enable_forms",
    ]
    for (const key of moduleKeys) {
      if (body[key] !== undefined) payload[key] = body[key]
    }

    const { data, error } = await adminClient
      .from("event_settings")
      .upsert(payload, { onConflict: "event_id" })
      .select()
      .single()

    if (error) {
      console.error("Error saving event settings:", error.message, error.details, error.hint)
      return NextResponse.json(
        { error: "Failed to save settings" },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in POST /api/event-settings:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
