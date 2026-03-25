/**
 * Waitlist Auto-Notification Service
 *
 * When a registration is cancelled and a ticket becomes available,
 * automatically notify the first person on the waitlist for that ticket type.
 *
 * Only notifies ONE person at a time (first come, first served).
 * Does NOT auto-register — the person must register themselves.
 */

import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail, isEmailEnabled } from "@/lib/email"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://collegeofmas.org.in"

/**
 * Notify the first waitlisted person that a spot has opened up.
 *
 * Call this after a registration is successfully cancelled.
 *
 * @param eventId - The event ID
 * @param ticketTypeId - The ticket type ID (can be null for general waitlist)
 */
export async function notifyWaitlist(
  eventId: string,
  ticketTypeId: string | null
): Promise<{ notified: boolean; email?: string; error?: string }> {
  try {
    if (!isEmailEnabled()) {
      console.log("[WaitlistNotify] Email not configured, skipping notification")
      return { notified: false, error: "Email not configured" }
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // 1. Find the first waitlisted person (FIFO by created_at) who hasn't been notified
    let query = db
      .from("waitlist")
      .select("id, email, name, ticket_type_id")
      .eq("event_id", eventId)
      .eq("status", "waiting")
      .is("notified_at", null)
      .order("created_at", { ascending: true })
      .limit(1)

    if (ticketTypeId) {
      query = query.eq("ticket_type_id", ticketTypeId)
    } else {
      query = query.is("ticket_type_id", null)
    }

    const { data: entries, error: fetchError } = await query

    if (fetchError) {
      console.error("[WaitlistNotify] Failed to query waitlist:", fetchError)
      return { notified: false, error: "Failed to query waitlist" }
    }

    if (!entries || entries.length === 0) {
      console.log("[WaitlistNotify] No one waiting on the waitlist for this ticket type")
      return { notified: false }
    }

    const entry = entries[0]

    // 2. Get ticket type name and event name for the email
    let ticketName = "General Admission"
    let eventName = "the event"

    if (ticketTypeId) {
      const { data: ticket } = await db
        .from("ticket_types")
        .select("name")
        .eq("id", ticketTypeId)
        .maybeSingle()

      if (ticket?.name) {
        ticketName = ticket.name
      }
    }

    const { data: event } = await db
      .from("events")
      .select("name, short_name, code")
      .eq("id", eventId)
      .maybeSingle()

    if (event) {
      eventName = event.short_name || event.name || eventName
    }

    // 3. Build registration link
    const eventCode = event?.code || eventId
    const registerUrl = `${SITE_URL}/register/${eventCode}`

    // 4. Send notification email
    const emailResult = await sendEmail({
      to: entry.email,
      subject: `A spot has opened up for ${ticketName} - ${eventName}!`,
      html: buildWaitlistEmailHtml({
        name: entry.name,
        ticketName,
        eventName,
        registerUrl,
      }),
    })

    if (!emailResult.success) {
      console.error("[WaitlistNotify] Failed to send email:", emailResult.error)
      return { notified: false, email: entry.email, error: emailResult.error }
    }

    // 5. Mark the waitlist entry as notified
    const { error: updateError } = await db
      .from("waitlist")
      .update({
        notified_at: new Date().toISOString(),
        status: "notified",
      })
      .eq("id", entry.id)

    if (updateError) {
      console.error("[WaitlistNotify] Failed to update notified_at:", updateError)
      // Email was sent, so still return notified = true
    }

    console.log(
      `[WaitlistNotify] Notified ${entry.name} (${entry.email}) about opening for ${ticketName}`
    )

    return { notified: true, email: entry.email }
  } catch (error: any) {
    console.error("[WaitlistNotify] Unexpected error:", error)
    return { notified: false, error: error.message || "Unexpected error" }
  }
}

/**
 * Build the HTML email body for waitlist notification
 */
function buildWaitlistEmailHtml(params: {
  name: string
  ticketName: string
  eventName: string
  registerUrl: string
}): string {
  const { name, ticketName, eventName, registerUrl } = params

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#7c3aed; padding:24px 32px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:20px; font-weight:600;">
                A Spot Has Opened Up!
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px; color:#18181b; font-size:16px; line-height:1.5;">
                Hi ${escapeHtml(name)},
              </p>
              <p style="margin:0 0 16px; color:#3f3f46; font-size:15px; line-height:1.6;">
                Great news! A spot has just opened up for <strong>${escapeHtml(ticketName)}</strong> at <strong>${escapeHtml(eventName)}</strong>.
              </p>
              <p style="margin:0 0 24px; color:#3f3f46; font-size:15px; line-height:1.6;">
                Spots are limited and available on a first-come, first-served basis. Register now to secure your place!
              </p>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${registerUrl}" target="_blank"
                       style="display:inline-block; background-color:#7c3aed; color:#ffffff; padding:14px 32px; border-radius:6px; text-decoration:none; font-size:16px; font-weight:600;">
                      Register Now
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0; color:#71717a; font-size:13px; line-height:1.5;">
                If you no longer wish to attend, you can simply ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px; border-top:1px solid #e4e4e7; text-align:center;">
              <p style="margin:0; color:#a1a1aa; font-size:12px;">
                You received this email because you joined the waitlist for ${escapeHtml(eventName)}.
              </p>
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
