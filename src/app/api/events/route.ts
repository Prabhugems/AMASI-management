import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase/server"
import { eventCreateSchema, formatZodError } from "@/lib/schemas"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

/**
 * POST /api/events - Create a new event
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "authenticated")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  try {
    // Authenticate user
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in" },
        { status: 401 }
      )
    }

    // Parse and validate body
    const body = await request.json()
    const result = eventCreateSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(formatZodError(result.error), { status: 400 })
    }

    const { name, short_name, description, start_date, end_date, venue, city, country, timezone } = result.data

    // Generate slug from short_name
    const baseSlug = short_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    const timestamp = Date.now().toString(36)
    const slug = `${baseSlug}-${timestamp}`

    // Use admin client to bypass RLS
    const adminClient = await createAdminClient()

    const { data: event, error: createError } = await (adminClient as any)
      .from("events")
      .insert({
        name,
        short_name,
        slug,
        description: description || null,
        event_type: "conference",
        status: "draft",
        start_date,
        end_date,
        venue_name: venue || null,
        city: city || null,
        country: country || "India",
        timezone: timezone || "Asia/Kolkata",
        created_by: user.id,
        is_virtual: false,
        is_hybrid: false,
        total_faculty: 0,
        confirmed_faculty: 0,
        pending_faculty: 0,
        total_sessions: 0,
        total_delegates: 0,
      })
      .select()
      .single()

    if (createError || !event) {
      console.error("Failed to create event:", createError)
      return NextResponse.json(
        { error: "Failed to create event" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      event,
      message: "Event created successfully!",
    })
  } catch (error: any) {
    console.error("Event creation error:", error)
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    )
  }
}
