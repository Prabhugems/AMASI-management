import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Use service role for travel agent updates (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { registration_id, event_id, booking } = body

    if (!registration_id || !event_id || !booking) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Verify the registration belongs to this event
    const { data: registration, error: fetchError } = await supabase
      .from("registrations")
      .select("id, custom_fields, event_id")
      .eq("id", registration_id)
      .eq("event_id", event_id)
      .single()

    if (fetchError || !registration) {
      return NextResponse.json(
        { error: "Registration not found or access denied" },
        { status: 404 }
      )
    }

    // Update the booking in custom_fields
    const { error: updateError } = await supabase
      .from("registrations")
      .update({
        custom_fields: {
          ...(registration.custom_fields || {}),
          booking: {
            ...(registration.custom_fields?.booking || {}),
            ...booking,
          },
        },
      })
      .eq("id", registration_id)

    if (updateError) {
      console.error("Update error:", updateError)
      return NextResponse.json(
        { error: "Failed to update booking" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Travel agent update error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
