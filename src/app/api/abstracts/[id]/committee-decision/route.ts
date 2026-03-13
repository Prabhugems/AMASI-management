import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { NextRequest, NextResponse } from "next/server"

// POST /api/abstracts/[id]/committee-decision
// Committee makes decision: accept_oral, accept_poster, accept_video, second_review, reject
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin()
    const { id } = await params
    const body = await request.json()

    const {
      decision, // accept_oral, accept_poster, accept_video, second_review, reject
      notes,
      second_review_reason,
      second_review_instructions,
      rejection_reason,
      feedback_to_author,
      send_notification = true,
    } = body

    if (!decision) {
      return NextResponse.json({ error: "Decision is required" }, { status: 400 })
    }

    const validDecisions = ['accept_oral', 'accept_poster', 'accept_video', 'second_review', 'reject']
    if (!validDecisions.includes(decision)) {
      return NextResponse.json({ error: "Invalid decision" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Get the abstract
    const { data: abstract, error: fetchError } = await supabase
      .from("abstracts")
      .select("*, event_id, presenting_author_email, presenting_author_name, review_round")
      .eq("id", id)
      .single()

    if (fetchError || !abstract) {
      return NextResponse.json({ error: "Abstract not found" }, { status: 404 })
    }

    // Get committee member info
    const { data: committeeMember } = await supabase
      .from("abstract_committee_members")
      .select("id, name")
      .eq("event_id", abstract.event_id)
      .eq("email", user.email?.toLowerCase())
      .maybeSingle()

    // Prepare update based on decision
    const updateData: Record<string, unknown> = {
      committee_decision: decision,
      committee_decision_by: committeeMember?.id || null,
      committee_decision_at: new Date().toISOString(),
      committee_notes: notes,
      updated_at: new Date().toISOString(),
    }

    if (decision === 'second_review') {
      // Send to second review round
      updateData.status = 'under_review'
      updateData.review_round = (abstract.review_round || 1) + 1
      updateData.second_review_reason = second_review_reason
      updateData.workflow_stage = 'review'
    } else if (decision === 'reject') {
      updateData.status = 'rejected'
      updateData.workflow_stage = 'closed'
    } else {
      // Accept (oral/poster/video)
      updateData.status = 'accepted'
      updateData.accepted_as = decision.replace('accept_', '') // oral, poster, video
      updateData.workflow_stage = 'scheduling'
    }

    // Update abstract
    const { data: updatedAbstract, error: updateError } = await supabase
      .from("abstracts")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating abstract:", updateError)
      return NextResponse.json({ error: "Failed to update abstract" }, { status: 500 })
    }

    // Log the decision
    const { error: logError } = await supabase
      .from("abstract_committee_decisions")
      .insert({
        abstract_id: id,
        decision,
        decision_by: committeeMember?.id,
        decision_by_name: committeeMember?.name || user.email,
        review_round: abstract.review_round || 1,
        second_review_reason,
        second_review_instructions,
        rejection_reason,
        feedback_to_author,
        notes,
      })

    if (logError) {
      console.error("Error logging decision:", logError)
    }

    // If second review, we need to clear old assignments and prepare for new ones
    if (decision === 'second_review') {
      // Mark existing assignments as completed/closed
      await supabase
        .from("abstract_review_assignments")
        .update({ status: 'completed' })
        .eq("abstract_id", id)
        .eq("review_round", abstract.review_round || 1)
    }

    // Check registration if accepted
    let registrationStatus = null
    if (decision.startsWith('accept_')) {
      const { data: registration } = await supabase
        .from("registrations")
        .select("id, registration_number, attendee_name, status")
        .eq("event_id", abstract.event_id)
        .ilike("attendee_email", abstract.presenting_author_email)
        .eq("status", "confirmed")
        .maybeSingle()

      registrationStatus = {
        is_registered: !!registration,
        registration_id: registration?.id,
        registration_number: registration?.registration_number,
      }

      // Update abstract with registration info
      if (registration) {
        await supabase
          .from("abstracts")
          .update({
            registration_id: registration.id,
            registration_verified: true,
            registration_verified_at: new Date().toISOString(),
          })
          .eq("id", id)
      }
    }

    // Log notification (actual sending handled by separate service)
    if (send_notification) {
      let notificationType = ''
      if (decision === 'second_review') {
        notificationType = 'second_review_requested'
      } else if (decision === 'reject') {
        notificationType = 'rejected'
      } else {
        notificationType = 'accepted'
      }

      await supabase
        .from("abstract_notifications")
        .insert({
          abstract_id: id,
          notification_type: notificationType,
          recipient_email: abstract.presenting_author_email,
          recipient_name: abstract.presenting_author_name,
          subject: `Abstract Decision: ${abstract.title}`,
          metadata: {
            decision,
            feedback: feedback_to_author,
          },
        })
    }

    return NextResponse.json({
      success: true,
      abstract: updatedAbstract,
      registration_status: registrationStatus,
      decision_logged: !logError,
    })
  } catch (error) {
    console.error("Error in committee decision:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/abstracts/[id]/committee-decision - Get decision history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    const supabase = await createAdminClient()

    const { data: decisions, error } = await supabase
      .from("abstract_committee_decisions")
      .select("*")
      .eq("abstract_id", id)
      .order("decided_at", { ascending: false })

    if (error) {
      console.error("Error fetching decisions:", error)
      return NextResponse.json({ error: "Failed to fetch decisions" }, { status: 500 })
    }

    return NextResponse.json({ decisions })
  } catch (error) {
    console.error("Error in GET committee decisions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
