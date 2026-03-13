import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

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
      const { data } = await supabase
        .from("abstract_reviewer_pool")
        .select("*")
        .eq("access_token", reviewer_token)
        .single()
      reviewer = data
    } else if (reviewer_id) {
      const { data } = await supabase
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
    const { data: assignment, error: assignmentError } = await supabase
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
    const { data: abstract } = await supabase
      .from("abstracts")
      .select("*, abstract_categories(name)")
      .eq("id", abstractId)
      .single()

    // Get committee members for notifications
    const { data: committeeMembers } = await supabase
      .from("abstract_committee_members")
      .select("email, name")
      .eq("event_id", abstract?.event_id)
      .eq("is_active", true)
      .limit(5)

    const committeeEmail = committeeMembers?.[0]?.email || "committee@event.com"
    const committeeName = committeeMembers?.[0]?.name || "Scientific Committee"

    switch (action) {
      case "decline": {
        // Reviewer declines the assignment
        const { error: updateError } = await supabase
          .from("abstract_review_assignments")
          .update({
            status: "declined",
            completed_at: new Date().toISOString(),
          })
          .eq("id", assignment.id)

        if (updateError) {
          return NextResponse.json({ error: "Failed to decline assignment" }, { status: 500 })
        }

        // Log the decline action
        await supabase.from("abstract_notifications").insert({
          abstract_id: abstractId,
          notification_type: "reviewer_declined",
          recipient_email: committeeEmail,
          recipient_name: committeeName,
          subject: `Reviewer Declined: ${abstract?.title}`,
          body_preview: `${reviewer.name} has declined to review abstract #${abstract?.abstract_number}. Reason: ${reason || "Not specified"}`,
          metadata: {
            reviewer_id: reviewer.id,
            reviewer_name: reviewer.name,
            reason,
            suggested_reviewer_email,
          },
        })

        return NextResponse.json({
          success: true,
          message: "Assignment declined. Committee will be notified to reassign.",
          needs_reassignment: true,
        })
      }

      case "flag_mismatch": {
        // Reviewer flags that the abstract doesn't match their expertise or the category is wrong
        const { error: updateError } = await supabase
          .from("abstract_review_assignments")
          .update({
            status: "flagged",
          })
          .eq("id", assignment.id)

        if (updateError) {
          return NextResponse.json({ error: "Failed to flag assignment" }, { status: 500 })
        }

        // Update abstract with mismatch flag
        await supabase
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
        await supabase.from("abstract_notifications").insert({
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
        await supabase.from("abstract_notifications").insert({
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
        const { data: oldAssignment } = await supabase
          .from("abstract_review_assignments")
          .select("*")
          .eq("id", assignment_id)
          .single()

        if (!oldAssignment) {
          return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
        }

        // Mark old assignment as reassigned
        await supabase
          .from("abstract_review_assignments")
          .update({ status: "reassigned" })
          .eq("id", assignment_id)

        // Create new assignment
        const { data: newAssignment, error: createError } = await supabase
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

        const { error: updateError } = await supabase
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

        const { error: updateError } = await supabase
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
