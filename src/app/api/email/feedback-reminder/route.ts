import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail, isEmailEnabled } from "@/lib/email"
import { logEmail } from "@/lib/email-tracking"
import { escapeHtml } from "@/lib/string-utils"

// POST /api/email/feedback-reminder - Send feedback reminder email to attendee
export async function POST(request: NextRequest) {
  try {
    const { registration_id, event_id, form_id, form_name } = await request.json()

    if (!registration_id) {
      return NextResponse.json({ error: "registration_id is required" }, { status: 400 })
    }
    if (!form_id) {
      return NextResponse.json({ error: "form_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Get registration details
    const { data: registration, error: regError } = await db
      .from("registrations")
      .select(`
        id,
        registration_number,
        attendee_name,
        attendee_email,
        attendee_designation,
        attendee_institution,
        event_id
      `)
      .eq("id", registration_id)
      .single()

    if (regError || !registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }

    if (!registration.attendee_email) {
      return NextResponse.json({ error: "Attendee email not available" }, { status: 400 })
    }

    const eventIdToUse = event_id || registration.event_id

    // Get event details
    const { data: event } = await db
      .from("events")
      .select("name, short_name, start_date, end_date, venue_name, city")
      .eq("id", eventIdToUse)
      .single()

    const eventName = event?.short_name || event?.name || "Event"
    const feedbackFormName = form_name || "Feedback Form"

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collegeofmas.org.in"
    const delegatePortalUrl = `${baseUrl}/my`

    const emailSubject = `Share Your Feedback - ${eventName}`
    const fromEmail = process.env.RESEND_FROM_EMAIL || "AMASI Events <noreply@resend.dev>"

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
                  <td style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 15px;">📝</div>
                    <h1 style="color: white; margin: 0; font-size: 26px; font-weight: bold;">Share Your Feedback</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 16px;">${escapeHtml(eventName)}</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="background-color: white; padding: 30px;">

                    <p style="color: #1f2937; font-size: 16px; margin: 0 0 15px 0; line-height: 1.6;">
                      Dear <strong>${escapeHtml(registration.attendee_name || "")}</strong>,
                    </p>

                    <p style="color: #4b5563; font-size: 15px; margin: 0 0 20px 0; line-height: 1.6;">
                      Thank you for attending <strong>${escapeHtml(eventName)}</strong>. We would love to hear your thoughts!
                      Please take a moment to fill out the <strong>${escapeHtml(feedbackFormName)}</strong>.
                    </p>

                    <p style="color: #4b5563; font-size: 15px; margin: 0 0 20px 0; line-height: 1.6;">
                      Your feedback helps us improve future events and deliver better experiences.
                    </p>

                    <!-- CTA Button -->
                    <table role="presentation" style="width: 100%; margin: 30px 0;">
                      <tr>
                        <td align="center">
                          <a href="${delegatePortalUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                            Submit Feedback
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="color: #6b7280; font-size: 13px; margin: 20px 0 0 0; text-align: center; line-height: 1.6;">
                      Click the button above to visit the Delegate Portal.<br>
                      Enter your registered email <strong>${escapeHtml(registration.attendee_email || "")}</strong> to access the feedback form.
                    </p>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #1f2937; padding: 25px 30px; border-radius: 0 0 16px 16px; text-align: center;">
                    <p style="color: #9ca3af; margin: 0 0 10px 0; font-size: 14px;">
                      Thank you for being part of ${escapeHtml(eventName)}!
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

    // Send email
    if (isEmailEnabled()) {
      const result = await sendEmail({
        to: registration.attendee_email,
        subject: emailSubject,
        html: emailHtml,
      })

      if (!result.success) {
        console.error("Email send error:", result.error)
        return NextResponse.json({
          success: false,
          error: "Failed to send email",
          details: result.error
        }, { status: 500 })
      }

      console.log(`Feedback reminder sent to ${registration.attendee_email} - ID: ${result.id}`)

      // Log email for tracking
      if (result.id) {
        await logEmail({
          resendEmailId: result.id,
          emailType: "reminder",
          fromEmail,
          toEmail: registration.attendee_email,
          subject: emailSubject,
          eventId: eventIdToUse,
          registrationId: registration_id,
          metadata: {
            type: "feedback_reminder",
            form_id: form_id,
            form_name: feedbackFormName,
            attendee_name: registration.attendee_name,
            delegate_portal_url: delegatePortalUrl,
          },
        })
      }

      return NextResponse.json({
        success: true,
        message: "Feedback reminder sent",
        email: registration.attendee_email,
        email_id: result.id
      })
    } else {
      console.log(`[DEV] Would send feedback reminder to ${registration.attendee_email}`)
      return NextResponse.json({
        success: true,
        message: "Email skipped (no API key configured)",
        dev_mode: true
      })
    }
  } catch (error: any) {
    console.error("Error sending feedback reminder:", error)
    return NextResponse.json({ error: "Failed to send feedback reminder" }, { status: 500 })
  }
}
