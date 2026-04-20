import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email"
import { COMPANY_CONFIG } from "@/lib/config"
import { logCronRun } from "@/lib/services/cron-logger"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

type ReminderType = "7_days" | "1_day" | "day_of"

/**
 * Cron job: Automated event reminders for delegates
 *
 * Sends reminders at 3 intervals:
 * - 7 days before event start
 * - 1 day before event start
 * - Day of the event
 *
 * Tracks sent reminders in registrations.custom_fields.reminders_sent[]
 * to avoid duplicate sends.
 *
 * Schedule: "30 5 * * *" (5:30 AM UTC = 11:00 AM IST)
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const run = await logCronRun("event-reminders")
  const supabase: SupabaseClient = await createAdminClient()
  const now = new Date()
  const todayStr = now.toISOString().split("T")[0]

  // Calculate target dates
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]
  const in1Day = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]

  try {
    // Find events matching any of the 3 reminder windows
    const targetDates = [in7Days, in1Day, todayStr]
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id, name, short_name, start_date, end_date, venue, venue_name, city, status")
      .in("start_date", targetDates)
      .not("status", "in", '(completed,cancelled,archived)')

    if (eventsError) {
      console.error("Cron event-reminders: failed to fetch events:", eventsError)
      return NextResponse.json({ error: eventsError.message }, { status: 500 })
    }

    if (!events || events.length === 0) {
      return NextResponse.json({
        message: "No events matching reminder windows",
        reminders_sent: 0,
      })
    }

    let totalSent = 0
    let totalSkipped = 0
    let totalFailed = 0
    const results: Array<{
      event: string
      reminder_type: ReminderType
      sent: number
      skipped: number
      failed: number
    }> = []

    for (const event of events) {
      // Determine which reminder type this event needs
      let reminderType: ReminderType
      if (event.start_date === in7Days) {
        reminderType = "7_days"
      } else if (event.start_date === in1Day) {
        reminderType = "1_day"
      } else {
        reminderType = "day_of"
      }

      // Get confirmed registrations for this event
      const { data: registrations, error: regError } = await supabase
        .from("registrations")
        .select("id, attendee_name, attendee_email, custom_fields, ticket_type_id")
        .eq("event_id", event.id)
        .eq("status", "confirmed")

      if (regError) {
        console.error(
          `Cron event-reminders: failed to fetch registrations for event ${event.id}:`,
          regError
        )
        continue
      }

      if (!registrations || registrations.length === 0) continue

      let sent = 0
      let skipped = 0
      let failed = 0

      for (const reg of registrations) {
        if (!reg.attendee_email) {
          skipped++
          continue
        }

        // Check if this reminder was already sent
        const remindersSent: string[] =
          reg.custom_fields?.reminders_sent || []
        const reminderKey = `${reminderType}_${event.start_date}`

        if (remindersSent.includes(reminderKey)) {
          skipped++
          continue
        }

        // Build and send the email
        const html = buildReminderEmail(event, reg, reminderType)
        const subject = buildSubject(event, reminderType)

        const result = await sendEmail({
          to: reg.attendee_email,
          subject,
          html,
        })

        if (result.success) {
          // Mark reminder as sent in custom_fields
          const updatedReminders = [...remindersSent, reminderKey]
          await supabase
            .from("registrations")
            .update({
              custom_fields: {
                ...(reg.custom_fields || {}),
                reminders_sent: updatedReminders,
              },
            })
            .eq("id", reg.id)

          sent++
          totalSent++
        } else {
          console.error(
            `Cron event-reminders: failed to send to ${reg.attendee_email}:`,
            result.error
          )
          failed++
          totalFailed++
        }

        // Rate limit: 250ms delay between emails
        await new Promise((resolve) => setTimeout(resolve, 250))
      }

      const eventLabel = event.short_name || event.name || event.id
      console.log(
        `Cron event-reminders: ${eventLabel} [${reminderType}] - sent: ${sent}, skipped: ${skipped}, failed: ${failed}`
      )
      results.push({
        event: eventLabel,
        reminder_type: reminderType,
        sent,
        skipped,
        failed,
      })

      totalSkipped += skipped
    }

    await run.ok({
      syncedCount: totalSent,
      metadata: { totalSent, totalSkipped, totalFailed, events_processed: events.length },
    })
    return NextResponse.json({
      message: `Event reminders processed: ${totalSent} sent, ${totalSkipped} skipped, ${totalFailed} failed`,
      reminders_sent: totalSent,
      skipped: totalSkipped,
      failed: totalFailed,
      events_processed: events.length,
      results,
    })
  } catch (error) {
    console.error("Cron event-reminders: unexpected error:", error)
    await run.err(error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

function buildSubject(
  event: { name: string; short_name?: string },
  reminderType: ReminderType
): string {
  const eventName = event.short_name || event.name
  switch (reminderType) {
    case "7_days":
      return `Reminder: ${eventName} is in 7 days`
    case "1_day":
      return `Reminder: ${eventName} is tomorrow!`
    case "day_of":
      return `${eventName} starts today!`
  }
}

function buildReminderEmail(
  event: {
    name: string
    short_name?: string
    start_date: string
    end_date?: string
    venue?: string
    venue_name?: string
    city?: string
  },
  registration: { attendee_name?: string },
  reminderType: ReminderType
): string {
  const eventName = event.name || event.short_name || "the event"
  const delegateName = registration.attendee_name || "Delegate"
  const venue = event.venue_name || event.venue || ""
  const city = event.city || ""
  const venueDisplay = [venue, city].filter(Boolean).join(", ")
  const startDate = formatDateReadable(event.start_date)
  const endDate = event.end_date ? formatDateReadable(event.end_date) : ""
  const dateRange = endDate && endDate !== startDate ? `${startDate} - ${endDate}` : startDate

  let greeting: string
  let mainMessage: string
  let detailsSection: string

  switch (reminderType) {
    case "7_days":
      greeting = `Dear ${delegateName},`
      mainMessage = `This is a friendly reminder that <strong>${eventName}</strong> is just <strong>7 days away</strong>!`
      detailsSection = `
        <p>We look forward to seeing you there. Please make sure you have all your travel and accommodation arrangements in place.</p>
        ${venueDisplay ? `<p><strong>Venue:</strong> ${venueDisplay}</p>` : ""}
        <p><strong>Date:</strong> ${dateRange}</p>
      `
      break

    case "1_day":
      greeting = `Dear ${delegateName},`
      mainMessage = `<strong>${eventName}</strong> is <strong>tomorrow</strong>! We are excited to have you join us.`
      detailsSection = `
        ${venueDisplay ? `<p><strong>Venue:</strong> ${venueDisplay}</p>` : ""}
        <p><strong>Date:</strong> ${dateRange}</p>
        <p>Please keep the following in mind:</p>
        <ul>
          <li>Carry a valid photo ID for registration</li>
          <li>Arrive early to complete on-site check-in smoothly</li>
          ${venueDisplay ? `<li>The event is at <strong>${venueDisplay}</strong></li>` : ""}
        </ul>
      `
      break

    case "day_of":
      greeting = `Dear ${delegateName},`
      mainMessage = `<strong>${eventName}</strong> starts <strong>today</strong>! We are thrilled to welcome you.`
      detailsSection = `
        ${venueDisplay ? `<p><strong>Venue:</strong> ${venueDisplay}</p>` : ""}
        <p><strong>Check-in instructions:</strong></p>
        <ul>
          <li>Head to the registration desk upon arrival</li>
          <li>Present your confirmation email or photo ID for badge collection</li>
          <li>Collect your delegate kit at the registration counter</li>
        </ul>
        <p>We wish you a productive and enriching experience!</p>
      `
      break
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f7; color: #333333;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f7; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1a56db; padding: 24px 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">${eventName}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px;">${greeting}</p>
              <p style="margin: 0 0 16px;">${mainMessage}</p>
              ${detailsSection}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 32px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 4px;">Sent by ${COMPANY_CONFIG.name}</p>
              <p style="margin: 0;">${COMPANY_CONFIG.supportEmail}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

function formatDateReadable(dateStr: string): string {
  try {
    const date = new Date(dateStr + "T00:00:00")
    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  } catch {
    return dateStr
  }
}
