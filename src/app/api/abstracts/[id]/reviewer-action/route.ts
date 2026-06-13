import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { sendAndLogAbstractNotification } from "@/lib/abstracts/notify"
import { isEmailEnabled } from "@/lib/email"
import type { TemplateType, TemplateVariables } from "@/lib/email-templates"
import { NextRequest, NextResponse } from "next/server"

// Valid decline reasons
const DECLINE_REASONS = {
  not_my_specialty: "Not in my specialty",
  conflict_of_interest: "Conflict of interest",
  no_time: "No time available",
  already_reviewed_elsewhere: "Already reviewed elsewhere",
  other: "Other reason",
}

// GET /api/abstracts/[id]/reviewer-action - Track view (call when reviewer opens abstract)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: abstractId } = await params
    const { searchParams } = new URL(request.url)
    const reviewerEmail = searchParams.get("reviewer_email")
    const action = searchParams.get("action") // "view" or "email_opened"

    if (!reviewerEmail) {
      return NextResponse.json({ error: "Reviewer email required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Find the reviewer
    const { data: reviewer } = await (supabase as any)
      .from("abstract_reviewers")
      .select("id, email, event_id")
      .ilike("email", reviewerEmail)
      .maybeSingle()

    if (!reviewer) {
      // Try the reviewer pool table
      const { data: poolReviewer } = await (supabase as any)
        .from("abstract_reviewer_pool")
        .select("id, email, event_id")
        .ilike("email", reviewerEmail)
        .maybeSingle()

      if (!poolReviewer) {
        return NextResponse.json({ error: "Reviewer not found" }, { status: 404 })
      }

      // Update pool reviewer tracking
      if (action === "email_opened") {
        await (supabase as any)
          .from("abstract_reviewer_pool")
          .update({
            total_emails_opened: (supabase as any).rpc('increment', { row_id: poolReviewer.id, table_name: 'abstract_reviewer_pool', column_name: 'total_emails_opened' }),
          })
          .eq("id", poolReviewer.id)
      }

      // Update assignment tracking
      const { data: assignment } = await (supabase as any)
        .from("abstract_review_assignments")
        .select("id, view_count")
        .eq("abstract_id", abstractId)
        .eq("reviewer_id", poolReviewer.id)
        .order("review_round", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (assignment) {
        const updateData: Record<string, any> = {
          last_viewed_at: new Date().toISOString(),
          view_count: (assignment.view_count || 0) + 1,
        }

        if (action === "email_opened" && !assignment.email_opened_at) {
          updateData.email_opened_at = new Date().toISOString()
        }

        await (supabase as any)
          .from("abstract_review_assignments")
          .update(updateData)
          .eq("id", assignment.id)
      }

      return NextResponse.json({ success: true, tracked: true })
    }

    return NextResponse.json({ success: true, tracked: true })
  } catch (error) {
    console.error("Error tracking reviewer view:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/abstracts/[id]/reviewer-action - Reviewer actions (decline, flag mismatch)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: abstractId } = await params
    const body = await request.json()
    const {
      action, // "decline", "flag_mismatch", "request_extension"
      reviewer_token,
      reviewer_id,
      reason,
      suggested_category, // For category mismatch
      suggested_reviewer_email, // For suggesting alternative reviewer
      extension_days, // For extension request
    } = body

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Authenticate reviewer by token or ID
    let reviewer = null
    if (reviewer_token) {
      const { data } = await (supabase as any)
        .from("abstract_reviewer_pool")
        .select("*")
        .eq("access_token", reviewer_token)
        .single()
      reviewer = data
    } else if (reviewer_id) {
      const { data } = await (supabase as any)
        .from("abstract_reviewer_pool")
        .select("*")
        .eq("id", reviewer_id)
        .single()
      reviewer = data
    }

    if (!reviewer) {
      return NextResponse.json({ error: "Reviewer not found" }, { status: 404 })
    }

    // Get the assignment
    const { data: assignment, error: assignmentError } = await (supabase as any)
      .from("abstract_review_assignments")
      .select("*")
      .eq("abstract_id", abstractId)
      .eq("reviewer_id", reviewer.id)
      .eq("status", "pending")
      .order("review_round", { ascending: false })
      .limit(1)
      .single()

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: "No pending assignment found for this abstract" },
        { status: 404 }
      )
    }

    // Get abstract details
    const { data: abstract } = await (supabase as any)
      .from("abstracts")
      .select("*, abstract_categories!category_id(name)")
      .eq("id", abstractId)
      .single()

    // Committee = active team_members with a committee-capable role and this
    // event in their event_ids. Phase 4: BROADCAST to all such members, not
    // just the first one. The previous .limit(5) + [0]-only pattern was a
    // single-point-of-failure: if that one member was unavailable, the
    // abstract silently stalled. No cap: committee sizes are small (max 2
    // observed in production), and per-recipient send means N=committee_size
    // notification rows — trivial volume.
    const { data: committeeMembers } = await (supabase as any)
      .from("team_members")
      .select("email, name")
      .eq("is_active", true)
      .contains("event_ids", [abstract?.event_id])
      .in("role", ["admin", "coordinator", "committee_member"])

    // Phase 2 hardening retained: when zero committee staffed for the event,
    // we don't fabricate a fake recipient (no more `committee@event.com`
    // placeholder). The reviewer's action still succeeds.
    const hasRealCommittee = (committeeMembers?.length ?? 0) > 0

    switch (action) {
      case "decline": {
        // Valid decline reasons
        const validReasons = ["not_my_specialty", "conflict_of_interest", "no_time", "already_reviewed_elsewhere", "other"]
        const declineReason = validReasons.includes(reason) ? reason : "other"
        const reasonLabel = DECLINE_REASONS[declineReason as keyof typeof DECLINE_REASONS] || reason

        // Reviewer declines the assignment
        const { error: updateError } = await (supabase as any)
          .from("abstract_review_assignments")
          .update({
            status: "declined",
            completed_at: new Date().toISOString(),
            declined_reason: declineReason,
            declined_notes: body.declined_notes || null,
          })
          .eq("id", assignment.id)

        if (updateError) {
          return NextResponse.json({ error: "Failed to decline assignment" }, { status: 500 })
        }

        // Update reviewer's decline count
        await (supabase as any)
          .from("abstract_reviewer_pool")
          .update({
            decline_count: reviewer.decline_count ? reviewer.decline_count + 1 : 1,
          })
          .eq("id", reviewer.id)

        // Broadcast to all committee members. Side-effects above are already
        // committed; notification failures don't roll them back. Per-recipient
        // rows so a partial failure is visible (3-of-4 delivered, 4th bounced).
        const notifyResult = await broadcastToCommittee({
          supabase,
          abstract,
          committeeMembers: committeeMembers ?? [],
          hasRealCommittee,
          templateType: "reviewer_declined",
          notificationType: "reviewer_declined",
          subject: `[Action required] Reviewer declined: ${abstract?.abstract_number} (${reviewer.name})`,
          fallbackHtmlBuilder: (committeeMemberName) =>
            buildReviewerDeclinedHtml({
              committeeMemberName,
              reviewerName: reviewer.name,
              abstractNumber: abstract?.abstract_number ?? "",
              abstractTitle: abstract?.title ?? "",
              reasonLabel,
              declinedNotes: body.declined_notes ?? null,
              suggestedReviewerEmail: suggested_reviewer_email ?? null,
            }),
          metadata: {
            reviewer_id: reviewer.id,
            reviewer_name: reviewer.name,
            reason: declineReason,
            reason_label: reasonLabel,
            declined_notes: body.declined_notes,
            suggested_reviewer_email,
          },
        })

        return NextResponse.json({
          success: true,
          message: "Assignment declined. Committee will be notified to reassign.",
          needs_reassignment: true,
          reason: declineReason,
          notifications: notifyResult,
        })
      }

      case "flag_mismatch": {
        // Reviewer flags that the abstract doesn't match their expertise or the category is wrong
        const { error: updateError } = await (supabase as any)
          .from("abstract_review_assignments")
          .update({
            status: "flagged",
          })
          .eq("id", assignment.id)

        if (updateError) {
          return NextResponse.json({ error: "Failed to flag assignment" }, { status: 500 })
        }

        // Update abstract with mismatch flag
        await (supabase as any)
          .from("abstracts")
          .update({
            has_category_mismatch: true,
            category_mismatch_reason: reason,
            suggested_category_id: suggested_category,
            category_flagged_by: reviewer.id,
            category_flagged_at: new Date().toISOString(),
          })
          .eq("id", abstractId)

        const currentCategoryName = (abstract?.abstract_categories as any)?.name ?? "Uncategorized"
        const notifyResult = await broadcastToCommittee({
          supabase,
          abstract,
          committeeMembers: committeeMembers ?? [],
          hasRealCommittee,
          templateType: "category_mismatch_flagged",
          notificationType: "category_mismatch",
          subject: `[Action required] Category flagged: ${abstract?.abstract_number} (${reviewer.name})`,
          fallbackHtmlBuilder: (committeeMemberName) =>
            buildCategoryMismatchHtml({
              committeeMemberName,
              reviewerName: reviewer.name,
              abstractNumber: abstract?.abstract_number ?? "",
              abstractTitle: abstract?.title ?? "",
              currentCategoryName,
              reason: reason ?? null,
              suggestedCategory: suggested_category ?? null,
            }),
          metadata: {
            reviewer_id: reviewer.id,
            reviewer_name: reviewer.name,
            reason,
            current_category: currentCategoryName,
            suggested_category,
          },
        })

        return NextResponse.json({
          success: true,
          message: "Category mismatch flagged. Committee will review and may reassign.",
          needs_committee_review: true,
          notifications: notifyResult,
        })
      }

      case "request_extension": {
        // Reviewer requests more time
        const newDueDate = new Date(
          new Date(assignment.due_date).getTime() + (extension_days || 3) * 24 * 60 * 60 * 1000
        )

        const days = extension_days || 3
        const notifyResult = await broadcastToCommittee({
          supabase,
          abstract,
          committeeMembers: committeeMembers ?? [],
          hasRealCommittee,
          templateType: "review_extension_requested",
          notificationType: "extension_requested",
          subject: `[Review needed] Extension request: ${abstract?.abstract_number}`,
          fallbackHtmlBuilder: (committeeMemberName) =>
            buildExtensionRequestHtml({
              committeeMemberName,
              reviewerName: reviewer.name,
              abstractNumber: abstract?.abstract_number ?? "",
              abstractTitle: abstract?.title ?? "",
              currentDueDate: assignment.due_date,
              requestedDueDate: newDueDate.toISOString(),
              days,
              reason: reason ?? null,
            }),
          metadata: {
            reviewer_id: reviewer.id,
            reviewer_name: reviewer.name,
            current_due_date: assignment.due_date,
            requested_due_date: newDueDate.toISOString(),
            extension_days: days,
            reason,
          },
        })

        return NextResponse.json({
          success: true,
          message: "Extension request submitted. Committee will review.",
          pending_approval: true,
          notifications: notifyResult,
        })
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error processing reviewer action:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/abstracts/[id]/reviewer-action - Committee actions (reassign, approve extension)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: abstractId } = await params
    const body = await request.json()
    const {
      action, // "reassign", "approve_extension", "change_category"
      assignment_id,
      new_reviewer_id,
      new_category_id,
      new_due_date,
      committee_member_id,
      notes,
    } = body

    const supabase = await createAdminClient()

    // Get abstract to check event permission
    const { data: abstractRecord } = await (supabase as any)
      .from("abstracts")
      .select("event_id")
      .eq("id", abstractId)
      .single()

    if (!abstractRecord) {
      return NextResponse.json({ error: "Abstract not found" }, { status: 404 })
    }

    const { error: authError } = await requireEventAndPermission(abstractRecord.event_id, 'abstracts')
    if (authError) return authError

    switch (action) {
      case "reassign": {
        // Committee reassigns to new reviewer
        if (!assignment_id || !new_reviewer_id) {
          return NextResponse.json(
            { error: "Assignment ID and new reviewer ID required" },
            { status: 400 }
          )
        }

        // Get old assignment
        const { data: oldAssignment } = await (supabase as any)
          .from("abstract_review_assignments")
          .select("*")
          .eq("id", assignment_id)
          .single()

        if (!oldAssignment) {
          return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
        }

        // Mark old assignment as reassigned
        await (supabase as any)
          .from("abstract_review_assignments")
          .update({ status: "reassigned" })
          .eq("id", assignment_id)

        // Create new assignment
        const { data: newAssignment, error: createError } = await (supabase as any)
          .from("abstract_review_assignments")
          .insert({
            abstract_id: abstractId,
            reviewer_id: new_reviewer_id,
            review_round: oldAssignment.review_round,
            assigned_by: committee_member_id,
            due_date: new_due_date || oldAssignment.due_date,
            status: "pending",
          })
          .select(`
            id,
            abstract_reviewer_pool (name, email)
          `)
          .single()

        if (createError) {
          return NextResponse.json({ error: "Failed to create new assignment" }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          message: "Abstract reassigned to new reviewer",
          new_assignment: newAssignment,
        })
      }

      case "approve_extension": {
        // Approve extension request
        if (!assignment_id || !new_due_date) {
          return NextResponse.json(
            { error: "Assignment ID and new due date required" },
            { status: 400 }
          )
        }

        const { error: updateError } = await (supabase as any)
          .from("abstract_review_assignments")
          .update({
            due_date: new_due_date,
          })
          .eq("id", assignment_id)

        if (updateError) {
          return NextResponse.json({ error: "Failed to update due date" }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          message: "Extension approved",
          new_due_date,
        })
      }

      case "change_category": {
        // Change abstract category after mismatch flag
        if (!new_category_id) {
          return NextResponse.json({ error: "New category ID required" }, { status: 400 })
        }

        const { error: updateError } = await (supabase as any)
          .from("abstracts")
          .update({
            category_id: new_category_id,
            has_category_mismatch: false,
            category_changed_by: committee_member_id,
            category_changed_at: new Date().toISOString(),
            category_change_notes: notes,
          })
          .eq("id", abstractId)

        if (updateError) {
          return NextResponse.json({ error: "Failed to change category" }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          message: "Category changed successfully",
        })
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error processing committee action:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Broadcast + fallback helpers (Phase: reviewer-action sync-send)
// ---------------------------------------------------------------------------

type BroadcastInput = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abstract: any
  committeeMembers: Array<{ email: string; name: string | null }>
  hasRealCommittee: boolean
  templateType: TemplateType
  notificationType: string
  subject: string
  fallbackHtmlBuilder: (committeeMemberName: string) => string
  metadata: Record<string, unknown>
}

type BroadcastResult = {
  recipients: number
  sent: number
  failed: number
  skipped: boolean
  details: Array<{ email: string; delivered: boolean; error?: string }>
}

// Per-recipient sync send. One abstract_notifications row per recipient so
// "3 of 4 delivered, 4th bounced" is observable, not aggregated away.
// Send failures are recorded but do NOT throw — the reviewer's action has
// already committed; an unsent email is a separate problem.
async function broadcastToCommittee(input: BroadcastInput): Promise<BroadcastResult> {
  if (!input.hasRealCommittee) {
    return { recipients: 0, sent: 0, failed: 0, skipped: true, details: [] }
  }
  if (!isEmailEnabled()) {
    return {
      recipients: input.committeeMembers.length,
      sent: 0,
      failed: 0,
      skipped: true,
      details: input.committeeMembers.map(m => ({
        email: m.email,
        delivered: false,
        error: "email provider not configured",
      })),
    }
  }

  const details: BroadcastResult["details"] = []
  let sent = 0
  let failed = 0
  for (const member of input.committeeMembers) {
    if (!member.email) continue
    const html = input.fallbackHtmlBuilder(member.name ?? "Committee member")
    // Template variables kept lean — these emails fall back to the inline
    // HTML by default; if a custom template is configured later, it gets
    // these standard fields to substitute against.
    const variables: TemplateVariables = {
      abstract_number: input.abstract?.abstract_number ?? undefined,
      abstract_title: input.abstract?.title ?? undefined,
      author_name: input.abstract?.presenting_author_name ?? undefined,
    }
    const result = await sendAndLogAbstractNotification({
      supabase: input.supabase,
      abstractId: input.abstract.id,
      eventId: input.abstract.event_id,
      recipientEmail: member.email,
      recipientName: member.name,
      templateType: input.templateType,
      notificationType: input.notificationType,
      templateVariables: variables,
      fallbackSubject: input.subject,
      fallbackHtml: html,
      metadata: input.metadata,
    })
    if (result.delivered) sent++; else failed++
    details.push({ email: member.email, delivered: result.delivered, error: result.error })
  }

  return {
    recipients: input.committeeMembers.length,
    sent,
    failed,
    skipped: false,
    details,
  }
}

function escRA(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function buildReviewerDeclinedHtml(input: {
  committeeMemberName: string
  reviewerName: string
  abstractNumber: string
  abstractTitle: string
  reasonLabel: string
  declinedNotes: string | null
  suggestedReviewerEmail: string | null
}): string {
  const notesBlock = input.declinedNotes
    ? `<p><strong>Reviewer notes:</strong> ${escRA(input.declinedNotes)}</p>`
    : ""
  const suggestionBlock = input.suggestedReviewerEmail
    ? `<p><strong>Reviewer suggests:</strong> ${escRA(input.suggestedReviewerEmail)} as an alternative.</p>`
    : ""
  return `<!doctype html><html><body style="font-family:-apple-system,sans-serif;line-height:1.6;color:#1f2937;max-width:600px;margin:0 auto;padding:20px">
    <p>Dear ${escRA(input.committeeMemberName)},</p>
    <p><strong>${escRA(input.reviewerName)}</strong> has declined to review <strong>${escRA(input.abstractNumber)}</strong> — ${escRA(input.abstractTitle)}.</p>
    <p><strong>Reason:</strong> ${escRA(input.reasonLabel)}</p>
    ${notesBlock}
    ${suggestionBlock}
    <p>The abstract now needs a replacement reviewer. Please reassign at your earliest convenience so the review round stays on track.</p>
    <p style="color:#6b7280;font-size:13px">— The Organizing Committee notification system</p>
  </body></html>`
}

function buildCategoryMismatchHtml(input: {
  committeeMemberName: string
  reviewerName: string
  abstractNumber: string
  abstractTitle: string
  currentCategoryName: string
  reason: string | null
  suggestedCategory: string | null
}): string {
  const reasonBlock = input.reason
    ? `<p><strong>Reason:</strong> ${escRA(input.reason)}</p>`
    : ""
  const suggestionBlock = input.suggestedCategory
    ? `<p><strong>Suggested category:</strong> ${escRA(input.suggestedCategory)}</p>`
    : ""
  return `<!doctype html><html><body style="font-family:-apple-system,sans-serif;line-height:1.6;color:#1f2937;max-width:600px;margin:0 auto;padding:20px">
    <p>Dear ${escRA(input.committeeMemberName)},</p>
    <p><strong>${escRA(input.reviewerName)}</strong> has flagged a category mismatch on <strong>${escRA(input.abstractNumber)}</strong> — ${escRA(input.abstractTitle)}.</p>
    <p><strong>Current category:</strong> ${escRA(input.currentCategoryName)}</p>
    ${suggestionBlock}
    ${reasonBlock}
    <p>The abstract is now flagged and the reviewer's assignment is parked until the committee acts. Please either change the category (and possibly reassign), or confirm the current category and reassign to a reviewer in this domain.</p>
    <p style="color:#6b7280;font-size:13px">— The Organizing Committee notification system</p>
  </body></html>`
}

function buildExtensionRequestHtml(input: {
  committeeMemberName: string
  reviewerName: string
  abstractNumber: string
  abstractTitle: string
  currentDueDate: string | null
  requestedDueDate: string
  days: number
  reason: string | null
}): string {
  const fmt = (iso: string | null) => {
    if (!iso) return "—"
    try { return new Date(iso).toUTCString() } catch { return iso }
  }
  const reasonBlock = input.reason
    ? `<p><strong>Reason:</strong> ${escRA(input.reason)}</p>`
    : ""
  return `<!doctype html><html><body style="font-family:-apple-system,sans-serif;line-height:1.6;color:#1f2937;max-width:600px;margin:0 auto;padding:20px">
    <p>Dear ${escRA(input.committeeMemberName)},</p>
    <p><strong>${escRA(input.reviewerName)}</strong> has requested a <strong>${input.days}-day extension</strong> on <strong>${escRA(input.abstractNumber)}</strong> — ${escRA(input.abstractTitle)}.</p>
    <p><strong>Current deadline:</strong> ${escRA(fmt(input.currentDueDate))}<br/>
       <strong>Requested deadline:</strong> ${escRA(fmt(input.requestedDueDate))}</p>
    ${reasonBlock}
    <p>The reviewer is still working — no reassignment needed. Please approve or decline so they know whether to continue against the new deadline.</p>
    <p style="color:#6b7280;font-size:13px">— The Organizing Committee notification system</p>
  </body></html>`
}
