import { createServerSupabaseClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

// POST - Check if email already has registrations for an event
export async function POST(request: NextRequest) {
  // Rate limit: strict tier to prevent email enumeration
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "strict")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  try {
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const { email, event_id } = body

    if (!email || !event_id) {
      return NextResponse.json(
        { error: "email and event_id are required" },
        { status: 400 }
      )
    }

    // Check for existing registrations
    const { data: existingRegistrations, error } = await (supabase as any)
      .from("registrations")
      .select(`
        id,
        registration_number,
        attendee_name,
        status,
        ticket_type:ticket_types(name)
      `)
      .eq("event_id", event_id)
      .ilike("attendee_email", email.trim())
      .neq("status", "cancelled")

    if (error) {
      console.error("Error checking email:", error)
      return NextResponse.json(
        { error: "Failed to check email" },
        { status: 500 }
      )
    }

    // Get event settings for duplicate email policy
    const { data: settings } = await (supabase as any)
      .from("events")
      .select("settings")
      .eq("id", event_id)
      .single()

    const regSettings = (settings?.settings as Record<string, unknown>) || {}
    const allowDuplicate = regSettings.allow_duplicate_email !== false
    const showWarning = regSettings.show_duplicate_warning !== false

    // Return minimal data to prevent email enumeration attacks
    // Only show if registration exists + count, not full details
    const hasExisting = existingRegistrations && existingRegistrations.length > 0

    return NextResponse.json({
      has_existing: hasExisting,
      // Only return count, not full registration details (prevents data leakage)
      count: existingRegistrations?.length || 0,
      allow_duplicate: allowDuplicate,
      show_warning: showWarning,
      // Only include ticket names (not attendee names) for user context
      ticket_types: hasExisting
        ? [...new Set(existingRegistrations.map((r: any) => r.ticket_type?.name).filter(Boolean))]
        : [],
    })
  } catch (error: any) {
    console.error("Error in check-email:", error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
