import { NextRequest, NextResponse } from "next/server"
import { sendEmail, isEmailEnabled } from "@/lib/email"

interface FormNotificationData {
  form_id: string
  form_name: string
  submission_id: string
  submitter_name: string
  submitter_email: string
  notification_emails: string[]
  responses: Record<string, unknown>
  submitted_at: string
}

// POST /api/email/form-notification - Send form submission notification email
export async function POST(request: NextRequest) {
  try {
    const body: FormNotificationData = await request.json()

    const {
      form_name,
      submission_id,
      submitter_name,
      submitter_email,
      notification_emails,
      responses,
      submitted_at,
    } = body

    if (!notification_emails || notification_emails.length === 0) {
      return NextResponse.json(
        { error: "No notification emails provided" },
        { status: 400 }
      )
    }

    // Check if email feature is enabled
    if (!isEmailEnabled()) {
      console.log("Email feature not enabled - skipping form notification")
      return NextResponse.json({
        success: false,
        message: "Email not configured",
      })
    }

    // Format the submission date
    const formattedDate = submitted_at
      ? new Date(submitted_at).toLocaleString("en-IN", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: "Asia/Kolkata",
        })
      : "Just now"

    // Build response summary
    const responseSummary = Object.entries(responses)
      .map(([key, value]) => {
        const displayValue = typeof value === 'object'
          ? JSON.stringify(value, null, 2)
          : String(value || 'Not provided')
        return `<tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 500; color: #374151; width: 30%;">${key}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${displayValue}</td>
        </tr>`
      })
      .join("")

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
            <!-- Header -->
            <div style="background-color: #1f2937; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px;">New Form Submission</h1>
            </div>

            <!-- Content -->
            <div style="padding: 24px;">
              <p style="color: #374151; margin-bottom: 16px;">
                A new submission has been received for <strong>${form_name}</strong>.
              </p>

              <table style="width: 100%; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Submitted by:</td>
                  <td style="padding: 8px 0; color: #374151; font-weight: 500;">${submitter_name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Email:</td>
                  <td style="padding: 8px 0; color: #374151;">${submitter_email}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Submitted at:</td>
                  <td style="padding: 8px 0; color: #374151;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Submission ID:</td>
                  <td style="padding: 8px 0; color: #374151; font-family: monospace;">${submission_id}</td>
                </tr>
              </table>

              <h2 style="color: #374151; font-size: 16px; margin-bottom: 12px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
                Responses
              </h2>

              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                ${responseSummary || '<tr><td style="padding: 8px 12px; color: #6b7280;">No responses recorded</td></tr>'}
              </table>

              <div style="text-align: center; margin-top: 24px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/forms"
                   style="display: inline-block; background-color: #1f2937; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                  View All Submissions
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                This is an automated notification from AMASI Command Center.
              </p>
            </div>
          </div>
        </body>
      </html>
    `

    // Send to all notification emails
    const results = await Promise.allSettled(
      notification_emails.map((email) =>
        sendEmail({
          to: email,
          subject: `New submission: ${form_name}`,
          html: htmlContent,
        })
      )
    )

    const successful = results.filter((r) => r.status === "fulfilled" && (r.value as any).success).length
    const failed = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !(r.value as any).success)).length

    if (failed > 0) {
      console.error(
        "Some notification emails failed:",
        results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !(r.value as any).success))
      )
    }

    return NextResponse.json({
      success: true,
      sent: successful,
      failed: failed,
    })
  } catch (error) {
    console.error("Error sending form notification:", error)
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    )
  }
}
