import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail, isEmailEnabled } from "@/lib/email"
import { logEmail } from "@/lib/email-tracking"
import { escapeHtml } from "@/lib/string-utils"

interface FacultyInvitationData {
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

// Core logic to send a single faculty invitation (used by both POST and PUT)
async function sendFacultyInvitation(data: FacultyInvitationData): Promise<{ success: boolean; error?: string; email_id?: string; dev_mode?: boolean }> {
  try {
  const {
    assignment_id,
    event_id,
    event_name,
    event_start_date,
    event_end_date,
    event_venue,
  } = data

  if (!assignment_id || !event_id || !event_name) {
    return { success: false, error: "Missing required fields" }
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
    return { success: false, error: "Assignment not found" }
  }

  if (!assignment.faculty_email) {
    return { success: false, error: "Faculty email not available" }
  }

  // Reject placeholder emails
  if (assignment.faculty_email.includes("@placeholder.")) {
    return { success: false, error: `Cannot send to placeholder email (${assignment.faculty_email}). Update with a real email first.` }
    }

    // Generate token if not exists
    let invitationToken = assignment.invitation_token
    if (!invitationToken) {
      invitationToken = crypto.randomUUID().replace(/-/g, "")
      await db
        .from("faculty_assignments")
        .update({ invitation_token: invitationToken })
        .eq("id", assignment_id)
    }

    // Generate portal URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    // Reject if NEXT_PUBLIC_APP_URL is still set to placeholder/example text
    if (baseUrl.includes("e.g.") || baseUrl.includes("your-") || baseUrl.includes("(your") || baseUrl.includes("example")) {
      return { success: false, error: "NEXT_PUBLIC_APP_URL is not configured. Set it to your actual domain in Vercel Environment Variables, then redeploy." }
    }

    const portalUrl = `${baseUrl}/respond/faculty/${invitationToken}`

    // Format event dates
    const startDate = formatDate(event_start_date)
    const endDate = event_end_date ? formatDate(event_end_date) : startDate
    const eventDateRange = event_start_date === event_end_date || !event_end_date
      ? startDate
      : `${startDate} - ${endDate}`

    // Build email HTML
    const roleLabel = assignment.role.charAt(0).toUpperCase() + assignment.role.slice(1)
    const emailSubject = `Invitation: ${roleLabel} at ${event_name}`
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
                  <td style="background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 26px; font-weight: bold;">Faculty Invitation</h1>
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
                      We are pleased to invite you as a <strong>${escapeHtml(roleLabel || "")}</strong> at <strong>${escapeHtml(event_name || "")}</strong>.
                    </p>

                    <!-- Session Details -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
                      <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 16px;">Session Details</h3>
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 8px 0; color: #64748b; width: 35%;">Session:</td>
                          <td style="padding: 8px 0; color: #1f2937; font-weight: 500;">${escapeHtml(assignment.session_name || "To be confirmed")}</td>
                        </tr>
                        ${assignment.topic_title ? `
                        <tr>
                          <td style="padding: 8px 0; color: #64748b;">Topic:</td>
                          <td style="padding: 8px 0; color: #1f2937;">${escapeHtml(assignment.topic_title || "")}</td>
                        </tr>
                        ` : ""}
                        <tr>
                          <td style="padding: 8px 0; color: #64748b;">Date:</td>
                          <td style="padding: 8px 0; color: #1f2937;">${assignment.session_date ? formatDate(assignment.session_date) : eventDateRange}</td>
                        </tr>
                        ${assignment.start_time ? `
                        <tr>
                          <td style="padding: 8px 0; color: #64748b;">Time:</td>
                          <td style="padding: 8px 0; color: #1f2937;">${formatTime(assignment.start_time)}${assignment.end_time ? ` - ${formatTime(assignment.end_time)}` : ""}</td>
                        </tr>
                        ` : ""}
                        ${assignment.hall ? `
                        <tr>
                          <td style="padding: 8px 0; color: #64748b;">Hall:</td>
                          <td style="padding: 8px 0; color: #1f2937;">${escapeHtml(assignment.hall || "")}</td>
                        </tr>
                        ` : ""}
                        ${event_venue ? `
                        <tr>
                          <td style="padding: 8px 0; color: #64748b;">Venue:</td>
                          <td style="padding: 8px 0; color: #1f2937;">${escapeHtml(event_venue || "")}</td>
                        </tr>
                        ` : ""}
                      </table>
                    </div>

                    <p style="color: #4b5563; font-size: 15px; margin: 0 0 25px 0; line-height: 1.6;">
                      Please confirm your participation by clicking the button below. You can also request changes to the schedule if needed.
                    </p>

                    <!-- CTA Button -->
                    <table role="presentation" style="width: 100%; margin: 30px 0;">
                      <tr>
                        <td align="center">
                          <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                            Respond to Invitation
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="color: #6b7280; font-size: 13px; margin: 20px 0 0 0; text-align: center;">
                      If the button doesn't work, copy and paste this link:<br>
                      <a href="${portalUrl}" style="color: #7c3aed; word-break: break-all;">${portalUrl}</a>
                    </p>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #1f2937; padding: 25px 30px; border-radius: 0 0 16px 16px; text-align: center;">
                    <p style="color: #9ca3af; margin: 0 0 10px 0; font-size: 14px;">
                      We look forward to your confirmation!
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
        return { success: false, error: result.error || "Failed to send email" }
      }

      console.log(`Faculty invitation sent to ${assignment.faculty_email} - ID: ${result.id}`)

      // Update assignment status
      await db
        .from("faculty_assignments")
        .update({
          status: "invited",
          invitation_sent_at: new Date().toISOString(),
        })
        .eq("id", assignment_id)

      // Log email for tracking (non-blocking)
      if (result.id) {
        try {
          await logEmail({
            resendEmailId: result.id,
            emailType: "speaker_invitation",
            fromEmail,
            toEmail: assignment.faculty_email,
            subject: emailSubject,
            eventId: event_id,
            metadata: {
              assignment_id,
              faculty_name: assignment.faculty_name,
              role: assignment.role,
              session_name: assignment.session_name,
            },
          })

          await db.from("assignment_emails").insert({
            assignment_id,
            event_id,
            email_type: "invitation",
            recipient_email: assignment.faculty_email,
            recipient_name: assignment.faculty_name,
            subject: emailSubject,
            body_preview: `Invitation as ${roleLabel} for ${assignment.session_name || event_name}`,
            status: "sent",
            sent_at: new Date().toISOString(),
            external_id: result.id,
          })
        } catch (logError) {
          console.error("Email logging failed (email was still sent):", logError)
        }
      }

      return { success: true, email_id: result.id }
    } else {
      console.log(`[DEV] Would send faculty invitation to ${assignment.faculty_email}`)

      // Still update status in dev mode
      await db
        .from("faculty_assignments")
        .update({
          status: "invited",
          invitation_sent_at: new Date().toISOString(),
        })
        .eq("id", assignment_id)

      return { success: true, dev_mode: true }
    }
  } catch (error: any) {
    console.error("Error sending faculty invitation:", error)
    return { success: false, error: error.message || "Failed to send faculty invitation" }
  }
}

// POST /api/email/faculty-invitation - Send single faculty invitation
export async function POST(request: NextRequest) {
  try {
    const body: FacultyInvitationData = await request.json()
    const result = await sendFacultyInvitation(body)

    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error in POST /api/email/faculty-invitation:", error)
    return NextResponse.json(
      { error: "Failed to send faculty invitation" },
      { status: 500 }
    )
  }
}

// PUT /api/email/faculty-invitation - Send bulk faculty invitations
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { assignment_ids, event_id, event_name, event_start_date, event_end_date, event_venue } = body

    if (!assignment_ids || !Array.isArray(assignment_ids) || assignment_ids.length === 0) {
      return NextResponse.json(
        { error: "assignment_ids array is required" },
        { status: 400 }
      )
    }

    let successCount = 0
    let failCount = 0
    const errors: string[] = []

    for (const assignment_id of assignment_ids) {
      const result = await sendFacultyInvitation({
        assignment_id,
        event_id,
        event_name,
        event_start_date,
        event_end_date,
        event_venue,
      })

      if (result.success) {
        successCount++
      } else {
        failCount++
        errors.push(`${assignment_id}: ${result.error || "Unknown error"}`)
      }
    }

    return NextResponse.json({
      success: failCount === 0,
      sent: successCount,
      failed: failCount,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error("Error in PUT /api/email/faculty-invitation:", error)
    return NextResponse.json(
      { error: "Failed to send bulk faculty invitations" },
      { status: 500 }
    )
  }
}
