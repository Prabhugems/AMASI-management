import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { renderEmailTemplate, buildAbstractVariables, TemplateType } from "@/lib/email-templates"
import { sendEmail } from "@/lib/email"

const MAX_BULK_SIZE = 500

// POST /api/abstracts/bulk/notify - Send notifications to authors
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const body = await request.json()
    const { abstract_ids, send_email = true } = body

    if (!abstract_ids || !Array.isArray(abstract_ids) || abstract_ids.length === 0) {
      return NextResponse.json({ error: "No abstracts selected" }, { status: 400 })
    }

    if (abstract_ids.length > MAX_BULK_SIZE) {
      return NextResponse.json({ error: `Maximum ${MAX_BULK_SIZE} abstracts per request` }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Fetch abstracts with their details
    const { data: abstracts, error } = await (supabase as any)
      .from("abstracts")
      .select(`
        id,
        abstract_number,
        title,
        status,
        decision,
        decision_notes,
        accepted_as,
        presenting_author_name,
        presenting_author_email,
        event_id,
        session_date,
        session_time,
        session_location,
        category:abstract_categories(name),
        events(id, name, short_name, start_date, city)
      `)
      .in("id", abstract_ids)

    if (error || !abstracts) {
      return NextResponse.json({ error: "Failed to fetch abstracts" }, { status: 500 })
    }

    // Filter to only those with decisions
    const validStatuses = ["accepted", "rejected", "revision_requested"]
    const notifiableAbstracts = abstracts.filter((a: any) => validStatuses.includes(a.status))

    if (notifiableAbstracts.length === 0) {
      return NextResponse.json({
        error: "No abstracts with decisions to notify"
      }, { status: 400 })
    }

    let sentCount = 0
    let emailsSent = 0
    const notifications: any[] = []
    const errors: string[] = []

    // Process each abstract individually for personalized emails
    for (const abstract of notifiableAbstracts) {
      const email = abstract.presenting_author_email?.toLowerCase()
      if (!email) continue

      const eventName = abstract.events?.short_name || abstract.events?.name || "Event"

      // Determine template type based on status
      let templateType: TemplateType = "abstract_accepted"
      let fallbackSubject = `Abstract Decision - ${eventName}`

      if (abstract.status === "accepted") {
        templateType = "abstract_accepted"
        fallbackSubject = `Congratulations! Your Abstract has been Accepted - ${eventName}`
      } else if (abstract.status === "rejected") {
        templateType = "abstract_rejected"
        fallbackSubject = `Abstract Decision - ${eventName}`
      } else if (abstract.status === "revision_requested") {
        templateType = "abstract_revision"
        fallbackSubject = `Revision Requested for Your Abstract - ${eventName}`
      }

      // Build template variables
      const variables = buildAbstractVariables(
        {
          abstract_number: abstract.abstract_number,
          title: abstract.title,
          status: abstract.status,
          decision: abstract.decision,
          accepted_as: abstract.accepted_as,
          decision_notes: abstract.decision_notes,
          presenting_author_name: abstract.presenting_author_name,
          presenting_author_email: abstract.presenting_author_email,
          category_name: abstract.category?.name,
          session_date: abstract.session_date,
          session_time: abstract.session_time,
          session_location: abstract.session_location,
        },
        {
          name: abstract.events?.name || eventName,
          short_name: abstract.events?.short_name,
          start_date: abstract.events?.start_date,
          city: abstract.events?.city,
        },
        `${process.env.NEXT_PUBLIC_APP_URL || ""}/my`
      )

      // Try to get template
      const rendered = await renderEmailTemplate(templateType, variables, abstract.event_id)

      // Build email content
      let subject = fallbackSubject
      let htmlBody = buildFallbackEmail(abstract, eventName)

      if (rendered) {
        subject = rendered.subject
        htmlBody = rendered.body_html
      }

      // Create notification record
      notifications.push({
        abstract_id: abstract.id,
        notification_type: templateType,
        recipient_email: email,
        recipient_name: abstract.presenting_author_name,
        subject,
        body_preview: htmlBody.substring(0, 500).replace(/<[^>]*>/g, ""),
        metadata: {
          event_id: abstract.event_id,
          event_name: eventName,
          status: abstract.status,
          accepted_as: abstract.accepted_as,
          decision_notes: abstract.decision_notes,
        },
        delivery_status: "pending",
      })

      // Send email if requested
      if (send_email) {
        try {
          const result = await sendEmail({
            to: email,
            subject,
            html: htmlBody,
          })

          if (result.success) {
            emailsSent++
            // Update notification status
            notifications[notifications.length - 1].delivery_status = "sent"
            notifications[notifications.length - 1].sent_at = new Date().toISOString()
          } else {
            errors.push(`Failed to send to ${email}: ${result.error}`)
            notifications[notifications.length - 1].delivery_status = "failed"
          }
        } catch (emailError: any) {
          errors.push(`Error sending to ${email}: ${emailError.message}`)
          notifications[notifications.length - 1].delivery_status = "failed"
        }
      }

      sentCount++
    }

    // Insert all notifications
    if (notifications.length > 0) {
      const { error: notifyError } = await (supabase as any)
        .from("abstract_notifications")
        .insert(notifications)

      if (notifyError) {
        console.error("Error inserting notifications:", notifyError)
      }
    }

    // Mark abstracts as notified
    await (supabase as any)
      .from("abstracts")
      .update({ decision_notified_at: new Date().toISOString() })
      .in("id", notifiableAbstracts.map((a: any) => a.id))

    return NextResponse.json({
      success: true,
      sent: sentCount,
      emails_sent: emailsSent,
      total_abstracts: notifiableAbstracts.length,
      errors: errors.length > 0 ? errors : undefined,
      message: send_email
        ? `Sent ${emailsSent} email(s) for ${notifiableAbstracts.length} abstract(s)`
        : `Notifications queued for ${sentCount} abstract(s)`,
    })
  } catch (error) {
    console.error("Error sending bulk notifications:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Fallback email template when no custom template exists
function buildFallbackEmail(abstract: any, eventName: string): string {
  const statusLabels: Record<string, string> = {
    accepted: "Accepted",
    rejected: "Not Accepted",
    revision_requested: "Revision Requested",
  }

  const statusText = statusLabels[abstract.status] || abstract.status
  const acceptedAsText = abstract.accepted_as ? ` as <strong>${abstract.accepted_as.toUpperCase()}</strong> presentation` : ""

  let decisionSection = ""
  if (abstract.status === "accepted") {
    decisionSection = `
      <p style="color: #059669; font-size: 18px; font-weight: bold;">
        Your abstract has been ${statusText}${acceptedAsText}!
      </p>
    `
  } else if (abstract.status === "rejected") {
    decisionSection = `
      <p>After careful review, we regret to inform you that your abstract was not selected for presentation at this event.</p>
    `
  } else if (abstract.status === "revision_requested") {
    decisionSection = `
      <p style="color: #d97706;">Revisions have been requested for your abstract. Please review the comments below and submit an updated version.</p>
    `
  }

  const notesSection = abstract.decision_notes
    ? `<div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <strong>Reviewer Notes:</strong>
        <p style="margin-top: 10px;">${abstract.decision_notes}</p>
      </div>`
    : ""

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">${eventName}</h1>
        <p style="margin: 10px 0 0; opacity: 0.9;">Abstract Decision Notification</p>
      </div>

      <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p>Dear <strong>${abstract.presenting_author_name}</strong>,</p>

        <p>Thank you for submitting your abstract to ${eventName}.</p>

        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1e3a5f;">
          <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">Abstract #${abstract.abstract_number}</p>
          <p style="margin: 0; font-weight: 600; font-size: 16px;">${abstract.title}</p>
        </div>

        ${decisionSection}
        ${notesSection}

        <p>You can view your submission status and any updates in your author portal.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/my"
             style="display: inline-block; background: #1e3a5f; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            View My Submissions
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="color: #6b7280; font-size: 14px; margin: 0;">
          Best regards,<br>
          The ${eventName} Organizing Committee
        </p>
      </div>

      <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
        This is an automated message. Please do not reply directly to this email.
      </p>
    </body>
    </html>
  `
}
