import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// GET /api/events/[eventId]/delegate-portal/feedback?formId=xxx
// Returns all confirmed registrations with their submission status for a given feedback form
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { searchParams } = new URL(request.url)
  const formId = searchParams.get("formId")

  if (!formId) {
    return NextResponse.json({ error: "formId is required" }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // Get all confirmed registrations for this event
  const { data: registrations, error: regError } = await (supabase as any)
    .from("registrations")
    .select("id, registration_number, attendee_name, attendee_email")
    .eq("event_id", eventId)
    .eq("status", "confirmed")
    .order("attendee_name")

  if (regError) {
    return NextResponse.json({ error: "Failed to fetch registrations" }, { status: 500 })
  }

  // Get all submissions for this form, keyed by submitter_email
  const { data: submissions, error: subError } = await (supabase as any)
    .from("form_submissions")
    .select("submitter_email, submitted_at")
    .eq("form_id", formId)

  if (subError) {
    return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 })
  }

  // Build a map of email -> submission
  const submissionMap = new Map<string, string>()
  for (const sub of submissions || []) {
    if (sub.submitter_email) {
      submissionMap.set(sub.submitter_email.toLowerCase(), sub.submitted_at)
    }
  }

  // Merge: for each registration, check if they have a submission
  const attendees = (registrations || []).map((reg: any) => {
    const email = (reg.attendee_email || "").toLowerCase()
    const submittedAt = submissionMap.get(email) || null
    return {
      registration_id: reg.id,
      registration_number: reg.registration_number,
      attendee_name: reg.attendee_name,
      attendee_email: reg.attendee_email,
      submitted: !!submittedAt,
      submitted_at: submittedAt,
    }
  })

  return NextResponse.json({ attendees })
}
