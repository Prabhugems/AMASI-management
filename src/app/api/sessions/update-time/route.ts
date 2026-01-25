import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

interface UpdateTimeRequest {
  session_id: string
  new_date?: string
  new_start_time?: string
  new_end_time?: string
  notify_speaker?: boolean
  notify_committee?: boolean
  change_reason?: string
  committee_emails?: string[]
}

export async function PUT(request: NextRequest) {
  try {
    const body: UpdateTimeRequest = await request.json()
    const {
      session_id,
      new_date,
      new_start_time,
      new_end_time,
      notify_speaker = true,
      notify_committee = false,
      change_reason = "",
      committee_emails = [],
    } = body

    if (!session_id) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Get current session details
    const { data: session, error: sessionError } = await (supabase as any)
      .from("sessions")
      .select(`
        id,
        session_name,
        session_date,
        start_time,
        end_time,
        hall,
        description,
        event_id,
        event:events(id, name, short_name)
      `)
      .eq("id", session_id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Store old values for comparison
    const oldDate = session.session_date
    const oldStartTime = session.start_time
    const oldEndTime = session.end_time

    // Build update object
    const updateData: any = {}
    if (new_date) updateData.session_date = new_date
    if (new_start_time) updateData.start_time = new_start_time
    if (new_end_time) updateData.end_time = new_end_time

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No changes provided" }, { status: 400 })
    }

    // Update the session
    const { error: updateError } = await (supabase as any)
      .from("sessions")
      .update(updateData)
      .eq("id", session_id)

    if (updateError) {
      throw updateError
    }

    // Extract speaker info from description (format: "Name | Email | Phone")
    let speakerEmail: string | null = null
    let speakerName: string | null = null
    if (session.description) {
      const parts = session.description.split(" | ")
      speakerName = parts[0]?.trim()
      speakerEmail = parts[1]?.trim()?.toLowerCase()
    }

    // Format times for email
    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    }

    const formatTime = (time: string) => {
      if (!time) return ""
      const [hours, minutes] = time.split(":")
      const h = parseInt(hours)
      const ampm = h >= 12 ? "PM" : "AM"
      const h12 = h % 12 || 12
      return `${h12}:${minutes} ${ampm}`
    }

    const emailResults: any[] = []

    // Send notification to speaker
    if (notify_speaker && speakerEmail && resend) {
      const changes: string[] = []
      if (new_date && new_date !== oldDate) {
        changes.push(`Date changed from ${formatDate(oldDate)} to ${formatDate(new_date)}`)
      }
      if (new_start_time && new_start_time !== oldStartTime) {
        changes.push(`Start time changed from ${formatTime(oldStartTime)} to ${formatTime(new_start_time)}`)
      }
      if (new_end_time && new_end_time !== oldEndTime) {
        changes.push(`End time changed from ${formatTime(oldEndTime)} to ${formatTime(new_end_time)}`)
      }

      const emailHtml = generateSpeakerEmailHtml({
        speakerName: speakerName || "Speaker",
        sessionName: session.session_name,
        eventName: session.event?.short_name || session.event?.name || "Event",
        changes,
        newDate: new_date || oldDate,
        newStartTime: new_start_time || oldStartTime,
        newEndTime: new_end_time || oldEndTime,
        hall: session.hall,
        reason: change_reason,
      })

      try {
        const result = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "AMASI Events <noreply@resend.dev>",
          to: speakerEmail,
          subject: `Session Time Updated - ${session.session_name}`,
          html: emailHtml,
        })

        emailResults.push({
          recipient: speakerEmail,
          type: "speaker",
          success: !result.error,
          id: result.data?.id,
        })
      } catch (e: any) {
        emailResults.push({
          recipient: speakerEmail,
          type: "speaker",
          success: false,
          error: e.message,
        })
      }
    }

    // Send notification to scientific committee
    if (notify_committee && committee_emails.length > 0 && resend) {
      const committeeEmailHtml = generateCommitteeEmailHtml({
        sessionName: session.session_name,
        speakerName: speakerName || "Unknown Speaker",
        speakerEmail: speakerEmail || "",
        eventName: session.event?.short_name || session.event?.name || "Event",
        oldDate,
        oldStartTime,
        oldEndTime,
        newDate: new_date || oldDate,
        newStartTime: new_start_time || oldStartTime,
        newEndTime: new_end_time || oldEndTime,
        reason: change_reason,
      })

      for (const email of committee_emails) {
        try {
          const result = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || "AMASI Events <noreply@resend.dev>",
            to: email,
            subject: `[Schedule Change] ${session.session_name} - ${speakerName}`,
            html: committeeEmailHtml,
          })

          emailResults.push({
            recipient: email,
            type: "committee",
            success: !result.error,
            id: result.data?.id,
          })
        } catch (e: any) {
          emailResults.push({
            recipient: email,
            type: "committee",
            success: false,
            error: e.message,
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      session_id,
      updated: updateData,
      notifications: emailResults,
    })
  } catch (error: any) {
    console.error("Error updating session time:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function generateSpeakerEmailHtml(data: {
  speakerName: string
  sessionName: string
  eventName: string
  changes: string[]
  newDate: string
  newStartTime: string
  newEndTime: string
  hall: string | null
  reason: string
}) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  const formatTime = (time: string) => {
    if (!time) return ""
    const [hours, minutes] = time.split(":")
    const h = parseInt(hours)
    const ampm = h >= 12 ? "PM" : "AM"
    const h12 = h % 12 || 12
    return `${h12}:${minutes} ${ampm}`
  }

  return `
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
                  <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">Session Schedule Updated</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">${data.eventName}</p>
                </td>
              </tr>

              <!-- Main Content -->
              <tr>
                <td style="background-color: white; padding: 30px;">
                  <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                    Dear ${data.speakerName},
                  </p>

                  <p style="color: #4b5563; font-size: 14px; margin: 0 0 20px 0;">
                    We wanted to inform you about a schedule change for your session:
                  </p>

                  <!-- Session Info -->
                  <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin-bottom: 25px;">
                    <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 18px;">${data.sessionName}</h2>
                  </div>

                  <!-- Changes -->
                  <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">What Changed</h3>
                  <ul style="margin: 0 0 25px 0; padding: 0 0 0 20px; color: #4b5563;">
                    ${data.changes.map((change) => `<li style="margin-bottom: 8px;">${change}</li>`).join("")}
                  </ul>

                  ${
                    data.reason
                      ? `
                  <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px; margin-bottom: 25px;">
                    <p style="color: #6b7280; margin: 0 0 5px 0; font-size: 12px; text-transform: uppercase;">Reason for change</p>
                    <p style="color: #374151; margin: 0; font-size: 14px;">${data.reason}</p>
                  </div>
                  `
                      : ""
                  }

                  <!-- New Schedule -->
                  <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Your Updated Schedule</h3>

                  <div style="background-color: #f0fdf4; border: 2px solid #10b981; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; width: 80px;">Date</td>
                        <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${formatDate(data.newDate)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Time</td>
                        <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${formatTime(data.newStartTime)} - ${formatTime(data.newEndTime)}</td>
                      </tr>
                      ${
                        data.hall
                          ? `
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Venue</td>
                        <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${data.hall}</td>
                      </tr>
                      `
                          : ""
                      }
                    </table>
                  </div>

                  <p style="color: #4b5563; font-size: 14px; margin: 0;">
                    If you have any concerns about this change, please contact the organizing team immediately.
                  </p>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #1f2937; padding: 25px 30px; border-radius: 0 0 16px 16px; text-align: center;">
                  <p style="color: #9ca3af; margin: 0 0 10px 0; font-size: 14px;">
                    Thank you for your understanding.
                  </p>
                  <p style="color: #6b7280; margin: 0; font-size: 12px;">
                    © ${new Date().getFullYear()} AMASI. All rights reserved.
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
}

function generateCommitteeEmailHtml(data: {
  sessionName: string
  speakerName: string
  speakerEmail: string
  eventName: string
  oldDate: string
  oldStartTime: string
  oldEndTime: string
  newDate: string
  newStartTime: string
  newEndTime: string
  reason: string
}) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const formatTime = (time: string) => {
    if (!time) return ""
    const [hours, minutes] = time.split(":")
    const h = parseInt(hours)
    const ampm = h >= 12 ? "PM" : "AM"
    const h12 = h % 12 || 12
    return `${h12}:${minutes} ${ampm}`
  }

  return `
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
                <td style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 30px; border-radius: 16px 16px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 20px; font-weight: bold;">Schedule Change Notification</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">${data.eventName} - Scientific Committee</p>
                </td>
              </tr>

              <!-- Main Content -->
              <tr>
                <td style="background-color: white; padding: 25px;">

                  <div style="background-color: #fef3c7; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                    <p style="color: #92400e; margin: 0; font-size: 14px;">
                      <strong>Session:</strong> ${data.sessionName}
                    </p>
                    <p style="color: #92400e; margin: 5px 0 0 0; font-size: 14px;">
                      <strong>Speaker:</strong> ${data.speakerName} (${data.speakerEmail})
                    </p>
                  </div>

                  <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <tr>
                      <th style="padding: 10px; background-color: #f9fafb; text-align: left; font-size: 12px; color: #6b7280; border: 1px solid #e5e7eb;">Field</th>
                      <th style="padding: 10px; background-color: #fef2f2; text-align: left; font-size: 12px; color: #6b7280; border: 1px solid #e5e7eb;">Previous</th>
                      <th style="padding: 10px; background-color: #f0fdf4; text-align: left; font-size: 12px; color: #6b7280; border: 1px solid #e5e7eb;">New</th>
                    </tr>
                    <tr>
                      <td style="padding: 10px; border: 1px solid #e5e7eb; font-size: 14px;">Date</td>
                      <td style="padding: 10px; border: 1px solid #e5e7eb; font-size: 14px; color: #dc2626;">${formatDate(data.oldDate)}</td>
                      <td style="padding: 10px; border: 1px solid #e5e7eb; font-size: 14px; color: #16a34a; font-weight: 600;">${formatDate(data.newDate)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px; border: 1px solid #e5e7eb; font-size: 14px;">Start Time</td>
                      <td style="padding: 10px; border: 1px solid #e5e7eb; font-size: 14px; color: #dc2626;">${formatTime(data.oldStartTime)}</td>
                      <td style="padding: 10px; border: 1px solid #e5e7eb; font-size: 14px; color: #16a34a; font-weight: 600;">${formatTime(data.newStartTime)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px; border: 1px solid #e5e7eb; font-size: 14px;">End Time</td>
                      <td style="padding: 10px; border: 1px solid #e5e7eb; font-size: 14px; color: #dc2626;">${formatTime(data.oldEndTime)}</td>
                      <td style="padding: 10px; border: 1px solid #e5e7eb; font-size: 14px; color: #16a34a; font-weight: 600;">${formatTime(data.newEndTime)}</td>
                    </tr>
                  </table>

                  ${
                    data.reason
                      ? `
                  <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px;">
                    <p style="color: #6b7280; margin: 0 0 5px 0; font-size: 12px; text-transform: uppercase;">Reason</p>
                    <p style="color: #374151; margin: 0; font-size: 14px;">${data.reason}</p>
                  </div>
                  `
                      : ""
                  }

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #1f2937; padding: 20px; border-radius: 0 0 16px 16px; text-align: center;">
                  <p style="color: #6b7280; margin: 0; font-size: 12px;">
                    © ${new Date().getFullYear()} AMASI Event Management
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
}
