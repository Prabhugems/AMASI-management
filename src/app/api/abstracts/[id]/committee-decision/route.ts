import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { claimIdempotency } from "@/lib/idempotency"
import { isCommitteeDecision, outcomeFor } from "@/lib/abstracts/committee-decision"
import { canTransition, isAbstractStatus } from "@/lib/abstracts/transitions"
import { sendAndLogAbstractNotification } from "@/lib/abstracts/notify"
import { buildAbstractVariables, type TemplateType } from "@/lib/email-templates"
import { isEmailEnabled } from "@/lib/email"
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

    // Sync-send to the author. Phase 3: this replaces the old write-only
    // intent insert. Failure here MUST NOT roll back the decision — the
    // decision is already persisted; an unsent email is a separate problem.
    // decision_notified_at is bumped only if delivery actually succeeds.
    let notification: { delivered: boolean; error?: string; notificationId?: string | null } = {
      delivered: false,
    }
    if (send_notification) {
      // Per-event gate. notify_on_decision being false is a deliberate
      // "don't email authors" choice (e.g. paper conferences, internal pilots).
      const { data: settings } = await (supabase as any)
        .from("abstract_settings")
        .select("notify_on_decision")
        .eq("event_id", abstract.event_id)
        .maybeSingle()

      const notifyEnabled = settings?.notify_on_decision !== false
      const emailEnabled = isEmailEnabled()

      if (notifyEnabled && emailEnabled) {
        // Pick template + notification_type. Some verbs have no dedicated
        // template (second_review_requested, under_review-as-override); for
        // those we still send, just on the fallback HTML.
        let templateType: TemplateType = "abstract_accepted"
        let notificationType = "accepted"
        if (outcome.targetStatus === "rejected") {
          templateType = "abstract_rejected"
          notificationType = "rejected"
        } else if (outcome.bumpsReviewRound) {
          templateType = "abstract_revision" // closest existing template; fallback below covers gap
          notificationType = "second_review_requested"
        } else if (outcome.targetStatus === "revision_requested") {
          templateType = "abstract_revision"
          notificationType = "revision_requested"
        }

        // Fetch event + category for template variables.
        const { data: eventRow } = await (supabase as any)
          .from("events")
          .select("id, name, short_name, start_date, city, contact_email")
          .eq("id", abstract.event_id)
          .single()
        const { data: categoryRow } = abstract.category_id
          ? await (supabase as any)
              .from("abstract_categories")
              .select("name")
              .eq("id", abstract.category_id)
              .maybeSingle()
          : { data: null }

        const portalUrl = `${(process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "")}/my`
        const variables = buildAbstractVariables(
          {
            abstract_number: updatedAbstract.abstract_number,
            title: updatedAbstract.title,
            status: updatedAbstract.status,
            decision,
            accepted_as: updatedAbstract.accepted_as,
            decision_notes: notes ?? null,
            presenting_author_name: abstract.presenting_author_name,
            presenting_author_email: abstract.presenting_author_email,
            category_name: categoryRow?.name ?? null,
          },
          {
            name: eventRow?.name ?? "Event",
            short_name: eventRow?.short_name ?? null,
            start_date: eventRow?.start_date ?? null,
            city: eventRow?.city ?? null,
          },
          portalUrl,
          eventRow?.contact_email ?? null
        )

        const eventName = eventRow?.short_name || eventRow?.name || "Event"
        const fallbackSubject =
          notificationType === "rejected"
            ? `Abstract Decision — ${eventName}`
            : notificationType === "revision_requested"
              ? `Revision Requested — ${eventName}`
              : notificationType === "second_review_requested"
                ? `Second Review — ${eventName}`
                : `Abstract Accepted — ${eventName}`
        const fallbackHtml = buildDecisionFallbackHtml({
          abstract: updatedAbstract,
          authorName: abstract.presenting_author_name,
          eventName,
          notificationType,
          notes: notes ?? null,
          feedbackToAuthor: feedback_to_author ?? null,
        })

        notification = await sendAndLogAbstractNotification({
          supabase,
          abstractId: id,
          eventId: abstract.event_id,
          recipientEmail: abstract.presenting_author_email,
          recipientName: abstract.presenting_author_name,
          templateType,
          notificationType,
          templateVariables: variables,
          fallbackSubject,
          fallbackHtml,
          metadata: {
            decision,
            feedback_to_author,
            is_override: transition.isOverride,
          },
          sentBy: committeeMember?.id ?? null,
        })

        if (notification.delivered) {
          // Bump decision_notified_at ONLY on real send success.
          // Failure leaves the field NULL so a manual resend (or the next
          // bulk/notify pass) can pick it up.
          await (supabase as any)
            .from("abstracts")
            .update({ decision_notified_at: new Date().toISOString() })
            .eq("id", id)
        }
      } else {
        notification = {
          delivered: false,
          error: !emailEnabled
            ? "email provider not configured"
            : "notify_on_decision is disabled for this event",
        }
      }
    }

    const responseBody = {
      success: true,
      abstract: updatedAbstract,
      registration_status: registrationStatus,
      decision_logged: !logError,
      is_override: transition.isOverride,
      notification: send_notification
        ? { delivered: notification.delivered, error: notification.error }
        : { delivered: false, skipped: true },
    }
    await claim.commit(200, responseBody)
    return NextResponse.json(responseBody)
  } catch (error) {
    console.error("Error in committee decision:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Fallback HTML when no event-scoped template exists. Kept simple — the
// expected path is for the event admin to configure a template; this is
// defensive so a missing template doesn't mean no email.
function buildDecisionFallbackHtml(input: {
  abstract: { abstract_number: string; title: string; accepted_as?: string | null }
  authorName: string
  eventName: string
  notificationType: string
  notes: string | null
  feedbackToAuthor: string | null
}): string {
  const acceptedAs = input.abstract.accepted_as
    ? ` as a <strong>${input.abstract.accepted_as.toUpperCase()}</strong> presentation`
    : ""
  const heading =
    input.notificationType === "rejected"
      ? `After committee review, your abstract was not selected for presentation.`
      : input.notificationType === "revision_requested"
        ? `The committee has requested revisions to your abstract.`
        : input.notificationType === "second_review_requested"
          ? `Your abstract has been queued for a second review round.`
          : `Congratulations — your abstract has been accepted${acceptedAs}.`
  const notesBlock = input.notes
    ? `<p><strong>Committee notes:</strong></p><p>${escapeHtml(input.notes)}</p>`
    : ""
  const feedbackBlock = input.feedbackToAuthor
    ? `<p><strong>Feedback to author:</strong></p><p>${escapeHtml(input.feedbackToAuthor)}</p>`
    : ""
  return `<!doctype html><html><body style="font-family:-apple-system,sans-serif;line-height:1.6;color:#1f2937;max-width:600px;margin:0 auto;padding:20px">
    <h2>${escapeHtml(input.eventName)}</h2>
    <p>Dear ${escapeHtml(input.authorName)},</p>
    <p>Re: <strong>${escapeHtml(input.abstract.abstract_number)}</strong> — ${escapeHtml(input.abstract.title)}</p>
    <p>${heading}</p>
    ${notesBlock}
    ${feedbackBlock}
    <p>You can view your submission status in your author portal.</p>
    <p style="color:#6b7280;font-size:13px">— The ${escapeHtml(input.eventName)} Organizing Committee</p>
  </body></html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
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
