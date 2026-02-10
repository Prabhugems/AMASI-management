import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail, isEmailEnabled } from "@/lib/email"
import { requireEventAccess } from "@/lib/auth/api-auth"

interface BulkEmailData {
  event_id: string
  subject: string
  message: string
  recipient_ids: string[]
}

// POST /api/email/bulk - Send bulk emails to registrations
export async function POST(request: NextRequest) {
  try {
    const body: BulkEmailData = await request.json()
    const { event_id, subject, message, recipient_ids } = body

    if (!event_id || !subject || !message || !recipient_ids || recipient_ids.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const { error: authError } = await requireEventAccess(event_id)
    if (authError) return authError

    const supabase = await createAdminClient()

    // Get event details
    const { data: event } = await (supabase as any)
      .from("events")
      .select("id, name, short_name")
      .eq("id", event_id)
      .single()

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Get registrations
    const { data: registrations } = await (supabase as any)
      .from("registrations")
      .select("id, attendee_name, attendee_email")
      .in("id", recipient_ids)
      .eq("event_id", event_id)

    if (!registrations || registrations.length === 0) {
      return NextResponse.json({ error: "No recipients found" }, { status: 404 })
    }

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    }

    // Send emails
    for (const reg of registrations) {
      // Personalize message
      const personalizedMessage = message.replace(/\{\{name\}\}/gi, reg.attendee_name)

      // Build email HTML
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">

                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
                      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">${event.short_name || event.name}</h1>
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="background-color: white; padding: 30px;">
                      <div style="color: #1f2937; font-size: 15px; line-height: 1.8; white-space: pre-wrap;">${personalizedMessage}</div>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #1f2937; padding: 20px 30px; border-radius: 0 0 16px 16px; text-align: center;">
                      <p style="color: #9ca3af; margin: 0 0 10px 0; font-size: 12px;">
                        This email was sent to ${reg.attendee_email}
                      </p>
                      <p style="color: #6b7280; margin: 0; font-size: 12px;">
                        &copy; ${new Date().getFullYear()} AMASI. All rights reserved.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `

      if (isEmailEnabled()) {
        try {
          const result = await sendEmail({
            to: reg.attendee_email,
            subject: subject,
            html: emailHtml,
          })

          if (result.success) {
            results.sent++

            // Log email
            await (supabase as any)
              .from("email_logs")
              .insert({
                resend_email_id: result.id,
                email_type: "other",
                status: "sent",
                to_email: reg.attendee_email,
                subject: subject,
                event_id: event_id,
                registration_id: reg.id,
                sent_at: new Date().toISOString(),
              })
          } else {
            results.failed++
            results.errors.push(`${reg.attendee_email}: ${result.error}`)
          }
        } catch (err: any) {
          results.failed++
          results.errors.push(`${reg.attendee_email}: ${err.message}`)
        }
      } else {
        // Dev mode - simulate success
        results.sent++
        console.log(`[DEV] Would send email to ${reg.attendee_email}`)
      }
    }

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error: any) {
    console.error("Error in POST /api/email/bulk:", error)
    return NextResponse.json(
      { error: error.message || "Failed to send bulk emails" },
      { status: 500 }
    )
  }
}
