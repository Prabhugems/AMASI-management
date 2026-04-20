import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { logCronRun } from "@/lib/services/cron-logger"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

/**
 * Cron job to send reminders to reviewers who haven't opened their assignments after 3 days
 *
 * This runs daily and:
 * 1. Finds assignments that are 3+ days old with no email_opened_at
 * 2. Sends reminder emails to those reviewers
 * 3. Updates reminder_count and last_reminder_at
 *
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/reviewer-reminders",
 *     "schedule": "0 9 * * *"
 *   }]
 * }
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const run = await logCronRun("reviewer-reminders")
  const supabase: SupabaseClient = await createAdminClient()
  const now = new Date()
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  try {
    // Find pending assignments that:
    // 1. Were assigned 3+ days ago
    // 2. Have NOT been opened (email_opened_at is null)
    // 3. Haven't had a reminder in the last 2 days
    // 4. Are still pending (not completed/declined)
    const { data: staleAssignments, error: assignmentsError } = await supabase
      .from("abstract_review_assignments")
      .select(`
        id,
        abstract_id,
        reviewer_id,
        assigned_at,
        due_date,
        reminder_count,
        last_reminder_at,
        email_opened_at,
        last_viewed_at,
        abstract_reviewer_pool (
          id,
          name,
          email,
          event_id
        ),
        abstracts (
          id,
          abstract_number,
          title,
          event_id,
          events (
            id,
            name,
            short_name
          )
        )
      `)
      .eq("status", "pending")
      .lt("assigned_at", threeDaysAgo)
      .is("email_opened_at", null)

    if (assignmentsError) {
      console.error("Cron reviewer-reminders: failed to fetch assignments:", assignmentsError)
      await run.err(assignmentsError)
      return NextResponse.json({ error: assignmentsError.message }, { status: 500 })
    }

    if (!staleAssignments || staleAssignments.length === 0) {
      await run.ok({ syncedCount: 0 })
      return NextResponse.json({
        message: "No stale assignments found",
        reminders_sent: 0
      })
    }

    // Filter out assignments that had a reminder in the last 2 days
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
    const assignmentsNeedingReminder = staleAssignments.filter((a: any) => {
      if (!a.last_reminder_at) return true
      return new Date(a.last_reminder_at) < twoDaysAgo
    })

    if (assignmentsNeedingReminder.length === 0) {
      await run.ok({ syncedCount: 0 })
      return NextResponse.json({
        message: "No assignments need reminders (all reminded recently)",
        reminders_sent: 0
      })
    }

    // Group by reviewer to send one email per reviewer with all their pending abstracts
    const reviewerAssignments = new Map<string, any[]>()
    for (const assignment of assignmentsNeedingReminder) {
      const reviewerId = assignment.reviewer_id
      if (!reviewerAssignments.has(reviewerId)) {
        reviewerAssignments.set(reviewerId, [])
      }
      reviewerAssignments.get(reviewerId)!.push(assignment)
    }

    let remindersSent = 0
    const results: Array<{ reviewer_email: string; abstracts_count: number; success: boolean }> = []

    for (const [reviewerId, assignments] of reviewerAssignments) {
      const reviewer = assignments[0].abstract_reviewer_pool
      if (!reviewer?.email) continue

      const eventName = assignments[0].abstracts?.events?.name || "the event"
      const abstractNumbers = assignments.map((a: any) => a.abstracts?.abstract_number).filter(Boolean)

      // Create reminder notification record
      for (const assignment of assignments) {
        await supabase.from("abstract_notifications").insert({
          abstract_id: assignment.abstract_id,
          notification_type: "reviewer_reminder",
          recipient_email: reviewer.email,
          recipient_name: reviewer.name,
          subject: `Reminder: ${assignments.length} abstract${assignments.length > 1 ? 's' : ''} awaiting your review`,
          body_preview: `You have ${assignments.length} abstract${assignments.length > 1 ? 's' : ''} assigned for review: ${abstractNumbers.join(", ")}. Please review them at your earliest convenience.`,
          metadata: {
            reviewer_id: reviewerId,
            abstract_count: assignments.length,
            abstract_numbers: abstractNumbers,
            event_name: eventName,
            days_since_assignment: Math.floor((now.getTime() - new Date(assignment.assigned_at).getTime()) / (24 * 60 * 60 * 1000)),
            reminder_number: (assignment.reminder_count || 0) + 1,
          },
        })

        // Update the assignment with reminder info
        await supabase
          .from("abstract_review_assignments")
          .update({
            reminder_count: (assignment.reminder_count || 0) + 1,
            last_reminder_at: now.toISOString(),
          })
          .eq("id", assignment.id)
      }

      // Update reviewer's email sent tracking
      await supabase
        .from("abstract_reviewer_pool")
        .update({
          total_emails_sent: reviewer.total_emails_sent ? reviewer.total_emails_sent + 1 : 1,
          last_email_sent_at: now.toISOString(),
        })
        .eq("id", reviewerId)

      remindersSent++
      results.push({
        reviewer_email: reviewer.email,
        abstracts_count: assignments.length,
        success: true,
      })

      console.log(`Cron reviewer-reminders: sent reminder to ${reviewer.email} for ${assignments.length} abstract(s)`)
    }

    // Also check for overdue assignments (past due_date) and mark them
    const { data: overdueAssignments } = await supabase
      .from("abstract_review_assignments")
      .select("id, due_date")
      .eq("status", "pending")
      .not("due_date", "is", null)
      .lt("due_date", now.toISOString())

    if (overdueAssignments && overdueAssignments.length > 0) {
      const overdueIds = overdueAssignments.map((a: any) => a.id)
      await supabase
        .from("abstract_review_assignments")
        .update({ status: "overdue" })
        .in("id", overdueIds)

      console.log(`Cron reviewer-reminders: marked ${overdueIds.length} assignment(s) as overdue`)
    }

    await run.ok({
      syncedCount: remindersSent,
      metadata: {
        total_stale_assignments: staleAssignments.length,
        overdue_marked: overdueAssignments?.length || 0,
      },
    })
    return NextResponse.json({
      message: `Sent ${remindersSent} reminder(s) to reviewers`,
      reminders_sent: remindersSent,
      total_stale_assignments: staleAssignments.length,
      overdue_marked: overdueAssignments?.length || 0,
      results,
    })
  } catch (error) {
    console.error("Cron reviewer-reminders: unexpected error:", error)
    await run.err(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
