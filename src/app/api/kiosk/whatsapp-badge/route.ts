import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isValidUUID } from "@/lib/validation"
import { isGallaboxEnabled, sendGallaboxTemplate } from "@/lib/gallabox"

export const dynamic = "force-dynamic"

// Approved Gallabox template used to deliver the badge link on WhatsApp. We
// reuse the existing "delegate_login" template (body vars Delegate_Name /
// Event_Name / Portal_URL) and pass the badge download link as Portal_URL.
// Swap this for a dedicated, badge-worded template once one is approved in
// Gallabox — only the constant needs to change.
const BADGE_WHATSAPP_TEMPLATE = "delegate_login"

// POST /api/kiosk/whatsapp-badge — public companion to the /kiosk self check-in.
// Sends the attendee their badge download link over WhatsApp via Gallabox.
// Runs server-side with the admin client (the kiosk page is anon).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const eventId = body.event_id as string | undefined
    const registrationId = body.registration_id as string | undefined

    if (!eventId || !isValidUUID(eventId)) {
      return NextResponse.json({ success: false, message: "Invalid event." }, { status: 400 })
    }
    if (!registrationId || !isValidUUID(registrationId)) {
      return NextResponse.json({ success: false, message: "Invalid registration." }, { status: 400 })
    }

    if (!isGallaboxEnabled()) {
      return NextResponse.json(
        { success: false, message: "WhatsApp is not configured." },
        { status: 503 }
      )
    }

    const supabase = await createAdminClient()

    const { data: registration } = await (supabase as any)
      .from("registrations")
      .select("id, event_id, registration_number, checkin_token, attendee_name, attendee_phone")
      .eq("id", registrationId)
      .maybeSingle()

    if (!registration || registration.event_id !== eventId) {
      return NextResponse.json({ success: false, message: "Registration not found." }, { status: 404 })
    }

    if (!registration.attendee_phone) {
      return NextResponse.json(
        { success: false, message: "No phone number on file for this registration." },
        { status: 422 }
      )
    }

    // Badge link is token-keyed (matches the email route exactly).
    if (!registration.checkin_token) {
      return NextResponse.json(
        { success: false, message: "Badge link unavailable for this registration." },
        { status: 409 }
      )
    }

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim() || "https://collegeofmas.org.in"
    const badgeUrl = `${baseUrl}/api/badge/${registration.checkin_token}/download`

    const { data: event } = await (supabase as any)
      .from("events")
      .select("name, short_name")
      .eq("id", eventId)
      .maybeSingle()
    const eventName = event?.short_name || event?.name || "the event"

    const result = await sendGallaboxTemplate(
      registration.attendee_phone,
      registration.attendee_name || "Delegate",
      BADGE_WHATSAPP_TEMPLATE,
      {
        Delegate_Name: registration.attendee_name || "Delegate",
        Event_Name: eventName,
        Portal_URL: badgeUrl,
      }
    )

    if (!result.success) {
      console.error("Kiosk WhatsApp badge failed:", result.error)
      return NextResponse.json(
        { success: false, message: "Couldn't send WhatsApp. Please try again." },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, message: "Badge sent on WhatsApp!" })
  } catch (error: any) {
    console.error("Kiosk WhatsApp badge error:", error)
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
