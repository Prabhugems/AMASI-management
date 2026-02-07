import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

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

    const supabase: SupabaseClient = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from("event_settings")
      .select("*")
      .eq("event_id", eventId)
      .single()

    if (error && error.code !== "PGRST116") {
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
        send_confirmation_email: true,
        // Automation settings
        auto_send_receipt: true,
        auto_generate_badge: false,
        auto_email_badge: false,
        auto_generate_certificate: false,
        auto_email_certificate: false,
        // Registration control
        allow_duplicate_email: true, // Allow same email to register multiple times
        show_duplicate_warning: true, // Show warning when email already registered
        // Module toggles
        enable_abstracts: false,
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
    const supabase: SupabaseClient = await createServerSupabaseClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()

    if (!body.event_id) {
      return NextResponse.json(
        { error: "event_id is required" },
        { status: 400 }
      )
    }

    // Use admin client to bypass RLS for permission checks and saves
    const adminClient: SupabaseClient = await createAdminClient()

    // Verify user has access to this event (is creator or team member)
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, created_by")
      .eq("id", body.event_id)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      )
    }

    // Check if user is the event creator
    const isCreator = event.created_by === user.id

    // Check if user is a team member for this event (use admin client to bypass RLS)
    let isTeamMember = false
    const { data: teamMembership } = await adminClient
      .from("team_members")
      .select("id, role")
      .eq("event_id", body.event_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    isTeamMember = !!teamMembership

    // Allow access if: user is creator, OR user is team member, OR event has no creator set (legacy events)
    const hasAccess = isCreator || isTeamMember || event.created_by === null

    if (!hasAccess) {
      return NextResponse.json(
        { error: "You don't have permission to modify this event's settings" },
        { status: 403 }
      )
    }

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
    if (body.send_confirmation_email !== undefined) payload.send_confirmation_email = body.send_confirmation_email
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
    if (body.enable_abstracts !== undefined) payload.enable_abstracts = body.enable_abstracts

    const { data, error } = await adminClient
      .from("event_settings")
      .upsert(payload, { onConflict: "event_id" })
      .select()
      .single()

    if (error) {
      console.error("Error saving event settings:", error.message, error.details, error.hint)
      return NextResponse.json(
        { error: "Failed to save settings", details: error.message },
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
