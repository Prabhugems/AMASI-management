import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { logEmail } from "@/lib/email-tracking"
import { sendEmail, isEmailEnabled } from "@/lib/email"

interface RequestTravelDetailsData {
  registration_id?: string
  event_id?: string
  speaker_name: string
  speaker_email: string
  event_name: string
  event_date: string
  event_venue?: string
  portal_url: string
}

// Format date
function formatDate(dateStr: string) {
  if (!dateStr) return ""
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

// POST /api/email/request-travel-details - Send request for travel details
export async function POST(request: NextRequest) {
  try {
    const body: RequestTravelDetailsData = await request.json()

    const {
      registration_id,
      event_id,
      speaker_name,
      speaker_email,
      event_name,
      event_date,
      event_venue,
      portal_url,
    } = body

    const emailSubject = `Action Required: Submit Your Travel Details for ${event_name}`
    const fromEmail = process.env.RESEND_FROM_EMAIL || "AMASI Events <noreply@resend.dev>"

    if (!speaker_email || !event_name || !portal_url) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

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
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 26px; font-weight: bold;">Travel Details Required</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 16px;">${event_name}</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="background-color: white; padding: 30px;">

                    <!-- Greeting -->
                    <p style="color: #1f2937; font-size: 16px; margin: 0 0 15px 0; line-height: 1.6;">
                      Dear <strong>${speaker_name}</strong>,
                    </p>

                    <p style="color: #4b5563; font-size: 15px; margin: 0 0 20px 0; line-height: 1.6;">
                      We are excited to have you as a speaker at <strong>${event_name}</strong>${event_date ? ` on ${formatDate(event_date)}` : ""}${event_venue ? ` at ${event_venue}` : ""}.
                    </p>

                    <p style="color: #4b5563; font-size: 15px; margin: 0 0 25px 0; line-height: 1.6;">
                      To help us arrange your travel and accommodation, please submit your travel requirements at your earliest convenience.
                    </p>

                    <!-- What we need -->
                    <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
                      <h3 style="color: #92400e; margin: 0 0 12px 0; font-size: 15px;">Please provide:</h3>
                      <ul style="margin: 0; padding: 0 0 0 20px; color: #78350f; font-size: 14px; line-height: 1.8;">
                        <li>Your departure city</li>
                        <li>Preferred travel dates and times</li>
                        <li>Hotel accommodation requirements</li>
                        <li>Any special requests or dietary requirements</li>
                      </ul>
                    </div>

                    <!-- CTA Button -->
                    <table role="presentation" style="width: 100%; margin: 30px 0;">
                      <tr>
                        <td align="center">
                          <a href="${portal_url}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                            Submit Travel Details
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="color: #6b7280; font-size: 13px; margin: 20px 0 0 0; text-align: center;">
                      If the button doesn't work, copy and paste this link:<br>
                      <a href="${portal_url}" style="color: #f59e0b; word-break: break-all;">${portal_url}</a>
                    </p>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #1f2937; padding: 25px 30px; border-radius: 0 0 16px 16px; text-align: center;">
                    <p style="color: #9ca3af; margin: 0 0 10px 0; font-size: 14px;">
                      We look forward to seeing you at ${event_name}!
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

    // Send email via configured provider (Blastable or Resend)
    if (isEmailEnabled()) {
      const result = await sendEmail({
        to: speaker_email,
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

      console.log(`Travel details request sent to ${speaker_email} - ID: ${result.id}`)

      // Log email for tracking
      if (result.id) {
        await logEmail({
          resendEmailId: result.id,
          emailType: "travel_request",
          fromEmail,
          toEmail: speaker_email,
          subject: emailSubject,
          eventId: event_id,
          registrationId: registration_id,
          metadata: { speaker_name, portal_url },
        })
      }

      // Update registration to mark request as sent
      if (registration_id) {
        const supabase = await createAdminClient()
        const { data: current } = await (supabase as any)
          .from("registrations")
          .select("custom_fields")
          .eq("id", registration_id)
          .single()

        await (supabase as any)
          .from("registrations")
          .update({
            custom_fields: {
              ...(current?.custom_fields || {}),
              travel_request_sent: true,
              travel_request_sent_date: new Date().toISOString(),
              travel_request_email_id: result.id,
            }
          })
          .eq("id", registration_id)
      }

      return NextResponse.json({
        success: true,
        message: "Travel details request sent",
        email_id: result.id
      })
    } else {
      console.log(`[DEV] Would send travel details request to ${speaker_email}`)
      return NextResponse.json({
        success: true,
        message: "Email skipped (no API key configured)",
        dev_mode: true
      })
    }
  } catch (error) {
    console.error("Error in POST /api/email/request-travel-details:", error)
    return NextResponse.json(
      { error: "Failed to send travel details request" },
      { status: 500 }
    )
  }
}
