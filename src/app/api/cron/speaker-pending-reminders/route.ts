import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { logCronRun } from "@/lib/services/cron-logger"
import { selectEventsForTenant } from "@/lib/tenant"
import { isGallaboxEnabled, sendGallaboxTemplate } from "@/lib/gallabox"

// Daily reminder to speakers who have not yet responded to their invitation.
// Sends one WhatsApp per pending speaker per day (idempotent), with their
// personal speaker-portal link. Auto-stops for a speaker once they accept/
// decline (status leaves 'pending') and for an event once it has ended.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const run = await logCronRun("speaker-pending-reminders")
  try {
    if (!isGallaboxEnabled()) {
      await run.ok({ metadata: { skipped: "gallabox_disabled" } })
      return NextResponse.json({ message: "Gallabox not configured", sent: 0 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createAdminClient()) as any
    const today = new Date().toISOString().split("T")[0]
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://collegeofmas.org.in").trim()
    const TEMPLATE = (process.env.GALLABOX_TEMPLATE_SPEAKER_INVITATION || "speaker_invitation").trim()

    // Upcoming/ongoing events for this tenant only (cron is per-deployment).
    const { data: events, error: eventsError } = await selectEventsForTenant(
      supabase,
      "id, name, end_date",
    ).gte("end_date", today)

    if (eventsError) {
      await run.err(eventsError)
      return NextResponse.json({ error: eventsError.message }, { status: 500 })
    }
    if (!events || events.length === 0) {
      await run.ok({ syncedCount: 0, metadata: { reason: "no_upcoming_events" } })
      return NextResponse.json({ message: "No upcoming events", sent: 0 })
    }

    let sent = 0
    let failed = 0
    let skipped = 0

    for (const event of events) {
      const { data: speakers } = await supabase
        .from("registrations")
        .select("id, attendee_name, attendee_phone, custom_fields")
        .eq("event_id", event.id)
        .eq("attendee_designation", "Speaker")
        .eq("status", "pending")
        .not("attendee_phone", "is", null)

      for (const sp of speakers || []) {
        const cf = sp.custom_fields || {}
        const phone = (sp.attendee_phone || "").trim()
        const token = cf.portal_token
        if (!phone || !token) {
          skipped++
          continue
        }
        // One message per day: skip if already reminded today.
        const last = cf.last_speaker_reminder_at ? String(cf.last_speaker_reminder_at).split("T")[0] : null
        if (last === today) {
          skipped++
          continue
        }

        const name = (sp.attendee_name || "Speaker").trim() || "Speaker"
        const portalUrl = `${baseUrl}/speaker-portal/${token}`
        const result = await sendGallaboxTemplate(phone, name, TEMPLATE, {
          Speaker_Name: name,
          Event_Name: event.name,
          Portal_URL: portalUrl,
        })

        // Log the attempt (best-effort; same shape as other WhatsApp sends).
        try {
          await supabase.from("message_logs").insert({
            event_id: event.id,
            registration_id: sp.id,
            channel: "whatsapp",
            provider: "gallabox",
            recipient: phone,
            recipient_name: name,
            message_body: `Template: ${TEMPLATE} (pending-speaker reminder)`,
            status: result.success ? "sent" : "failed",
            provider_message_id: result.messageId || null,
            error_message: result.error || null,
            sent_at: result.success ? new Date().toISOString() : null,
            failed_at: result.success ? null : new Date().toISOString(),
          })
        } catch {
          /* non-blocking */
        }

        if (result.success) {
          sent++
          await supabase
            .from("registrations")
            .update({
              custom_fields: {
                ...cf,
                last_speaker_reminder_at: new Date().toISOString(),
                speaker_reminder_count: (cf.speaker_reminder_count || 0) + 1,
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", sp.id)
        } else {
          failed++
        }
      }
    }

    await run.ok({ syncedCount: sent, metadata: { sent, failed, skipped, events: events.length } })
    return NextResponse.json({ success: true, sent, failed, skipped, events: events.length })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[cron/speaker-pending-reminders] error:", message)
    await run.err(error)
    return NextResponse.json({ error: "Failed to send reminders" }, { status: 500 })
  }
}
