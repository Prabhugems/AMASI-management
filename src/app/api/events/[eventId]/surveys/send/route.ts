import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { sendEmail } from "@/lib/email"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { user: _user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId } = await params
    const body = await request.json()
    const { form_id } = body

    if (!form_id) {
      return NextResponse.json({ error: "form_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Get the survey form
    const { data: form } = await db
      .from("forms")
      .select("id, title, slug")
      .eq("id", form_id)
      .single()

    if (!form) {
      return NextResponse.json({ error: "Survey form not found" }, { status: 404 })
    }

    // Get event details
    const { data: event } = await db
      .from("events")
      .select("name")
      .eq("id", eventId)
      .single()

    // Get confirmed attendees
    const { data: registrations } = await db
      .from("registrations")
      .select("attendee_name, attendee_email")
      .eq("event_id", eventId)
      .eq("status", "confirmed")

    if (!registrations || registrations.length === 0) {
      return NextResponse.json({ error: "No confirmed attendees found" }, { status: 400 })
    }

    // Get already submitted emails
    const { data: submissions } = await db
      .from("form_submissions")
      .select("respondent_email")
      .eq("form_id", form_id)

    const submittedEmails = new Set(
      (submissions || []).map((s: { respondent_email: string }) => s.respondent_email?.toLowerCase())
    )

    // Filter out attendees who already responded
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toSend = (registrations as any[]).filter(
      (r) => r.attendee_email && !submittedEmails.has(r.attendee_email.toLowerCase())
    )

    if (toSend.length === 0) {
      return NextResponse.json({ message: "All attendees have already responded", sent: 0 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
    const formUrl = `${appUrl}/forms/${form.slug || form.id}`
    let sentCount = 0
    const errors: string[] = []

    // Send emails (batch)
    for (const attendee of toSend) {
      try {
        await sendEmail({
          to: attendee.attendee_email!,
          subject: `Survey: ${form.title} - ${event?.name || ""}`,
          html: `
            <p>Dear ${attendee.attendee_name},</p>
            <p>We would love to hear your feedback! Please take a moment to fill out our survey:</p>
            <p><strong>${form.title}</strong></p>
            <p><a href="${formUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Fill Survey</a></p>
            <p>Thank you for your participation!</p>
            <br/>
            <p>Best regards,<br/>${event?.name || "Event Team"}</p>
          `,
        })
        sentCount++
      } catch (e) {
        errors.push(attendee.attendee_email!)
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      failed: errors.length,
      total: toSend.length,
      message: `Survey sent to ${sentCount} attendees${errors.length > 0 ? `, ${errors.length} failed` : ""}`,
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
