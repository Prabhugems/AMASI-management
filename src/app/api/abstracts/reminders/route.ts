import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { sendEmail, isEmailEnabled } from "@/lib/email"
import { sendGallaboxTemplate, isGallaboxEnabled } from "@/lib/gallabox"

// POST /api/abstracts/reminders - Send deadline reminders
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_id, reminder_type, channel = "email" } = body

    if (!event_id || !reminder_type) {
      return NextResponse.json({ error: "event_id and reminder_type are required" }, { status: 400 })
    }

    const { error: authError } = await requireEventAndPermission(event_id, 'abstracts')
    if (authError) return authError

    const supabase = await createAdminClient()

    // Fetch event details
    const { data: event } = await (supabase as any)
      .from("events")
      .select("id, name, short_name")
      .eq("id", event_id)
      .single()

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Fetch abstract settings
    const { data: settings } = await (supabase as any)
      .from("abstract_settings")
      .select("*")
      .eq("event_id", event_id)
      .single()

    let sent = 0
    let errors: string[] = []
    const eventName = event.short_name || event.name

    if (reminder_type === "submission_deadline") {
      // Remind authors who started but haven't submitted
      // For now, we'll skip this as there's no draft tracking
      // Could be implemented with draft abstracts feature
      return NextResponse.json({
        message: "Submission deadline reminders require draft tracking feature",
        sent: 0,
      })
    }

    if (reminder_type === "review_deadline") {
      // Remind reviewers with pending reviews
      const { data: assignments } = await (supabase as any)
        .from("abstract_review_assignments")
        .select(`
          id,
          reviewer:abstract_reviewers(id, name, email, phone),
          abstract:abstracts(id, abstract_number, title)
        `)
        .eq("event_id", event_id)
        .eq("status", "pending")

      if (!assignments || assignments.length === 0) {
        return NextResponse.json({
          message: "No pending review assignments found",
          sent: 0,
        })
      }

      // Group by reviewer
      const reviewerAssignments: Record<string, { name: string; email: string; phone: string | null; abstracts: any[] }> = {}
      for (const assignment of assignments) {
        if (!assignment.reviewer?.email) continue
        const email = assignment.reviewer.email.toLowerCase()
        if (!reviewerAssignments[email]) {
          reviewerAssignments[email] = {
            name: assignment.reviewer.name,
            email,
            phone: assignment.reviewer.phone,
            abstracts: [],
          }
        }
        reviewerAssignments[email].abstracts.push(assignment.abstract)
      }

      // Send reminders
      for (const [email, data] of Object.entries(reviewerAssignments)) {
        try {
          if (channel === "email" && isEmailEnabled()) {
            const abstractList = data.abstracts
              .map((a: any) => `• ${a.abstract_number}: ${a.title}`)
              .join("\n")

            const deadline = settings?.review_deadline
              ? new Date(settings.review_deadline).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "soon"

            await sendEmail({
              to: email,
              subject: `Review Reminder - ${eventName}`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2>Review Reminder</h2>
                  <p>Dear ${data.name},</p>
                  <p>This is a friendly reminder that you have <strong>${data.abstracts.length}</strong> abstract(s) pending review for <strong>${eventName}</strong>.</p>
                  <p>Review deadline: <strong>${deadline}</strong></p>
                  <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <strong>Pending Abstracts:</strong>
                    <pre style="white-space: pre-wrap; font-family: sans-serif;">${abstractList}</pre>
                  </div>
                  <p>Please complete your reviews at your earliest convenience.</p>
                  <p>Thank you for your contribution!</p>
                </div>
              `,
            })
            sent++
          }

          if (channel === "whatsapp" && isGallaboxEnabled() && data.phone) {
            // Send WhatsApp template message
            const deadline = settings?.review_deadline
              ? new Date(settings.review_deadline).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "soon"

            const result = await sendGallaboxTemplate(
              data.phone,
              data.name,
              "abstract_review_reminder",
              {
                reviewer_name: data.name,
                abstract_count: String(data.abstracts.length),
                event_name: eventName,
                deadline: deadline,
              }
            )

            if (result.success) {
              sent++
            } else {
              errors.push(`WhatsApp to ${data.phone}: ${result.error}`)
            }
          }

          // Log the reminder
          await (supabase as any)
            .from("abstract_notifications")
            .insert({
              notification_type: `${reminder_type}_reminder`,
              recipient_email: email,
              recipient_name: data.name,
              subject: `Review Reminder - ${eventName}`,
              body_preview: `Reminder to complete review of ${data.abstracts.length} abstract(s)`,
              metadata: {
                event_id,
                channel,
                reminder_type,
                recipient_type: "reviewer",
                recipient_phone: data.phone,
                abstract_count: data.abstracts.length,
              },
            })
        } catch (err: any) {
          errors.push(`Failed to send to ${email}: ${err.message}`)
        }
      }
    }

    if (reminder_type === "revision_deadline") {
      // Remind authors with pending revisions
      const { data: abstracts } = await (supabase as any)
        .from("abstracts")
        .select("id, abstract_number, title, presenting_author_name, presenting_author_email, presenting_author_phone")
        .eq("event_id", event_id)
        .eq("status", "revision_requested")

      if (!abstracts || abstracts.length === 0) {
        return NextResponse.json({
          message: "No pending revisions found",
          sent: 0,
        })
      }

      for (const abstract of abstracts) {
        if (!abstract.presenting_author_email) continue
        try {
          if (channel === "email" && isEmailEnabled()) {
            await sendEmail({
              to: abstract.presenting_author_email,
              subject: `Revision Reminder - ${abstract.abstract_number} - ${eventName}`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2>Revision Reminder</h2>
                  <p>Dear ${abstract.presenting_author_name},</p>
                  <p>This is a reminder that your abstract <strong>${abstract.abstract_number}</strong> requires revision.</p>
                  <p><strong>Title:</strong> ${abstract.title}</p>
                  <p>Please submit your revised abstract at your earliest convenience through the author portal.</p>
                  <p>Thank you!</p>
                </div>
              `,
            })
            sent++
          }

          if (channel === "whatsapp" && isGallaboxEnabled() && abstract.presenting_author_phone) {
            const revisionUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "https://collegeofmas.org.in"}/submit-abstract/${event_id}?revision=${abstract.id}&email=${encodeURIComponent(abstract.presenting_author_email)}`

            const result = await sendGallaboxTemplate(
              abstract.presenting_author_phone,
              abstract.presenting_author_name,
              "abstract_revision_reminder",
              {
                author_name: abstract.presenting_author_name,
                abstract_number: abstract.abstract_number,
                event_name: eventName,
                revision_url: revisionUrl,
              }
            )

            if (result.success) {
              sent++
            } else {
              errors.push(`WhatsApp to ${abstract.presenting_author_phone}: ${result.error}`)
            }
          }

          // Log the reminder
          await (supabase as any)
            .from("abstract_notifications")
            .insert({
              abstract_id: abstract.id,
              notification_type: `${reminder_type}_reminder`,
              recipient_email: abstract.presenting_author_email,
              recipient_name: abstract.presenting_author_name,
              subject: `Revision Reminder - ${abstract.abstract_number}`,
              body_preview: `Reminder to submit revision for abstract ${abstract.abstract_number}`,
              metadata: {
                event_id,
                channel,
                reminder_type,
                recipient_type: "author",
                recipient_phone: abstract.presenting_author_phone,
                abstract_number: abstract.abstract_number,
              },
            })
        } catch (err: any) {
          errors.push(`Failed to send to ${abstract.presenting_author_email}: ${err.message}`)
        }
      }
    }

    // Update last reminder sent
    await (supabase as any)
      .from("abstract_settings")
      .update({ last_reminder_sent_at: new Date().toISOString() })
      .eq("event_id", event_id)

    return NextResponse.json({
      success: true,
      sent,
      errors: errors.length > 0 ? errors : undefined,
      message: `Sent ${sent} reminder(s)`,
    })
  } catch (error) {
    console.error("Error sending reminders:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/abstracts/reminders?event_id=... - Get reminder history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const { error: authError } = await requireEventAndPermission(eventId, 'abstracts')
    if (authError) return authError

    const supabase = await createAdminClient()

    const { data: reminders, error } = await (supabase as any)
      .from("abstract_reminders")
      .select("*")
      .eq("event_id", eventId)
      .order("sent_at", { ascending: false })
      .limit(100)

    if (error) {
      console.error("Error fetching reminders:", error)
      return NextResponse.json({ error: "Failed to fetch reminders" }, { status: 500 })
    }

    // Get stats
    const stats = {
      total: reminders?.length || 0,
      by_type: {} as Record<string, number>,
      by_channel: {} as Record<string, number>,
    }

    for (const r of reminders || []) {
      stats.by_type[r.reminder_type] = (stats.by_type[r.reminder_type] || 0) + 1
      stats.by_channel[r.channel] = (stats.by_channel[r.channel] || 0) + 1
    }

    return NextResponse.json({
      reminders: reminders || [],
      stats,
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
