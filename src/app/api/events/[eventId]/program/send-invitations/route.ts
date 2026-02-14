import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { sendEmail, isEmailEnabled } from "@/lib/email"

type FacultyAssignment = {
  id: string
  event_id: string
  session_id: string | null
  faculty_name: string
  faculty_email: string | null
  faculty_phone: string | null
  role: string
  status: string
  session_name: string | null
  session_date: string
  start_time: string | null
  end_time: string | null
  hall: string | null
  topic_title: string | null
  invitation_token: string | null
}

type EventRow = {
  id: string
  name: string
  short_name: string | null
}

// Format date for email
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

// Format time
function formatTime(time: string | null): string {
  if (!time) return ""
  return time.substring(0, 5)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const body = await request.json()
    const { assignmentIds, emailSubject, emailBody } = body

    if (!assignmentIds || assignmentIds.length === 0) {
      return NextResponse.json({ error: "No assignments provided" }, { status: 400 })
    }

    if (!isEmailEnabled()) {
      return NextResponse.json(
        { error: "No email provider configured. Add RESEND_API_KEY or BLASTABLE_API_KEY in Vercel Environment Variables and redeploy." },
        { status: 500 }
      )
    }

    // Fetch event details
    const { data: eventData } = await db
      .from("events")
      .select("id, name, short_name")
      .eq("id", eventId)
      .single()

    if (!eventData) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const event = eventData as EventRow

    // Fetch assignments
    const { data: assignmentsData, error: assignmentsError } = await db
      .from("faculty_assignments")
      .select("*")
      .in("id", assignmentIds)
      .eq("event_id", eventId)

    if (assignmentsError || !assignmentsData) {
      return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 })
    }

    const assignments = assignmentsData as FacultyAssignment[]

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    let sent = 0
    let failed = 0
    const errors: string[] = []

    for (const assignment of assignments) {
      if (!assignment.faculty_email) {
        failed++
        errors.push(`No email for ${assignment.faculty_name}`)
        continue
      }

      // Prepare email content with substitutions
      const replacements: Record<string, string> = {
        "{{faculty_name}}": assignment.faculty_name,
        "{{event_name}}": event.name,
        "{{role}}": assignment.role.charAt(0).toUpperCase() + assignment.role.slice(1),
        "{{session_name}}": assignment.session_name || "",
        "{{session_date}}": formatDate(assignment.session_date),
        "{{start_time}}": formatTime(assignment.start_time),
        "{{end_time}}": formatTime(assignment.end_time),
        "{{hall}}": assignment.hall || "",
        "{{confirmation_link}}": `${baseUrl}/respond/${assignment.invitation_token}`,
      }

      let subject = emailSubject
      let emailBodyText = emailBody

      Object.entries(replacements).forEach(([key, value]) => {
        subject = subject.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value)
        emailBodyText = emailBodyText.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value)
      })

      try {
        const htmlBody = emailBodyText.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

        const result = await sendEmail({
          to: assignment.faculty_email,
          subject,
          html: htmlBody,
          text: emailBodyText,
        })

        if (result.success) {
          // Update assignment status
          await db
            .from("faculty_assignments")
            .update({
              status: 'invited',
              invitation_sent_at: new Date().toISOString(),
            })
            .eq("id", assignment.id)

          // Log email
          await db
            .from("assignment_emails")
            .insert({
              assignment_id: assignment.id,
              event_id: eventId,
              email_type: 'invitation',
              recipient_email: assignment.faculty_email,
              recipient_name: assignment.faculty_name,
              subject,
              body_preview: emailBodyText.substring(0, 200),
              status: 'sent',
              sent_at: new Date().toISOString(),
            })

          sent++
        } else {
          failed++
          errors.push(`${assignment.faculty_email}: ${result.error}`)
        }
      } catch (emailError: any) {
        failed++
        errors.push(`${assignment.faculty_email}: ${emailError.message || "Send failed"}`)
      }
    }

    return NextResponse.json({
      success: sent > 0,
      sent,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    })

  } catch (error) {
    console.error("Error sending invitations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
