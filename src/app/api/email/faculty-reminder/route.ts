import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail, isEmailEnabled } from "@/lib/email"
import { logEmail } from "@/lib/email-tracking"
import { escapeHtml } from "@/lib/string-utils"

interface FacultyReminderData {
  assignment_id: string
  event_id: string
  event_name: string
  event_start_date: string
  event_end_date?: string
  event_venue?: string
}

// Format time to 12-hour format
function formatTime(time: string) {
  if (!time || !time.includes(":")) return time || ""
  const [hours, minutes] = time.split(":")
  const h = parseInt(hours)
  if (isNaN(h)) return time
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${minutes || "00"} ${ampm}`
}

// Format date
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

// POST /api/email/faculty-reminder - Send faculty reminder email
export async function POST(request: NextRequest) {
  try {
    const body: FacultyReminderData = await request.json()
    const {
      assignment_id,
      event_id,
      event_name,
      event_start_date,
      event_end_date,
      event_venue: _event_venue,
    } = body

    if (!assignment_id || !event_id || !event_name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Get assignment details
    const { data: assignment, error: assignmentError } = await db
      .from("faculty_assignments")
      .select("*")
      .eq("id", assignment_id)
      .single()

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      )
    }

    if (!assignment.faculty_email) {
      return NextResponse.json(
        { error: "Faculty email not available" },
        { status: 400 }
      )
    }

    // Use existing token
    const invitationToken = assignment.invitation_token
    if (!invitationToken) {
      return NextResponse.json(
        { error: "No invitation token - send invitation first" },
        { status: 400 }
      )
    }

    // Generate portal URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const portalUrl = `${baseUrl}/respond/faculty/${invitationToken}`

    // Format event dates
    const startDate = formatDate(event_start_date)
    const endDate = event_end_date ? formatDate(event_end_date) : startDate
    const eventDateRange = event_start_date === event_end_date || !event_end_date
      ? startDate
      : `${startDate} - ${endDate}`

    // Build email HTML
    const roleLabel = assignment.role.charAt(0).toUpperCase() + assignment.role.slice(1)
    const reminderCount = (assignment.reminder_count || 0) + 1
    const emailSubject = `Reminder: Please Confirm Your Participation - ${event_name}`
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
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 26px; font-weight: bold;">Friendly Reminder</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 16px;">${escapeHtml(event_name || "")}</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="background-color: white; padding: 30px;">

                    <p style="color: #1f2937; font-size: 16px; margin: 0 0 15px 0; line-height: 1.6;">
                      Dear <strong>${escapeHtml(assignment.faculty_name || "")}</strong>,
                    </p>

                    <p style="color: #4b5563; font-size: 15px; margin: 0 0 20px 0; line-height: 1.6;">
                      This is a gentle reminder about your invitation as a <strong>${escapeHtml(roleLabel || "")}</strong> at <strong>${escapeHtml(event_name || "")}</strong>. We haven't received your response yet.
                    </p>

                    <!-- Session Details -->
                    <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
                      <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 16px;">Session Details</h3>
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #78350f; width: 35%;">Session:</td>
                          <td style="padding: 8px 0; color: #1f2937; font-weight: 500;">${escapeHtml(assignment.session_name || "To be confirmed")}</td>
                        </tr>
                        ${assignment.topic_title ? `
                        <tr>
                          <td style="padding: 8px 0; color: #78350f;">Topic:</td>
                          <td style="padding: 8px 0; color: #1f2937;">${escapeHtml(assignment.topic_title || "")}</td>
                        </tr>
                        ` : ""}
                        <tr>
                          <td style="padding: 8px 0; color: #78350f;">Date:</td>
                          <td style="padding: 8px 0; color: #1f2937;">${assignment.session_date ? formatDate(assignment.session_date) : eventDateRange}</td>
                        </tr>
                        ${assignment.start_time ? `
                        <tr>
                          <td style="padding: 8px 0; color: #78350f;">Time:</td>
                          <td style="padding: 8px 0; color: #1f2937;">${formatTime(assignment.start_time)}${assignment.end_time ? ` - ${formatTime(assignment.end_time)}` : ""}</td>
                        </tr>
                        ` : ""}
                        ${assignment.hall ? `
                        <tr>
                          <td style="padding: 8px 0; color: #78350f;">Hall:</td>
                          <td style="padding: 8px 0; color: #1f2937;">${escapeHtml(assignment.hall || "")}</td>
                        </tr>
                        ` : ""}
                      </table>
                    </div>

                    <p style="color: #4b5563; font-size: 15px; margin: 0 0 25px 0; line-height: 1.6;">
                      Your confirmation helps us finalize the program. Please take a moment to confirm or request changes.
                    </p>

                    <!-- CTA Button -->
                    <table role="presentation" style="width: 100%; margin: 30px 0;">
                      <tr>
                        <td align="center">
                          <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                            Respond Now
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="color: #6b7280; font-size: 13px; margin: 20px 0 0 0; text-align: center;">
                      If the button doesn't work, copy and paste this link:<br>
                      <a href="${portalUrl}" style="color: #f59e0b; word-break: break-all;">${portalUrl}</a>
                    </p>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #1f2937; padding: 25px 30px; border-radius: 0 0 16px 16px; text-align: center;">
                    <p style="color: #9ca3af; margin: 0 0 10px 0; font-size: 14px;">
                      Thank you for your time!
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
        to: assignment.faculty_email,
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

      console.log(`Faculty reminder sent to ${assignment.faculty_email} - ID: ${result.id}`)

      // Update assignment reminder count
      await db
        .from("faculty_assignments")
        .update({
          reminder_count: reminderCount,
          last_reminder_at: new Date().toISOString(),
        })
        .eq("id", assignment_id)

      // Log email for tracking
      if (result.id) {
        await logEmail({
          resendEmailId: result.id,
          emailType: "reminder",
          fromEmail,
          toEmail: assignment.faculty_email,
          subject: emailSubject,
          eventId: event_id,
          metadata: {
            assignment_id,
            faculty_name: assignment.faculty_name,
            role: assignment.role,
            reminder_count: reminderCount,
          },
        })

        // Also log to assignment_emails table
        await db.from("assignment_emails").insert({
          assignment_id,
          event_id,
          email_type: "reminder",
          recipient_email: assignment.faculty_email,
          recipient_name: assignment.faculty_name,
          subject: emailSubject,
          body_preview: `Reminder #${reminderCount} for ${assignment.session_name || event_name}`,
          status: "sent",
          sent_at: new Date().toISOString(),
          external_id: result.id,
        })
      }

      return NextResponse.json({
        success: true,
        message: "Faculty reminder sent",
        email_id: result.id,
        reminder_count: reminderCount,
      })
    } else {
      console.log(`[DEV] Would send faculty reminder to ${assignment.faculty_email}`)

      // Still update reminder count in dev mode
      await db
        .from("faculty_assignments")
        .update({
          reminder_count: reminderCount,
          last_reminder_at: new Date().toISOString(),
        })
        .eq("id", assignment_id)

      return NextResponse.json({
        success: true,
        message: "Email skipped (no API key configured)",
        dev_mode: true,
        reminder_count: reminderCount,
      })
    }
  } catch (error) {
    console.error("Error in POST /api/email/faculty-reminder:", error)
    return NextResponse.json(
      { error: "Failed to send faculty reminder" },
      { status: 500 }
    )
  }
}
