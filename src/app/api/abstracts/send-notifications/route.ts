import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { NextRequest, NextResponse } from "next/server"
import { sendEmail } from "@/lib/email"

interface NotificationTemplate {
  subject: string
  body: string
}

// Notification templates
const templates: Record<string, (data: Record<string, unknown>) => NotificationTemplate> = {
  submission_confirmation: (data) => ({
    subject: `Abstract Submitted: ${data.abstract_number}`,
    body: `Dear ${data.presenter_name},

Thank you for submitting your abstract to ${data.event_name}.

Abstract Details:
- Abstract Number: ${data.abstract_number}
- Title: ${data.title}
- Category: ${data.category}
- Presentation Type: ${data.presentation_type}

Your abstract is now under review. You will be notified once a decision is made.

Best regards,
${data.event_name} Scientific Committee`,
  }),

  under_review: (data) => ({
    subject: `Abstract Under Review: ${data.abstract_number}`,
    body: `Dear ${data.presenter_name},

Your abstract "${data.title}" (${data.abstract_number}) is now under peer review.

You will be notified once the review is complete and a decision is made.

Best regards,
${data.event_name} Scientific Committee`,
  }),

  accepted: (data) => ({
    subject: `Congratulations! Abstract Accepted: ${data.abstract_number}`,
    body: `Dear ${data.presenter_name},

We are pleased to inform you that your abstract has been ACCEPTED for presentation at ${data.event_name}.

Abstract Details:
- Abstract Number: ${data.abstract_number}
- Title: ${data.title}
- Presentation Format: ${data.accepted_as?.toUpperCase()}

${data.registration_verified ? '' : `
IMPORTANT: Please ensure you complete your registration for the conference to confirm your presentation slot.
Registration Link: ${data.registration_url}
`}

Next Steps:
1. ${data.registration_verified ? '✓ Registration confirmed' : 'Complete your registration'}
2. Wait for your presentation schedule
3. Upload your presentation slides before the deadline

We look forward to your presentation.

Best regards,
${data.event_name} Scientific Committee`,
  }),

  rejected: (data) => ({
    subject: `Abstract Decision: ${data.abstract_number}`,
    body: `Dear ${data.presenter_name},

Thank you for submitting your abstract to ${data.event_name}.

After careful review by our scientific committee, we regret to inform you that your abstract "${data.title}" (${data.abstract_number}) was not selected for presentation at this conference.

${data.feedback ? `Reviewer Feedback:\n${data.feedback}\n` : ''}

We encourage you to consider submitting to future conferences and thank you for your interest in ${data.event_name}.

Best regards,
${data.event_name} Scientific Committee`,
  }),

  schedule_assigned: (data) => ({
    subject: `Presentation Schedule: ${data.abstract_number}`,
    body: `Dear ${data.presenter_name},

Your presentation has been scheduled at ${data.event_name}.

Presentation Details:
- Abstract: ${data.title} (${data.abstract_number})
- Format: ${data.presentation_type?.toUpperCase()}
- Date: ${data.presentation_date}
- Time: ${data.start_time} - ${data.end_time}
- Location: ${data.hall_name}${data.room_number ? `, ${data.room_number}` : ''}

${data.presentation_type === 'poster' ? `
Poster Board: ${data.poster_board_number}
Please set up your poster at least 30 minutes before your session.
` : `
Please arrive at the presentation hall 15 minutes before your scheduled time.
`}

Presentation Guidelines:
- Maximum duration: ${data.duration_minutes} minutes
- Upload your ${data.presentation_type === 'poster' ? 'poster' : 'slides'} before: ${data.upload_deadline}

Best regards,
${data.event_name} Scientific Committee`,
  }),

  upload_reminder: (data) => ({
    subject: `Reminder: Upload Your Presentation - ${data.abstract_number}`,
    body: `Dear ${data.presenter_name},

This is a reminder to upload your presentation for ${data.event_name}.

Abstract: ${data.title} (${data.abstract_number})
Upload Deadline: ${data.upload_deadline}

${data.upload_url ? `Upload Link: ${data.upload_url}` : ''}

If you have already uploaded your presentation, please ignore this reminder.

Best regards,
${data.event_name} Scientific Committee`,
  }),

  registration_reminder: (data) => ({
    subject: `Action Required: Complete Registration for Your Accepted Abstract`,
    body: `Dear ${data.presenter_name},

Congratulations on having your abstract accepted for ${data.event_name}!

However, we notice that you have not yet completed your conference registration. To confirm your presentation slot, please register at your earliest convenience.

Abstract: ${data.title} (${data.abstract_number})
Presentation Format: ${data.accepted_as?.toUpperCase()}

Registration Link: ${data.registration_url}

Please complete your registration by ${data.registration_deadline} to secure your presentation slot.

Best regards,
${data.event_name} Scientific Committee`,
  }),

  day_before_reminder: (data) => ({
    subject: `Tomorrow: Your Presentation at ${data.event_name}`,
    body: `Dear ${data.presenter_name},

This is a reminder that your presentation is scheduled for tomorrow.

Presentation Details:
- Abstract: ${data.title}
- Date: ${data.presentation_date}
- Time: ${data.start_time}
- Location: ${data.hall_name}${data.room_number ? `, ${data.room_number}` : ''}

Please ensure:
✓ You have uploaded your presentation
✓ You arrive at the venue on time
✓ You report to the session chair before your presentation

We look forward to your presentation!

Best regards,
${data.event_name} Scientific Committee`,
  }),
}

// POST /api/abstracts/send-notifications - Send notifications to presenters
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAdmin()
    if (!user || authError) {
      return authError || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const body = await request.json()

    const {
      event_id,
      notification_type,
      abstract_ids,
      custom_subject,
      custom_body,
      test_mode = false,
    } = body

    if (!event_id || !notification_type) {
      return NextResponse.json(
        { error: "event_id and notification_type are required" },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    // Get event details
    const { data: event } = await (supabase as any)
      .from("events")
      .select("id, name, website_url, contact_email")
      .eq("id", event_id)
      .single()

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Get abstracts to notify
    let query = (supabase as any)
      .from("abstracts")
      .select(`
        id,
        abstract_number,
        title,
        presenting_author_name,
        presenting_author_email,
        status,
        accepted_as,
        category_id,
        presentation_type,
        registration_verified,
        session_date,
        session_time,
        session_location,
        category:abstract_categories(name)
      `)
      .eq("event_id", event_id)

    if (abstract_ids && abstract_ids.length > 0) {
      query = query.in("id", abstract_ids)
    }

    // Filter based on notification type
    if (notification_type === 'accepted') {
      query = query.eq("status", "accepted")
    } else if (notification_type === 'rejected') {
      query = query.eq("status", "rejected")
    } else if (notification_type === 'registration_reminder') {
      query = query.eq("status", "accepted").eq("registration_verified", false)
    } else if (notification_type === 'schedule_assigned') {
      query = query.eq("status", "accepted").not("session_date", "is", null)
    }

    const { data: abstracts, error: fetchError } = await query

    if (fetchError) {
      console.error("Error fetching abstracts:", fetchError)
      return NextResponse.json({ error: "Failed to fetch abstracts" }, { status: 500 })
    }

    if (!abstracts || abstracts.length === 0) {
      return NextResponse.json({ message: "No abstracts found to notify" })
    }

    const results = {
      sent: [] as string[],
      failed: [] as { id: string; error: string }[],
      skipped: [] as string[],
    }

    // Process each abstract
    for (const abstract of abstracts) {
      try {
        // Get template function
        const templateFn = templates[notification_type]
        if (!templateFn && !custom_subject) {
          results.skipped.push(abstract.id)
          continue
        }

        // Prepare template data
        const templateData: Record<string, unknown> = {
          event_name: event.name,
          abstract_number: abstract.abstract_number,
          title: abstract.title,
          presenter_name: abstract.presenting_author_name,
          category: (abstract.category as { name: string } | null)?.name || 'General',
          presentation_type: abstract.presentation_type,
          accepted_as: abstract.accepted_as,
          registration_verified: abstract.registration_verified,
          registration_url: `${event.website_url || ''}/register/${event_id}`,
          presentation_date: abstract.session_date,
          start_time: abstract.session_time,
          hall_name: abstract.session_location,
        }

        // Generate email content
        const template = templateFn ? templateFn(templateData) : {
          subject: custom_subject,
          body: custom_body,
        }

        if (test_mode) {
          // In test mode, just log what would be sent
          results.sent.push(abstract.id)
          continue
        }

        // Send email
        await sendEmail({
          to: abstract.presenting_author_email,
          subject: custom_subject || template.subject,
          text: custom_body || template.body,
          replyTo: event.contact_email,
        })

        // Log notification
        await (supabase as any)
          .from("abstract_notifications")
          .insert({
            abstract_id: abstract.id,
            notification_type,
            recipient_email: abstract.presenting_author_email,
            recipient_name: abstract.presenting_author_name,
            subject: template.subject,
            body_preview: template.body.substring(0, 500),
            sent_by: user.id,
            delivery_status: 'sent',
          })

        results.sent.push(abstract.id)
      } catch (err) {
        console.error(`Error sending to ${abstract.id}:`, err)
        results.failed.push({
          id: abstract.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      total: abstracts.length,
      sent: results.sent.length,
      failed: results.failed.length,
      skipped: results.skipped.length,
      results,
      test_mode,
    })
  } catch (error) {
    console.error("Error in send notifications:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/abstracts/send-notifications - Get notification templates
export async function GET() {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) {
      return authError
    }
    return NextResponse.json({
      templates: Object.keys(templates).map(key => ({
        type: key,
        name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: getTemplateDescription(key),
      })),
    })
  } catch (error) {
    console.error("Error fetching templates:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function getTemplateDescription(type: string): string {
  const descriptions: Record<string, string> = {
    submission_confirmation: 'Sent when abstract is submitted',
    under_review: 'Sent when review process begins',
    accepted: 'Sent when abstract is accepted',
    rejected: 'Sent when abstract is rejected',
    schedule_assigned: 'Sent when presentation schedule is assigned',
    upload_reminder: 'Reminder to upload presentation',
    registration_reminder: 'Reminder to complete registration',
    day_before_reminder: 'Reminder sent day before presentation',
  }
  return descriptions[type] || ''
}
