import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import {
  isQikchatEnabled,
  sendQikchatTemplate,
  QIKCHAT_TEMPLATE_WELCOME,
} from "@/lib/qikchat"
import { isGallaboxEnabled, sendGallaboxTemplate } from "@/lib/gallabox"

// POST /api/registrations/whatsapp-welcome
// Manually (re)send the welcome WhatsApp to one registration. Same template
// the auto-send path uses (`technosurg_welcome`); admins use this for resends
// or for offline registrations created without an automatic message.
export async function POST(request: NextRequest) {
  try {
    const { registration_id, event_id } = await request.json()

    if (!registration_id) {
      return NextResponse.json({ error: "registration_id is required" }, { status: 400 })
    }

    if (!isQikchatEnabled() && !isGallaboxEnabled()) {
      return NextResponse.json(
        { error: "WhatsApp is not configured. Set QIKCHAT_API_KEY or GALLABOX_API_KEY." },
        { status: 503 }
      )
    }

    if (event_id) {
      const { error: authError } = await requireEventAndPermission(event_id, "registrations")
      if (authError) return authError
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data: registration, error: regError } = await db
      .from("registrations")
      .select(`
        id,
        registration_number,
        attendee_name,
        attendee_phone,
        custom_fields,
        event_id
      `)
      .eq("id", registration_id)
      .single()

    if (regError || !registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }

    if (!registration.attendee_phone) {
      return NextResponse.json({ error: "Attendee phone not available" }, { status: 400 })
    }

    const eventIdToUse = event_id || registration.event_id

    if (!event_id && eventIdToUse) {
      const { error: authError } = await requireEventAndPermission(eventIdToUse, "registrations")
      if (authError) return authError
    }

    const { data: event } = await db
      .from("events")
      .select("name, short_name")
      .eq("id", eventIdToUse)
      .single()

    const eventName = event?.short_name || event?.name || "Event"
    const attendeeName = registration.attendee_name || "Delegate"
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "")
    // Prefill /my with the phone so taps from the link land on their registration.
    const portalUrl = `${baseUrl}/my?q=${encodeURIComponent(registration.attendee_phone)}`

    // Prefer Qikchat when configured; otherwise fall back to Gallabox
    // (college uses Gallabox via the approved `delegate_login` template).
    let result: { success: boolean; messageId?: string; error?: string }
    let providerUsed: string
    let templateUsed: string
    if (isQikchatEnabled()) {
      providerUsed = "qikchat"
      templateUsed = QIKCHAT_TEMPLATE_WELCOME
      result = await sendQikchatTemplate(
        registration.attendee_phone,
        QIKCHAT_TEMPLATE_WELCOME,
        [attendeeName, eventName, registration.registration_number, portalUrl]
      )
    } else {
      providerUsed = "gallabox"
      templateUsed = "delegate_login"
      result = await sendGallaboxTemplate(
        registration.attendee_phone,
        attendeeName,
        "delegate_login",
        { Delegate_Name: attendeeName, Event_Name: eventName, Portal_URL: portalUrl }
      )
    }

    // Log to message_logs (same shape as /api/whatsapp/send)
    try {
      await db.from("message_logs").insert({
        event_id: eventIdToUse || null,
        registration_id: registration.id,
        channel: "whatsapp",
        provider: providerUsed,
        recipient: registration.attendee_phone,
        recipient_name: attendeeName,
        subject: null,
        message_body: `Template: ${templateUsed}`,
        status: result.success ? "sent" : "failed",
        provider_message_id: result.messageId || null,
        error_message: result.error || null,
        sent_at: result.success ? new Date().toISOString() : null,
        failed_at: result.success ? null : new Date().toISOString(),
      })
    } catch (logError) {
      console.error("[registrations/whatsapp-welcome] Failed to log message:", (logError as Error).message)
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send WhatsApp message" },
        { status: 500 }
      )
    }

    // Stamp custom_fields so the UI can show "WA Sent" for resend visibility.
    await db
      .from("registrations")
      .update({
        custom_fields: {
          ...(registration.custom_fields || {}),
          welcome_whatsapp_sent: true,
          welcome_whatsapp_sent_at: new Date().toISOString(),
        },
      })
      .eq("id", registration.id)

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    })
  } catch (error) {
    const message = (error as Error)?.message || "Failed to send WhatsApp"
    console.error("[registrations/whatsapp-welcome] error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
