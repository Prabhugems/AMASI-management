import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { token, registration_id, attendee_name } = await request.json()

    if (!token || !registration_id || !attendee_name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Verify token belongs to a valid print station
    const { data: station, error: stationError } = await supabase
      .from("print_stations")
      .select("id, event_id, is_active")
      .eq("access_token", token)
      .single()

    if (stationError || !station) {
      return NextResponse.json({ error: "Invalid station token" }, { status: 401 })
    }

    if (!station.is_active) {
      return NextResponse.json({ error: "Station is inactive" }, { status: 403 })
    }

    // Verify registration belongs to this event
    const { data: registration, error: regError } = await supabase
      .from("registrations")
      .select("id, event_id, attendee_name")
      .eq("id", registration_id)
      .eq("event_id", station.event_id)
      .single()

    if (regError || !registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }

    // Update the name
    const { error: updateError } = await supabase
      .from("registrations")
      .update({
        attendee_name: attendee_name.trim(),
        updated_at: new Date().toISOString()
      })
      .eq("id", registration_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Name updated successfully",
      old_name: registration.attendee_name,
      new_name: attendee_name.trim()
    })
  } catch (error: any) {
    console.error("Update name error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
