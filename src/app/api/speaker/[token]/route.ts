import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { webhookSpeakerResponded, webhookTravelSubmitted } from "@/lib/webhooks"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Find registration by portal_token in custom_fields
    const { data: registration, error } = await (supabase as any)
      .from("registrations")
      .select(`
        id,
        registration_number,
        attendee_name,
        attendee_email,
        attendee_phone,
        attendee_institution,
        attendee_designation,
        status,
        custom_fields,
        event_id,
        event:events(id, name, short_name, start_date, end_date, venue_name, city),
        ticket_type:ticket_types(name)
      `)
      .filter("custom_fields->>portal_token", "eq", token)
      .single()

    if (error || !registration) {
      console.error("Portal token lookup error:", error)
      return NextResponse.json(
        { error: "Invalid or expired invitation link" },
        { status: 404 }
      )
    }

    // Get sessions for this speaker from the event
    const { data: sessions } = await (supabase as any)
      .from("sessions")
      .select("id, session_name, session_date, start_time, end_time, hall, description, specialty_track")
      .eq("event_id", registration.event_id)
      .order("session_date")
      .order("start_time")

    // Filter sessions that belong to this speaker (by email in description)
    const speakerEmail = registration.attendee_email?.toLowerCase()
    const speakerSessions = (sessions || []).filter((session: any) => {
      if (session.description) {
        const parts = session.description.split(" | ")
        const email = parts[1]?.trim()?.toLowerCase()
        return email === speakerEmail
      }
      return false
    })

    return NextResponse.json({
      registration,
      sessions: speakerSessions,
    })
  } catch (error: any) {
    console.error("Speaker portal API error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { action, data } = body

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // First verify the token
    const { data: registration, error: findError } = await (supabase as any)
      .from("registrations")
      .select("id, custom_fields")
      .filter("custom_fields->>portal_token", "eq", token)
      .single()

    if (findError || !registration) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 })
    }

    let updateData: any = {}

    console.log("Speaker API - Current custom_fields:", registration.custom_fields)
    console.log("Speaker API - Incoming data:", data)

    if (action === "accept") {
      updateData = {
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        custom_fields: {
          ...registration.custom_fields,
          response_date: new Date().toISOString(),
        },
      }
    } else if (action === "decline") {
      updateData = {
        status: "declined",
        custom_fields: {
          ...registration.custom_fields,
          response_date: new Date().toISOString(),
          decline_reason: data?.reason || "",
        },
      }
    } else if (action === "update") {
      updateData = {
        custom_fields: {
          ...registration.custom_fields,
          ...data,
        },
      }
    }

    console.log("Speaker API - Final update data:", JSON.stringify(updateData, null, 2))

    const { error: updateError } = await (supabase as any)
      .from("registrations")
      .update(updateData)
      .eq("id", registration.id)

    if (updateError) {
      throw updateError
    }

    // Trigger webhooks for external integrations (Boost.space, etc.)
    try {
      // Get full registration data for webhook
      const { data: fullReg } = await (supabase as any)
        .from("registrations")
        .select("*, event:events(id, name)")
        .eq("id", registration.id)
        .single()

      if (fullReg) {
        // Speaker accepted/declined
        if (action === "accept" || action === "decline") {
          await webhookSpeakerResponded({
            registration_id: fullReg.id,
            event_id: fullReg.event_id,
            event_name: fullReg.event?.name || "",
            speaker_name: fullReg.attendee_name,
            speaker_email: fullReg.attendee_email,
            response: action === "accept" ? "accepted" : "declined",
          })
        }

        // Travel details submitted
        if (action === "update" && data?.travel_details) {
          await webhookTravelSubmitted({
            registration_id: fullReg.id,
            event_id: fullReg.event_id,
            event_name: fullReg.event?.name || "",
            speaker_name: fullReg.attendee_name,
            speaker_email: fullReg.attendee_email,
            from_city: data.travel_details.from_city,
            arrival_date: data.travel_details.arrival_date,
            departure_date: data.travel_details.departure_date,
            hotel_required: data.travel_details.hotel_required,
            pickup_required: data.travel_details.pickup_required,
            drop_required: data.travel_details.drop_required,
          })
        }
      }
    } catch (webhookError) {
      // Don't fail the request if webhook fails
      console.error("Webhook error:", webhookError)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Speaker portal update error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
