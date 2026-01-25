import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Use service role for travel agent access (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      )
    }

    // Verify event exists
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name, short_name, start_date, end_date, venue_name, city")
      .eq("id", eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      )
    }

    // Fetch speakers needing travel
    const { data: registrations, error: regError } = await supabase
      .from("registrations")
      .select("*")
      .eq("event_id", eventId)
      .or("attendee_designation.ilike.%speaker%,attendee_designation.ilike.%faculty%,attendee_designation.ilike.%chairperson%,attendee_designation.ilike.%moderator%")
      .order("attendee_name")

    if (regError) {
      console.error("Fetch error:", regError)
      return NextResponse.json(
        { error: "Failed to fetch speakers" },
        { status: 500 }
      )
    }

    // Filter to only those needing travel
    const speakers = (registrations || []).filter(
      (s: any) => s.custom_fields?.needs_travel
    )

    return NextResponse.json({ event, speakers })
  } catch (error: any) {
    console.error("Travel agent speakers error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
