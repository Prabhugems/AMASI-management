import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email"
import { escapeHtml } from "@/lib/string-utils"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { registration_id, event_id } = await request.json()

    if (!registration_id || !event_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Get registration details
    const { data: registration, error: regError } = await (supabase as any)
      .from("registrations")
      .select(`
        id,
        registration_number,
        attendee_name,
        attendee_email,
        attendee_designation,
        attendee_institution,
        ticket_type:ticket_types(name)
      `)
      .eq("id", registration_id)
      .single()

    if (regError || !registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }

    // Get event details
    const { data: event } = await (supabase as any)
      .from("events")
      .select("name, short_name, start_date, end_date, venue_name, city")
      .eq("id", event_id)
      .single()

    const eventName = event?.short_name || event?.name || "Event"
    const eventDate = event?.start_date
      ? new Date(event.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
      : ""
    const venue = event?.venue_name ? `${event.venue_name}${event.city ? `, ${event.city}` : ""}` : ""

    // Generate badge download URL using registration number
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const badgeUrl = `${baseUrl}/api/badge/${registration.registration_number}/download`

    // Send email with badge
    const emailResult = await sendEmail({
      to: registration.attendee_email,
      subject: `Your Badge for ${eventName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">${escapeHtml(eventName || "")}</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0;">${eventDate}</p>
          </div>

          <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef;">
            <h2 style="color: #333; margin: 0 0 20px 0;">Hello ${escapeHtml(registration.attendee_name || "")}!</h2>
            <p style="color: #666; line-height: 1.6;">
              Your event badge is ready! You can download and print it before arriving at the event.
            </p>

            <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; width: 40%;">Name:</td>
                  <td style="padding: 8px 0; color: #333; font-weight: bold;">${escapeHtml(registration.attendee_name || "")}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Registration #:</td>
                  <td style="padding: 8px 0; color: #333; font-weight: bold;">${escapeHtml(registration.registration_number || "")}</td>
                </tr>
                ${registration.attendee_designation ? `
                <tr>
                  <td style="padding: 8px 0; color: #666;">Designation:</td>
                  <td style="padding: 8px 0; color: #333;">${escapeHtml(registration.attendee_designation || "")}</td>
                </tr>
                ` : ""}
                ${registration.attendee_institution ? `
                <tr>
                  <td style="padding: 8px 0; color: #666;">Institution:</td>
                  <td style="padding: 8px 0; color: #333;">${escapeHtml(registration.attendee_institution || "")}</td>
                </tr>
                ` : ""}
                ${registration.ticket_type?.name ? `
                <tr>
                  <td style="padding: 8px 0; color: #666;">Ticket Type:</td>
                  <td style="padding: 8px 0; color: #333;">${escapeHtml(registration.ticket_type.name || "")}</td>
                </tr>
                ` : ""}
              </table>
            </div>

            ${venue ? `
            <p style="color: #666; line-height: 1.6;">
              <strong>Venue:</strong> ${escapeHtml(venue || "")}
            </p>
            ` : ""}

            <div style="text-align: center; margin-top: 30px;">
              <a href="${badgeUrl}" style="display: inline-block; background: #1e3a5f; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Download Your Badge
              </a>
            </div>

            <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
              Print this badge and bring it to the event for faster check-in.
            </p>
          </div>

          <div style="background: #1e3a5f; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
            <p style="color: rgba(255,255,255,0.7); margin: 0; font-size: 12px;">
              This is an automated email from the event management system.
            </p>
          </div>
        </div>
      `,
    })

    if (!emailResult.success) {
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Badge sent to email",
      email: registration.attendee_email
    })
  } catch (error: any) {
    console.error("Error sending badge email:", error)
    return NextResponse.json({ error: "Failed to send badge" }, { status: 500 })
  }
}
