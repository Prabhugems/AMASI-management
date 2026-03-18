import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail, isEmailEnabled } from "@/lib/email"
import { escapeHtml } from "@/lib/string-utils"
import { COMPANY_CONFIG } from "@/lib/config"

// POST /api/abstracts/podium-checkin - Scan badge to mark presenter as presented
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      scan_data, // Can be abstract_number, registration_number, or email
      hall_token, // Hall coordinator token for authorization
      hall_name,
      notes,
    } = body

    if (!scan_data) {
      return NextResponse.json({ error: "Scan data is required" }, { status: 400 })
    }

    // Validate scan_data length
    const trimmedScan = scan_data.trim()
    if (trimmedScan.length > 500) {
      return NextResponse.json({ error: "Invalid scan data" }, { status: 400 })
    }

    // Require hall_token for authorization
    if (!hall_token || hall_token.length < 20) {
      return NextResponse.json({ error: "Valid hall token is required" }, { status: 401 })
    }

    const supabase = await createAdminClient()

    // Verify hall coordinator token - REQUIRED
    const { data: coordinator } = await (supabase as any)
      .from("hall_coordinators")
      .select("id, hall_name, coordinator_name, event_id")
      .eq("portal_token", hall_token)
      .single()

    if (!coordinator) {
      return NextResponse.json({ error: "Invalid or expired hall token" }, { status: 401 })
    }

    const coordinatorInfo = coordinator

    // Try to find the abstract by various identifiers
    let abstract = null
    const searchValue = scan_data.trim()

    // 1. Try by abstract_number
    const { data: byNumber } = await (supabase as any)
      .from("abstracts")
      .select(`
        id, abstract_number, title, status, accepted_as,
        presenting_author_name, presenting_author_email,
        presenting_author_affiliation, event_id,
        session_date, session_time, session_location,
        presenter_checked_in, presentation_completed,
        presentation_completed_at,
        events(name, short_name)
      `)
      .eq("abstract_number", searchValue)
      .maybeSingle()

    if (byNumber) {
      abstract = byNumber
    }

    // 2. Try by registration number (via badge)
    if (!abstract) {
      const { data: registration } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_email, event_id")
        .eq("registration_number", searchValue)
        .maybeSingle()

      if (registration) {
        const { data: byEmail } = await (supabase as any)
          .from("abstracts")
          .select(`
            id, abstract_number, title, status, accepted_as,
            presenting_author_name, presenting_author_email,
            presenting_author_affiliation, event_id,
            session_date, session_time, session_location,
            presenter_checked_in, presentation_completed,
            presentation_completed_at,
            events(name, short_name)
          `)
          .eq("event_id", registration.event_id)
          .ilike("presenting_author_email", registration.attendee_email)
          .eq("status", "accepted")
          .maybeSingle()

        if (byEmail) {
          abstract = byEmail
        }
      }
    }

    // 3. Try by email directly
    if (!abstract) {
      const { data: byEmail } = await (supabase as any)
        .from("abstracts")
        .select(`
          id, abstract_number, title, status, accepted_as,
          presenting_author_name, presenting_author_email,
          presenting_author_affiliation, event_id,
          session_date, session_time, session_location,
          presenter_checked_in, presentation_completed,
          presentation_completed_at,
          events(name, short_name)
        `)
        .ilike("presenting_author_email", searchValue)
        .eq("status", "accepted")
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (byEmail) {
        abstract = byEmail
      }
    }

    if (!abstract) {
      return NextResponse.json({
        error: "Presenter not found",
        message: "No accepted abstract found for this badge/scan",
      }, { status: 404 })
    }

    if (abstract.status !== "accepted") {
      return NextResponse.json({
        error: "Abstract not accepted",
        message: `This abstract status is: ${abstract.status}`,
        abstract: {
          number: abstract.abstract_number,
          title: abstract.title,
          status: abstract.status,
        },
      }, { status: 400 })
    }

    // Check if already presented
    if (abstract.presentation_completed) {
      return NextResponse.json({
        already_presented: true,
        message: `${abstract.presenting_author_name} already presented`,
        abstract: {
          number: abstract.abstract_number,
          title: abstract.title,
          presenter: abstract.presenting_author_name,
          presented_at: abstract.presentation_completed_at,
        },
      })
    }

    // Mark as presented
    const presentedAt = new Date().toISOString()
    const { error: updateError } = await (supabase as any)
      .from("abstracts")
      .update({
        presentation_completed: true,
        presentation_completed_at: presentedAt,
        presenter_checked_in: true,
        presenter_checked_in_at: abstract.presenter_checked_in ? undefined : presentedAt,
        podium_checkin_hall: hall_name || coordinatorInfo?.hall_name,
        podium_checkin_by: coordinatorInfo?.coordinator_name,
        podium_checkin_notes: notes,
      })
      .eq("id", abstract.id)

    if (updateError) {
      console.error("Error updating abstract:", updateError)
      return NextResponse.json({ error: "Failed to record presentation" }, { status: 500 })
    }

    // Record in checkins table
    await (supabase as any)
      .from("abstract_presenter_checkins")
      .insert({
        abstract_id: abstract.id,
        event_id: abstract.event_id,
        presenter_email: abstract.presenting_author_email,
        presenter_name: abstract.presenting_author_name,
        check_in_location: hall_name || coordinatorInfo?.hall_name || "Podium",
        presentation_started_at: presentedAt,
        presentation_ended_at: presentedAt,
        notes: notes || "Podium check-in via QR scan",
      })

    // Send presenter certificate email
    let emailSent = false
    if (abstract.presenting_author_email && isEmailEnabled()) {
      try {
        const eventName = abstract.events?.short_name || abstract.events?.name || "Conference"
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collegeofmas.org.in"
        const verifyUrl = `${baseUrl}/verify/abstract/${abstract.abstract_number}`
        const portalUrl = `${baseUrl}/my`

        const presentationType = abstract.accepted_as === "oral" ? "Oral Presentation" :
          abstract.accepted_as === "poster" ? "Poster Presentation" :
          abstract.accepted_as === "video" ? "Video Presentation" :
          abstract.accepted_as === "eposter" ? "E-Poster Presentation" :
          abstract.accepted_as || "Presentation"

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
                        <div style="font-size: 48px; margin-bottom: 15px;">🎤</div>
                        <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">Presentation Completed!</h1>
                        <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 16px;">Your certificate is ready</p>
                      </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                      <td style="background-color: white; padding: 30px;">
                        <p style="color: #1f2937; font-size: 16px; margin: 0 0 15px 0;">
                          Dear <strong>${escapeHtml(abstract.presenting_author_name || "")}</strong>,
                        </p>
                        <p style="color: #4b5563; font-size: 15px; margin: 0 0 20px 0; line-height: 1.6;">
                          Congratulations on completing your ${presentationType.toLowerCase()} at <strong>${escapeHtml(eventName)}</strong>!
                          Your presenter certificate is now available for download.
                        </p>
                        <!-- Details Box -->
                        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
                          <table role="presentation" style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="padding: 8px 0; color: #065f46; width: 35%;">Abstract #:</td>
                              <td style="padding: 8px 0; color: #1f2937; font-weight: bold;">${escapeHtml(abstract.abstract_number || "")}</td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; color: #065f46;">Paper Title:</td>
                              <td style="padding: 8px 0; color: #1f2937;">${escapeHtml(abstract.title || "")}</td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; color: #065f46;">Type:</td>
                              <td style="padding: 8px 0; color: #1f2937;">${escapeHtml(presentationType)}</td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; color: #065f46;">Presented at:</td>
                              <td style="padding: 8px 0; color: #1f2937;">${new Date(presentedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                            </tr>
                          </table>
                        </div>
                        <!-- CTA Button -->
                        <table role="presentation" style="width: 100%; margin: 30px 0;">
                          <tr>
                            <td align="center">
                              <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                                Download Certificate
                              </a>
                            </td>
                          </tr>
                        </table>
                        <p style="color: #6b7280; font-size: 13px; margin: 20px 0 0 0; text-align: center; line-height: 1.6;">
                          Visit the Author Portal and enter your email<br>
                          <strong>${escapeHtml(abstract.presenting_author_email || "")}</strong> to download your certificate.
                        </p>
                        <p style="color: #9ca3af; font-size: 12px; margin: 20px 0 0 0; text-align: center;">
                          <a href="${verifyUrl}" style="color: #6b7280;">Verify this certificate</a>
                        </p>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #1f2937; padding: 25px 30px; border-radius: 0 0 16px 16px; text-align: center;">
                        <p style="color: #9ca3af; margin: 0 0 10px 0; font-size: 14px;">
                          Thank you for presenting at ${escapeHtml(eventName)}!
                        </p>
                        <p style="color: #6b7280; margin: 0; font-size: 12px;">
                          &copy; ${new Date().getFullYear()} ${COMPANY_CONFIG.name}. All rights reserved.
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

        const result = await sendEmail({
          to: abstract.presenting_author_email,
          subject: `Your Presenter Certificate - ${eventName}`,
          html: emailHtml,
        })

        emailSent = result.success
        if (result.success) {
          console.log(`Presenter certificate email sent to ${abstract.presenting_author_email}`)
        }
      } catch (emailError) {
        console.error("Failed to send presenter certificate email:", emailError)
      }
    }

    return NextResponse.json({
      success: true,
      message: `${abstract.presenting_author_name} marked as presented${emailSent ? " - Certificate emailed" : ""}`,
      email_sent: emailSent,
      abstract: {
        id: abstract.id,
        number: abstract.abstract_number,
        title: abstract.title,
        presenter: abstract.presenting_author_name,
        affiliation: abstract.presenting_author_affiliation,
        presentation_type: abstract.accepted_as,
        presented_at: presentedAt,
        event: abstract.events?.name || abstract.events?.short_name,
      },
    })
  } catch (error) {
    console.error("Error in podium check-in:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/abstracts/podium-checkin?event_id=...&hall=...&token=... - Get presenters for a hall/session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")
    const sessionDate = searchParams.get("date") || new Date().toISOString().split("T")[0]
    const hall = searchParams.get("hall")
    const hallToken = searchParams.get("token")

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    // Require hall token for authorization
    if (!hallToken || hallToken.length < 20) {
      return NextResponse.json({ error: "Valid hall token is required" }, { status: 401 })
    }

    const supabase = await createAdminClient()

    // Verify hall coordinator token
    const { data: coordinator } = await (supabase as any)
      .from("hall_coordinators")
      .select("id, hall_name, event_id")
      .eq("portal_token", hallToken)
      .single()

    if (!coordinator) {
      return NextResponse.json({ error: "Invalid or expired hall token" }, { status: 401 })
    }

    // Verify coordinator has access to this event
    if (coordinator.event_id !== eventId) {
      return NextResponse.json({ error: "Access denied for this event" }, { status: 403 })
    }

    // Get today's scheduled presenters
    let query = (supabase as any)
      .from("abstracts")
      .select(`
        id,
        abstract_number,
        title,
        presenting_author_name,
        presenting_author_email,
        presenting_author_affiliation,
        accepted_as,
        session_date,
        session_time,
        session_location,
        presenter_checked_in,
        presentation_completed,
        presentation_completed_at
      `)
      .eq("event_id", eventId)
      .eq("status", "accepted")
      .order("session_time", { ascending: true })

    if (sessionDate) {
      query = query.eq("session_date", sessionDate)
    }

    if (hall) {
      query = query.ilike("session_location", `%${hall}%`)
    }

    const { data: abstracts, error } = await query

    if (error) {
      console.error("Error fetching abstracts:", error)
      return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
    }

    // Stats
    const total = abstracts?.length || 0
    const presented = abstracts?.filter((a: any) => a.presentation_completed).length || 0
    const pending = total - presented

    return NextResponse.json({
      abstracts: abstracts || [],
      stats: {
        total,
        presented,
        pending,
      },
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
