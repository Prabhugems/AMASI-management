import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { sendEmail } from "@/lib/email"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string; id: string }> }
) {
  try {
    const { user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId, id } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Get visa request
    const { data: visaRequest, error: fetchError } = await db
      .from("visa_requests")
      .select("*")
      .eq("id", id)
      .eq("event_id", eventId)
      .single()

    if (fetchError || !visaRequest) {
      return NextResponse.json({ error: "Visa request not found" }, { status: 404 })
    }

    if (!visaRequest.applicant_email) {
      return NextResponse.json({ error: "No email address for this applicant" }, { status: 400 })
    }

    // Get event details
    const { data: event } = await db
      .from("events")
      .select("name, short_name")
      .eq("id", eventId)
      .single()

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Generate letter if not already generated
    if (visaRequest.letter_status === "pending") {
      // First generate the letter
      const genRes = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/events/${eventId}/visa/${id}/generate-letter`,
        { method: "POST" }
      )
      if (!genRes.ok) {
        return NextResponse.json({ error: "Failed to generate letter first" }, { status: 500 })
      }
    }

    // Send email with invitation letter info
    const emailResult = await sendEmail({
      to: visaRequest.applicant_email,
      subject: `Visa Invitation Letter - ${event.name}`,
      html: `
        <p>Dear ${visaRequest.applicant_name},</p>
        <p>Please find attached your visa invitation letter for <strong>${event.name}</strong>.</p>
        <p>If you have any questions, please contact the organizing committee.</p>
        <br/>
        <p>Best regards,<br/>Organizing Committee<br/>${event.name}</p>
      `,
    })

    if (!emailResult.success) {
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
    }

    // Update status
    await db
      .from("visa_requests")
      .update({
        letter_status: "sent",
        letter_sent_at: new Date().toISOString(),
        processed_by: user?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    return NextResponse.json({
      success: true,
      message: `Invitation letter sent to ${visaRequest.applicant_email}`,
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
