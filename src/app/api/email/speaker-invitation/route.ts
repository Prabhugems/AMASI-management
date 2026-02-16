import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail, isEmailEnabled, getEmailProvider } from "@/lib/email"
import { shortenSpeakerPortalUrl } from "@/lib/linkila"
import { escapeHtml } from "@/lib/string-utils"
import { isGallaboxEnabled, sendGallaboxTemplate } from "@/lib/gallabox"

const PRODUCTION_URL = "https://collegeofmas.org.in"

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : PRODUCTION_URL)
}

interface SpeakerInvitationData {
  registration_id: string
  speaker_name: string
  speaker_email: string
  event_id: string
  event_name: string
  event_start_date: string
  event_end_date: string
  event_venue?: string
  portal_token: string
  sessions?: Array<{
    session_name: string
    session_date: string
    start_time: string
    end_time: string
    hall?: string
  }>
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

// Core logic to send a single speaker invitation (used by both POST and PUT)
async function sendSpeakerInvitation(data: SpeakerInvitationData): Promise<{ success: boolean; error?: string; email_id?: string; dev_mode?: boolean }> {
  try {
  const {
    registration_id,
    speaker_name,
    speaker_email,
    event_name,
    event_start_date,
    event_end_date,
    event_venue,
    portal_token,
    sessions = [],
  } = data

  if (!speaker_email || !portal_token || !event_name) {
    return { success: false, error: "Missing required fields" }
  }

  // Reject placeholder emails
  if (speaker_email.includes("@placeholder.")) {
    return { success: false, error: `Cannot send to placeholder email (${speaker_email}). Update with a real email first.` }
  }

  // Generate portal URL and shorten it
  const baseUrl = getBaseUrl()

  const fullPortalUrl = `${baseUrl}/speaker/${portal_token}`
  const portalUrl = await shortenSpeakerPortalUrl(fullPortalUrl, speaker_name, event_name)

    // Format event dates
    const startDate = formatDate(event_start_date)
    const endDate = formatDate(event_end_date)
    const eventDateRange = event_start_date === event_end_date
      ? startDate
      : `${startDate} - ${endDate}`

    // Build sessions HTML
    const sessionsHtml = sessions.length > 0 ? `
      <h2 style="color: #1f2937; margin: 25px 0 15px 0; font-size: 18px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Your Sessions</h2>
      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 12px 10px; text-align: left; font-size: 13px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Date & Time</th>
            <th style="padding: 12px 10px; text-align: left; font-size: 13px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Topic</th>
            <th style="padding: 12px 10px; text-align: left; font-size: 13px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Hall</th>
          </tr>
        </thead>
        <tbody>
          ${sessions.map(session => `
            <tr>
              <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
                <div style="font-weight: 600; color: #1f2937;">${formatDate(session.session_date)}</div>
                <div style="color: #6b7280; font-size: 13px;">${formatTime(session.start_time)} - ${formatTime(session.end_time)}</div>
              </td>
              <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${escapeHtml(session.session_name || "")}</td>
              <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">${escapeHtml(session.hall || "-")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    ` : ""

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
                  <td style="background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 26px; font-weight: bold;">You're Invited to Speak!</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 16px;">${escapeHtml(event_name || "")}</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="background-color: white; padding: 30px;">

                    <!-- Greeting -->
                    <p style="color: #1f2937; font-size: 16px; margin: 0 0 20px 0; line-height: 1.6;">
                      Dear <strong>${escapeHtml(speaker_name || "")}</strong>,
                    </p>
                    <p style="color: #4b5563; font-size: 15px; margin: 0 0 25px 0; line-height: 1.6;">
                      We are honored to invite you as a speaker at <strong>${escapeHtml(event_name || "")}</strong>. Your expertise and insights would greatly enrich our event, and we would be delighted to have you share your knowledge with our attendees.
                    </p>

                    <!-- Event Details -->
                    <div style="background-color: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
                      <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 16px;">Event Details</h2>
                      <table role="presentation" style="width: 100%;">
                        <tr>
                          <td style="padding: 6px 0; color: #6b7280; width: 100px; font-size: 14px;">Event</td>
                          <td style="padding: 6px 0; color: #1f2937; font-weight: 600; font-size: 14px;">${escapeHtml(event_name || "")}</td>
                        </tr>
                        <tr>
                          <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Date</td>
                          <td style="padding: 6px 0; color: #1f2937; font-size: 14px;">${eventDateRange}</td>
                        </tr>
                        ${event_venue ? `
                        <tr>
                          <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Venue</td>
                          <td style="padding: 6px 0; color: #1f2937; font-size: 14px;">${escapeHtml(event_venue || "")}</td>
                        </tr>
                        ` : ""}
                      </table>
                    </div>

                    <!-- Sessions -->
                    ${sessionsHtml}

                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 30px 0;">
                      <p style="color: #4b5563; font-size: 14px; margin: 0 0 15px 0;">
                        Please respond to this invitation using the button below:
                      </p>
                      <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                        View Invitation & Respond
                      </a>
                    </div>

                    <!-- What you can do -->
                    <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 12px; padding: 20px; margin: 25px 0;">
                      <h3 style="color: #7c3aed; margin: 0 0 12px 0; font-size: 15px;">Through the portal, you can:</h3>
                      <ul style="margin: 0; padding: 0 0 0 20px; color: #6b7280; font-size: 14px; line-height: 1.8;">
                        <li>Accept or decline the invitation</li>
                        <li>View your assigned session details</li>
                        <li>Request travel & accommodation assistance</li>
                        <li>Update your contact information</li>
                      </ul>
                    </div>

                    <!-- Deadline note -->
                    <p style="color: #6b7280; font-size: 13px; margin: 20px 0 0 0; text-align: center;">
                      Please respond at your earliest convenience so we can finalize the event schedule.
                    </p>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #1f2937; padding: 25px 30px; border-radius: 0 0 16px 16px; text-align: center;">
                    <p style="color: #9ca3af; margin: 0 0 10px 0; font-size: 14px;">
                      If you have any questions, please contact us.
                    </p>
                    <p style="color: #6b7280; margin: 0 0 15px 0; font-size: 12px;">
                      This invitation was sent to ${escapeHtml(speaker_email || "")}
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
        subject: `Speaker Invitation - ${event_name}`,
        html: emailHtml,
      })

      if (!result.success) {
        console.error("Email send error:", result.error)
        return { success: false, error: result.error || "Failed to send email" }
      }

      console.log(`Speaker invitation sent to ${speaker_email} - ID: ${result.id}`)

      // Update registration to mark invitation as sent (preserve existing fields!)
      if (registration_id) {
        const supabase = await createAdminClient()
        // Fetch fresh custom_fields to avoid overwriting portal_token and other data
        const { data: freshReg } = await (supabase as any)
          .from("registrations")
          .select("custom_fields")
          .eq("id", registration_id)
          .single()

        const existingFields = freshReg?.custom_fields || {}
        const currentSendCount = typeof existingFields.invitation_send_count === "number" ? existingFields.invitation_send_count : 0

        await (supabase as any)
          .from("registrations")
          .update({
            custom_fields: {
              ...existingFields,
              invitation_status: "sent",
              invitation_sent_at: new Date().toISOString(),
              invitation_email_id: result.id,
              invitation_send_count: currentSendCount + 1,
            }
          })
          .eq("id", registration_id)
      }

      // Send WhatsApp notification via Gallabox (non-blocking)
      if (isGallaboxEnabled() && registration_id) {
        try {
          const supabase2 = await createAdminClient()
          const { data: reg } = await (supabase2 as any)
            .from("registrations")
            .select("attendee_phone")
            .eq("id", registration_id)
            .single()

          if (reg?.attendee_phone) {
            const templateName = (process.env.GALLABOX_TEMPLATE_SPEAKER_INVITATION || "speaker_invitation").trim()
            const portalUrlForWa = fullPortalUrl // use the full URL, not shortened (templates have char limits)
            const waResult = await sendGallaboxTemplate(
              reg.attendee_phone,
              speaker_name || "Speaker",
              templateName,
              [speaker_name || "Speaker", event_name, portalUrlForWa]
            )

            if (waResult.success) {
              console.log(`[WhatsApp] Speaker invitation sent to ${reg.attendee_phone} - ID: ${waResult.messageId}`)
            } else {
              console.warn(`[WhatsApp] Failed to send speaker invitation to ${reg.attendee_phone}: ${waResult.error}`)
            }
          }
        } catch (waError: any) {
          console.warn("[WhatsApp] Non-blocking error sending speaker invitation:", waError.message)
        }
      }

      return { success: true, email_id: result.id }
    } else {
      console.error(`[Email] No email provider configured - cannot send to ${speaker_email}`)
      return { success: false, error: "No email provider configured. Add RESEND_API_KEY or BLASTABLE_API_KEY in Vercel Environment Variables and redeploy." }
    }
  } catch (error: any) {
    console.error("Error sending speaker invitation:", error)
    return { success: false, error: error.message || "Failed to send invitation email" }
  }
}

// POST /api/email/speaker-invitation - Send speaker invitation email
export async function POST(request: NextRequest) {
  try {
    // Pre-flight check: fail fast with clear message
    if (!isEmailEnabled()) {
      return NextResponse.json(
        { error: "No email provider configured. Add BLASTABLE_API_KEY or RESEND_API_KEY in Vercel Environment Variables, then redeploy." },
        { status: 503 }
      )
    }

    const body: SpeakerInvitationData = await request.json()
    const result = await sendSpeakerInvitation(body)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Error in POST /api/email/speaker-invitation:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to send invitation email" },
      { status: 500 }
    )
  }
}

// POST /api/email/speaker-invitation/bulk - Send bulk invitations
export async function PUT(request: NextRequest) {
  try {
    const { registration_ids, event_id } = await request.json()

    if (!registration_ids || !Array.isArray(registration_ids) || registration_ids.length === 0) {
      return NextResponse.json(
        { error: "registration_ids array is required" },
        { status: 400 }
      )
    }

    // Pre-flight check: fail fast if email isn't configured
    if (!isEmailEnabled()) {
      return NextResponse.json(
        { error: "No email provider configured. Add BLASTABLE_API_KEY or RESEND_API_KEY in your Vercel Environment Variables, then redeploy." },
        { status: 503 }
      )
    }

    // Pre-flight check: fail fast if app URL isn't configured
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    if (baseUrl === "http://localhost:3000" || baseUrl.includes("your-") || baseUrl.includes("example")) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_APP_URL is not set. Add it in Vercel Environment Variables (e.g. https://collegeofmas.org.in) and redeploy." },
        { status: 503 }
      )
    }

    const supabase = await createAdminClient()

    // Get event details
    const { data: event } = await (supabase as any)
      .from("events")
      .select("id, name, start_date, end_date, venue_name")
      .eq("id", event_id)
      .single()

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Get registrations with speaker details
    const { data: registrations } = await (supabase as any)
      .from("registrations")
      .select("*")
      .in("id", registration_ids)
      .eq("event_id", event_id)

    if (!registrations || registrations.length === 0) {
      return NextResponse.json({ error: "No registrations found" }, { status: 404 })
    }

    // Get all sessions for this event to match with speakers
    const { data: sessions } = await (supabase as any)
      .from("sessions")
      .select("id, session_name, session_date, start_time, end_time, hall, description, speakers_text, chairpersons_text, moderators_text, speakers, chairpersons, moderators")
      .eq("event_id", event_id)
      .order("session_date")
      .order("start_time")

    // Get faculty assignments for reliable matching
    const { data: allAssignments } = await (supabase as any)
      .from("faculty_assignments")
      .select("session_id, faculty_email, faculty_name")
      .eq("event_id", event_id)

    // Build assignment lookup by email
    const assignmentsByEmail = new Map<string, Set<string>>()
    ;(allAssignments || []).forEach((a: any) => {
      if (a.faculty_email) {
        const email = a.faculty_email.toLowerCase()
        if (!assignmentsByEmail.has(email)) assignmentsByEmail.set(email, new Set())
        assignmentsByEmail.get(email)!.add(a.session_id)
      }
    })

    // Strip title for name matching
    const stripTitle = (name: string) =>
      name.replace(/^(dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?|shri\.?)\s+/i, "").trim()

    const results = {
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
      sent_ids: [] as string[],
    }

    for (const reg of registrations) {
      let portalToken = reg.custom_fields?.portal_token

      // Auto-generate portal token if missing
      if (!portalToken) {
        portalToken = crypto.randomUUID()
        const updatedFields = { ...(reg.custom_fields || {}), portal_token: portalToken }
        await (supabase as any)
          .from("registrations")
          .update({ custom_fields: updatedFields })
          .eq("id", reg.id)
        reg.custom_fields = updatedFields
      }

      // Skip speakers without email
      if (!reg.attendee_email) {
        results.skipped++
        results.errors.push(`${reg.attendee_name || reg.id}: No email address`)
        continue
      }

      // Skip placeholder emails
      if (reg.attendee_email.includes("@placeholder.")) {
        results.skipped++
        results.errors.push(`${reg.attendee_name}: Placeholder email (${reg.attendee_email}) - update with real email first`)
        continue
      }

      const speakerEmail = reg.attendee_email?.toLowerCase()
      const speakerName = reg.attendee_name?.trim()
      const speakerNameStripped = speakerName ? stripTitle(speakerName).toLowerCase() : ""

      // Get assigned session IDs from faculty_assignments
      const assignedSessionIds = assignmentsByEmail.get(speakerEmail) || new Set()

      // Find sessions for this speaker using multiple strategies
      const speakerSessions = (sessions || []).filter((s: any) => {
        // Strategy 1: faculty_assignments
        if (assignedSessionIds.has(s.id)) return true

        // Strategy 2: Email in speakers_text/chairpersons_text/moderators_text
        const textFields = [s.speakers_text, s.chairpersons_text, s.moderators_text]
        for (const text of textFields) {
          if (text && speakerEmail && text.toLowerCase().includes(speakerEmail)) return true
        }

        // Strategy 3: Email in description
        if (s.description && speakerEmail && s.description.toLowerCase().includes(speakerEmail)) return true

        // Strategy 4: Name matching (title-stripped)
        if (speakerNameStripped) {
          const nameFields = [s.description, s.speakers, s.chairpersons, s.moderators]
          for (const field of nameFields) {
            if (field) {
              const fieldLower = field.toLowerCase()
              if (fieldLower.includes(speakerNameStripped)) return true
              if (speakerName && fieldLower.includes(speakerName.toLowerCase())) return true
            }
          }
        }

        return false
      })

      // Rate limit delay (Resend allows 2 req/sec)
      if (results.sent > 0 || results.failed > 0) {
        await new Promise(resolve => setTimeout(resolve, 600))
      }

      // Send invitation directly (no self-fetch)
      const result = await sendSpeakerInvitation({
        registration_id: reg.id,
        speaker_name: reg.attendee_name,
        speaker_email: reg.attendee_email,
        event_id: event.id,
        event_name: event.name,
        event_start_date: event.start_date,
        event_end_date: event.end_date,
        event_venue: event.venue_name,
        portal_token: portalToken,
        sessions: speakerSessions.map((s: any) => ({
          session_name: s.session_name,
          session_date: s.session_date,
          start_time: s.start_time,
          end_time: s.end_time,
          hall: s.hall,
        })),
      })

      if (result.success) {
        results.sent++
        results.sent_ids.push(reg.id)
      } else {
        results.failed++
        results.errors.push(`${reg.attendee_email}: ${result.error}`)
      }
    }

    // Include diagnostic details in response so frontend can show exactly what's wrong
    const provider = getEmailProvider() || "none"
    let effectiveFrom = "unknown"
    if (provider === "blastable") {
      effectiveFrom = process.env.BLASTABLE_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || "NOT SET"
    } else if (provider === "resend") {
      effectiveFrom = process.env.RESEND_FROM_EMAIL || "AMASI Events <noreply@resend.dev>"
    }

    return NextResponse.json({
      success: true,
      results: {
        ...results,
        provider,
        from_email: effectiveFrom,
      },
    })
  } catch (error: any) {
    console.error("Error in bulk speaker invitation:", error)
    return NextResponse.json(
      { error: `Failed to send bulk invitations: ${error.message || "Unknown error"}` },
      { status: 500 }
    )
  }
}
