import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { sendEmail, isEmailEnabled } from "@/lib/email"

// POST /api/abstracts/presentation-reminder - Send presentation upload reminder
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { abstract_id } = body

    if (!abstract_id) {
      return NextResponse.json({ error: "abstract_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Fetch abstract details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: abstract, error: abstractError } = await (supabase as any)
      .from("abstracts")
      .select(`
        id,
        abstract_number,
        title,
        presenting_author_name,
        presenting_author_email,
        status,
        presentation_url,
        event_id,
        events(name, short_name)
      `)
      .eq("id", abstract_id)
      .single()

    if (abstractError || !abstract) {
      return NextResponse.json({ error: "Abstract not found" }, { status: 404 })
    }

    const { error: authError } = await requireEventAndPermission(abstract.event_id, 'abstracts')
    if (authError) return authError

    // Check if abstract is accepted
    if (abstract.status !== "accepted") {
      return NextResponse.json({ error: "Only accepted abstracts can receive presentation reminders" }, { status: 400 })
    }

    // Check if presentation is already uploaded
    if (abstract.presentation_url) {
      return NextResponse.json({ error: "Presentation already uploaded" }, { status: 400 })
    }

    const eventName = abstract.events?.short_name || abstract.events?.name || "the event"
    const uploadUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "https://collegeofmas.org.in"}/upload-presentation/${abstract.id}?email=${encodeURIComponent(abstract.presenting_author_email)}`

    // Send email reminder
    if (isEmailEnabled()) {
      await sendEmail({
        to: abstract.presenting_author_email,
        subject: `Upload Your Presentation - ${abstract.abstract_number} - ${eventName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Presentation Upload Required</h2>
            <p>Dear ${abstract.presenting_author_name},</p>
            <p>Your abstract has been accepted for <strong>${eventName}</strong>. Please upload your presentation file.</p>

            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Abstract Number:</strong> ${abstract.abstract_number}</p>
              <p style="margin: 8px 0 0;"><strong>Title:</strong> ${abstract.title}</p>
            </div>

            <p>
              <a href="${uploadUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Upload Presentation
              </a>
            </p>

            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              Accepted formats: PDF, PPT, PPTX, MP4, WEBM<br>
              Maximum file size: 100MB
            </p>

            <p>Thank you!</p>
          </div>
        `,
      })

      // Log the reminder
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("abstract_notifications")
        .insert({
          abstract_id: abstract.id,
          notification_type: "presentation_reminder",
          recipient_email: abstract.presenting_author_email,
          recipient_name: abstract.presenting_author_name,
          subject: `Upload Your Presentation - ${abstract.abstract_number}`,
          metadata: {
            abstract_number: abstract.abstract_number,
            title: abstract.title,
            event_name: eventName,
          },
        })

      return NextResponse.json({
        success: true,
        message: `Reminder sent to ${abstract.presenting_author_email}`,
      })
    } else {
      return NextResponse.json({ error: "Email service is not enabled" }, { status: 500 })
    }
  } catch (error) {
    console.error("Error sending presentation reminder:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
