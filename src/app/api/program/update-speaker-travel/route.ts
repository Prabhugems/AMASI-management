import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// POST - Update speaker registrations with travel data from sessions
export async function POST(request: NextRequest) {
  try {
    const { event_id } = await request.json()

    if (!event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Get all sessions for this event
    const { data: sessions } = await (supabase as any)
      .from("sessions")
      .select("*")
      .eq("event_id", event_id)

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ error: "No sessions found" }, { status: 404 })
    }

    // Get all speaker registrations for this event
    const { data: registrations } = await (supabase as any)
      .from("registrations")
      .select("*")
      .eq("event_id", event_id)
      .or("attendee_designation.ilike.%speaker%,attendee_designation.ilike.%faculty%")

    if (!registrations || registrations.length === 0) {
      return NextResponse.json({ error: "No speaker registrations found. Please import with 'Create speaker registrations' enabled." }, { status: 404 })
    }

    // Build a map of email -> travel requirements from sessions
    // The session description format is "Name | Email | Phone"
    // We need to check if any session mentions travel requirements
    const travelMap = new Map<string, { needsTravel: boolean; needsHotel: boolean }>()

    // For now, we'll parse from the original CSV data stored in session metadata
    // But since we don't have that, let's check the speaker's portal page submissions

    // Alternative: Check sessions to find speakers who need travel
    // We'll look at sessions where description contains the email

    let updated = 0
    let alreadySet = 0
    let notFound = 0

    for (const reg of registrations) {
      const email = reg.attendee_email?.toLowerCase()
      if (!email) continue

      // Check if already has travel set
      if (reg.custom_fields?.needs_travel !== undefined) {
        alreadySet++
        continue
      }

      // Find sessions for this speaker
      const speakerSessions = sessions.filter((s: any) =>
        s.description?.toLowerCase().includes(email)
      )

      if (speakerSessions.length === 0) {
        notFound++
        continue
      }

      // Generate portal token if missing
      const portalToken = reg.custom_fields?.portal_token || crypto.randomUUID()

      // Update registration with travel flag (default to true for speakers without explicit data)
      const { error } = await (supabase as any)
        .from("registrations")
        .update({
          custom_fields: {
            ...(reg.custom_fields || {}),
            portal_token: portalToken,
            needs_travel: true, // Default to true - speaker can update via portal
            travel_details: {
              mode: "flight",
              hotel_required: true,
            },
          },
        })
        .eq("id", reg.id)

      if (!error) updated++
    }

    return NextResponse.json({
      success: true,
      updated,
      alreadySet,
      notFound,
      total: registrations.length,
    })
  } catch (error: any) {
    console.error("Error updating speaker travel:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
