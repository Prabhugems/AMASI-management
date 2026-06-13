import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { claimIdempotency } from "@/lib/idempotency"
import { isCommitteeDecision, outcomeFor } from "@/lib/abstracts/committee-decision"
import { canTransition, isAbstractStatus } from "@/lib/abstracts/transitions"
import { NextRequest, NextResponse } from "next/server"

// POST /api/abstracts/[id]/committee-decision
//
// Timestamp model (see Phase 2 notes):
//   - decision_date          = wall-clock of CURRENT decision (any route).
//                              Drives author-facing "Decision dated X".
//                              Updated on every (re-)decision here.
//   - committee_decision_at  = wall-clock of latest COMMITTEE-specific action.
//                              Updated on every write here. NULL if abstract
//                              was only ever touched by PUT /decision.
//   - decision_notified_at   = wall-clock the AUTHOR was notified.
//                              Set only on a real notification-send success.
//                              The re-decide gate keys off this being non-null.
//
// Idempotency: a double-clicked Record Decision must not fire two author
// notifications or write two audit rows. Caller passes Idempotency-Key
// header; we reuse the Phase B claimIdempotency helper.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const {
      decision,
      notes,
      second_review_reason,
      second_review_instructions,
      rejection_reason,
      feedback_to_author,
      send_notification = true,
      force_redecide = false,
      override_reason,
    } = body as {
      decision?: unknown
      notes?: string | null
      second_review_reason?: string | null
      second_review_instructions?: string | null
      rejection_reason?: string | null
      feedback_to_author?: string | null
      send_notification?: boolean
      force_redecide?: boolean
      override_reason?: string | null
    }

    if (!decision) {
      return NextResponse.json({ error: "Decision is required" }, { status: 400 })
    }
    if (!isCommitteeDecision(decision)) {
      return NextResponse.json({ error: "Invalid decision" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Fetch the abstract first so we have current state for the transition
    // check before we ever touch idempotency or write.
    const { data: abstract, error: fetchError } = await (supabase as any)
      .from("abstracts")
      .select("*, event_id, presenting_author_email, presenting_author_name")
      .eq("id", id)
      .single()

    if (fetchError || !abstract) {
      return NextResponse.json({ error: "Abstract not found" }, { status: 404 })
    }

    const { user, error: authError } = await requireEventAndPermission(abstract.event_id, "abstracts")
    if (!user || authError) {
      return authError || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Transition gate. Server-side enforcement is the wall; curl-bypass closed.
    const currentStatus = isAbstractStatus(abstract.status) ? abstract.status : null
    if (!currentStatus) {
      return NextResponse.json(
        { error: `Abstract is in an unknown status (${abstract.status}); cannot transition` },
        { status: 422 }
      )
    }
    const outcome = outcomeFor(decision)
    const transition = canTransition(currentStatus, outcome.targetStatus, {
      notified: Boolean(abstract.decision_notified_at),
      forceRedecide: force_redecide,
      overrideReason: override_reason ?? null,
    })
    if (!transition.ok) {
      return NextResponse.json({ error: transition.error }, { status: transition.status })
    }

    // Idempotency only after gates pass — don't burn slots on rejected calls.
    const idemKey = request.headers.get("idempotency-key")
    const idemEndpoint = `committee-decision:${id}`
    const claim = await claimIdempotency(idemEndpoint, idemKey, body)
    if (claim.kind === "cached") {
      return NextResponse.json(claim.body, { status: claim.status })
    }
    if (claim.kind === "in_progress") {
      return NextResponse.json(
        { error: "A decision with this Idempotency-Key is already being processed" },
        { status: 409 }
      )
    }
    if (claim.kind === "key_conflict") {
      return NextResponse.json(
        { error: "This Idempotency-Key was used for a different request body" },
        { status: 422 }
      )
    }

    // Resolve committee identity from team_members.
    const { data: committeeMember } = await (supabase as any)
      .from("team_members")
      .select("id, name, email")
      .eq("email", user.email?.toLowerCase())
      .eq("is_active", true)
      .contains("event_ids", [abstract.event_id])
      .in("role", ["admin", "coordinator", "committee_member"])
      .maybeSingle()

    const decidedAt = new Date().toISOString()

    // Build update payload from the shared decision→outcome mapping. No
    // route-local switch; outcomeFor() owns the verb→state map.
    const updateData: Record<string, unknown> = {
      committee_decision: decision,
      committee_decision_by: committeeMember?.id ?? null,
      committee_decision_at: decidedAt,
      decision_notes: notes ?? null,
      decision_date: decidedAt,
      status: outcome.targetStatus,
      workflow_stage: outcome.workflowStage,
      updated_at: decidedAt,
    }
    if (outcome.acceptedAs) {
      updateData.accepted_as = outcome.acceptedAs
    }
    if (outcome.bumpsReviewRound) {
      updateData.review_round = (abstract.review_round || 1) + 1
      updateData.second_review_reason = second_review_reason ?? null
    }

    const { data: updatedAbstract, error: updateError } = await (supabase as any)
      .from("abstracts")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating abstract:", updateError)
      await claim.release()
      return NextResponse.json({ error: "Failed to update abstract" }, { status: 500 })
    }

    // Audit log. is_override + override_reason flow from the SAME
    // TransitionResult so they can't diverge from the DB CHECK
    // (is_override = false OR override_reason IS NOT NULL).
    const auditRow: Record<string, unknown> = {
      abstract_id: id,
      decision,
      decided_by: committeeMember?.id ?? null,
      decided_by_name: committeeMember?.name || user.email || "unknown",
      decided_by_email: committeeMember?.email || user.email?.toLowerCase() || null,
      review_round: abstract.review_round || 1,
      second_review_reason: second_review_reason ?? null,
      second_review_instructions: second_review_instructions ?? null,
      rejection_reason: rejection_reason ?? null,
      feedback_to_author: feedback_to_author ?? null,
      notes: notes ?? null,
      is_override: transition.isOverride,
      override_reason: transition.isOverride ? transition.overrideReason : null,
    }
    const { error: logError } = await (supabase as any)
      .from("abstract_committee_decisions")
      .insert(auditRow)

    if (logError) {
      console.error("Error logging decision:", logError)
    }

    // Second-review housekeeping: park existing assignments so the next round
    // gets fresh ones.
    if (outcome.bumpsReviewRound) {
      await (supabase as any)
        .from("abstract_review_assignments")
        .update({ status: "completed" })
        .eq("abstract_id", id)
        .eq("review_round", abstract.review_round || 1)
    }

    // Registration linking on accept (writes now land — registration_verified*
    // are real columns post Phase 1b).
    let registrationStatus = null
    if (outcome.targetStatus === "accepted") {
      const { data: registration } = await (supabase as any)
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

      if (registration) {
        await (supabase as any)
          .from("abstracts")
          .update({
            registration_id: registration.id,
            registration_verified: true,
            registration_verified_at: new Date().toISOString(),
          })
          .eq("id", id)
      }
    }

    // Notification ledger insert. The real send is wired in Phase 3 — this
    // row is currently a record of intent, not delivery.
    if (send_notification) {
      let notificationType = "accepted"
      if (outcome.targetStatus === "rejected") notificationType = "rejected"
      else if (outcome.bumpsReviewRound) notificationType = "second_review_requested"
      else if (outcome.targetStatus === "revision_requested") notificationType = "revision_requested"

      await (supabase as any)
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
            is_override: transition.isOverride,
          },
        })
    }

    const responseBody = {
      success: true,
      abstract: updatedAbstract,
      registration_status: registrationStatus,
      decision_logged: !logError,
      is_override: transition.isOverride,
    }
    await claim.commit(200, responseBody)
    return NextResponse.json(responseBody)
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
    const { id } = await params

    const supabase = await createAdminClient()

    const { data: abstractRecord } = await (supabase as any)
      .from("abstracts")
      .select("event_id")
      .eq("id", id)
      .single()

    if (!abstractRecord) {
      return NextResponse.json({ error: "Abstract not found" }, { status: 404 })
    }

    const { error: authError } = await requireEventAndPermission(abstractRecord.event_id, "abstracts")
    if (authError) {
      return authError
    }

    const { data: decisions, error } = await (supabase as any)
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
