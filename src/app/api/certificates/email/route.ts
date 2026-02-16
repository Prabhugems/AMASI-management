import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail, isEmailEnabled } from "@/lib/email"
import { logEmail } from "@/lib/email-tracking"
import { escapeHtml } from "@/lib/string-utils"

// POST /api/certificates/email - Send certificate email to attendee
export async function POST(request: NextRequest) {
  try {
    const { registration_id, event_id } = await request.json()

    if (!registration_id) {
      return NextResponse.json({ error: "registration_id is required" }, { status: 400 })
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
        event_id,
        custom_fields
      `)
      .eq("id", registration_id)
      .single()

    if (regError || !registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }

    if (!registration.attendee_email) {
      return NextResponse.json({ error: "Attendee email not available" }, { status: 400 })
    }

    // Note: No certificate_url check needed - email links to /my delegate portal
    // where the certificate is generated on-demand when the delegate downloads it

    const eventIdToUse = event_id || registration.event_id

    // Get event details
    const { data: event } = await db
      .from("events")
      .select("name, short_name, start_date, end_date, venue_name, city")
      .eq("id", eventIdToUse)
      .single()

    const eventName = event?.short_name || event?.name || "Event"
    const eventDate = event?.start_date
      ? new Date(event.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
      : ""
    const venue = event?.venue_name ? `${event.venue_name}${event.city ? `, ${event.city}` : ""}` : ""

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collegeofmas.org.in"
    const delegatePortalUrl = `${baseUrl}/my`

    const emailSubject = `Your Certificate of Participation - ${eventName}`
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
                  <td style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 15px;">🎓</div>
                    <h1 style="color: white; margin: 0; font-size: 26px; font-weight: bold;">Certificate of Participation</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 16px;">${escapeHtml(eventName || "")}</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="background-color: white; padding: 30px;">

                    <p style="color: #1f2937; font-size: 16px; margin: 0 0 15px 0; line-height: 1.6;">
                      Dear <strong>${escapeHtml(registration.attendee_name || "")}</strong>,
                    </p>

                    <p style="color: #4b5563; font-size: 15px; margin: 0 0 20px 0; line-height: 1.6;">
                      Thank you for attending <strong>${escapeHtml(eventName || "")}</strong>${eventDate ? ` on ${eventDate}` : ""}${venue ? ` at ${escapeHtml(venue || "")}` : ""}.
                      Your certificate of participation is ready for download.
                    </p>

                    <!-- Details Box -->
                    <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #065f46; width: 40%;">Name:</td>
                          <td style="padding: 8px 0; color: #1f2937; font-weight: bold;">${escapeHtml(registration.attendee_name || "")}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #065f46;">Registration #:</td>
                          <td style="padding: 8px 0; color: #1f2937; font-weight: bold;">${escapeHtml(registration.registration_number || "")}</td>
                        </tr>
                        ${registration.attendee_designation ? `
                        <tr>
                          <td style="padding: 8px 0; color: #065f46;">Designation:</td>
                          <td style="padding: 8px 0; color: #1f2937;">${escapeHtml(registration.attendee_designation || "")}</td>
                        </tr>
                        ` : ""}
                        ${registration.attendee_institution ? `
                        <tr>
                          <td style="padding: 8px 0; color: #065f46;">Institution:</td>
                          <td style="padding: 8px 0; color: #1f2937;">${escapeHtml(registration.attendee_institution || "")}</td>
                        </tr>
                        ` : ""}
                      </table>
                    </div>

                    <!-- CTA Button -->
                    <table role="presentation" style="width: 100%; margin: 30px 0;">
                      <tr>
                        <td align="center">
                          <a href="${delegatePortalUrl}" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                            Download Certificate
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="color: #6b7280; font-size: 13px; margin: 20px 0 0 0; text-align: center; line-height: 1.6;">
                      Click the button above to visit the Delegate Portal.<br>
                      Enter your registered email <strong>${escapeHtml(registration.attendee_email || "")}</strong> to access your certificate.
                    </p>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #1f2937; padding: 25px 30px; border-radius: 0 0 16px 16px; text-align: center;">
                    <p style="color: #9ca3af; margin: 0 0 10px 0; font-size: 14px;">
                      Thank you for being part of ${escapeHtml(eventName || "")}!
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

      console.log(`Certificate email sent to ${registration.attendee_email} - ID: ${result.id}`)

      // Log email for tracking
      if (result.id) {
        await logEmail({
          resendEmailId: result.id,
          emailType: "other",
          fromEmail,
          toEmail: registration.attendee_email,
          subject: emailSubject,
          eventId: eventIdToUse,
          registrationId: registration_id,
          metadata: {
            type: "certificate",
            attendee_name: registration.attendee_name,
            delegate_portal_url: delegatePortalUrl,
          },
        })
      }

      // Mark certificate as sent in custom_fields (server-side to bypass RLS)
      await db
        .from("registrations")
        .update({
          custom_fields: {
            ...(registration.custom_fields || {}),
            certificate_sent: true,
            certificate_sent_at: new Date().toISOString(),
          },
        })
        .eq("id", registration_id)

      return NextResponse.json({
        success: true,
        message: "Certificate email sent",
        email: registration.attendee_email,
        email_id: result.id
      })
    } else {
      console.log(`[DEV] Would send certificate email to ${registration.attendee_email}`)
      return NextResponse.json({
        success: true,
        message: "Email skipped (no API key configured)",
        dev_mode: true
      })
    }
  } catch (error: any) {
    console.error("Error sending certificate email:", error)
    return NextResponse.json({ error: "Failed to send certificate" }, { status: 500 })
  }
}
