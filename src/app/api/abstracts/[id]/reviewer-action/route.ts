import { createAdminClient } from "@/lib/supabase/server"
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
      .select("*, abstract_categories(name)")
      .eq("id", abstractId)
      .single()

    // Get committee members for notifications
    const { data: committeeMembers } = await (supabase as any)
      .from("abstract_committee_members")
      .select("email, name")
      .eq("event_id", abstract?.event_id)
      .eq("is_active", true)
      .limit(5)

    const committeeEmail = committeeMembers?.[0]?.email || "committee@event.com"
    const committeeName = committeeMembers?.[0]?.name || "Scientific Committee"

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

        // Log the decline action
        await (supabase as any).from("abstract_notifications").insert({
          abstract_id: abstractId,
          notification_type: "reviewer_declined",
          recipient_email: committeeEmail,
          recipient_name: committeeName,
          subject: `Reviewer Declined: ${abstract?.title}`,
          body_preview: `${reviewer.name} has declined to review abstract #${abstract?.abstract_number}. Reason: ${reasonLabel}${body.declined_notes ? ` - ${body.declined_notes}` : ""}`,
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

        // Notify committee
        await (supabase as any).from("abstract_notifications").insert({
          abstract_id: abstractId,
          notification_type: "category_mismatch",
          recipient_email: committeeEmail,
          recipient_name: committeeName,
          subject: `Category Mismatch Flagged: ${abstract?.title}`,
          body_preview: `${reviewer.name} has flagged a potential category mismatch for abstract #${abstract?.abstract_number}. Current category: ${(abstract?.abstract_categories as any)?.name}. Reason: ${reason}`,
          metadata: {
            reviewer_id: reviewer.id,
            reviewer_name: reviewer.name,
            reason,
            current_category: (abstract?.abstract_categories as any)?.name,
            suggested_category,
          },
        })

        return NextResponse.json({
          success: true,
          message: "Category mismatch flagged. Committee will review and may reassign.",
          needs_committee_review: true,
        })
      }

      case "request_extension": {
        // Reviewer requests more time
        const newDueDate = new Date(
          new Date(assignment.due_date).getTime() + (extension_days || 3) * 24 * 60 * 60 * 1000
        )

        // Log extension request (don't auto-approve, needs committee approval)
        await (supabase as any).from("abstract_notifications").insert({
          abstract_id: abstractId,
          notification_type: "extension_requested",
          recipient_email: committeeEmail,
          recipient_name: committeeName,
          subject: `Extension Requested: ${abstract?.title}`,
          body_preview: `${reviewer.name} has requested a ${extension_days || 3}-day extension for reviewing abstract #${abstract?.abstract_number}. Reason: ${reason || "Not specified"}`,
          metadata: {
            reviewer_id: reviewer.id,
            reviewer_name: reviewer.name,
            current_due_date: assignment.due_date,
            requested_due_date: newDueDate.toISOString(),
            extension_days: extension_days || 3,
            reason,
          },
        })

        return NextResponse.json({
          success: true,
          message: "Extension request submitted. Committee will review.",
          pending_approval: true,
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
