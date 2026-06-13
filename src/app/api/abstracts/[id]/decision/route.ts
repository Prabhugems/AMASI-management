import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { claimIdempotency } from "@/lib/idempotency"
import { canTransition, isAbstractStatus, type AbstractStatus } from "@/lib/abstracts/transitions"
import { NextRequest, NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// Initial-decision vocabulary. "redirected" is a meta-action that lands as
// status='accepted' with a category swap; the others map 1:1 to status.
type InitialDecisionVerb =
  | "accepted"
  | "rejected"
  | "revision_requested"
  | "under_review"
  | "redirected"

const VALID_INITIAL_DECISIONS: ReadonlyArray<InitialDecisionVerb> = [
  "accepted",
  "rejected",
  "revision_requested",
  "under_review",
  "redirected",
]

function isInitialDecision(value: unknown): value is InitialDecisionVerb {
  return typeof value === "string" && (VALID_INITIAL_DECISIONS as readonly string[]).includes(value)
}

// Map an initial-decision verb to the resulting `abstracts.status`. Used by
// canTransition() — keep this in sync with the bulk handler below.
function targetStatusFor(decision: InitialDecisionVerb): AbstractStatus {
  if (decision === "redirected") return "accepted"
  return decision
}

// PUT /api/abstracts/[id]/decision - Make acceptance decision
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const adminClient: SupabaseClient = await createAdminClient()
    const body = await request.json()

    if (!body.decision) {
      return NextResponse.json(
        { error: "decision is required (accepted, rejected, revision_requested)" },
        { status: 400 }
      )
    }
    if (!isInitialDecision(body.decision)) {
      return NextResponse.json(
        { error: `Invalid decision. Must be one of: ${VALID_INITIAL_DECISIONS.join(", ")}` },
        { status: 400 }
      )
    }

    const { data: abstract, error: fetchError } = await adminClient
      .from("abstracts")
      .select("*, event_id")
      .eq("id", id)
      .single()

    if (fetchError || !abstract) {
      return NextResponse.json({ error: "Abstract not found" }, { status: 404 })
    }

    const { error: permError } = await requireEventAndPermission(abstract.event_id, "abstracts")
    if (permError) return permError

    // Transition gate. Shared with committee-decision via canTransition().
    const currentStatus = isAbstractStatus(abstract.status) ? abstract.status : null
    if (!currentStatus) {
      return NextResponse.json(
        { error: `Abstract is in an unknown status (${abstract.status}); cannot transition` },
        { status: 422 }
      )
    }
    const targetStatus = targetStatusFor(body.decision)
    const transition = canTransition(currentStatus, targetStatus, {
      notified: Boolean(abstract.decision_notified_at),
      forceRedecide: Boolean(body.force_redecide),
      overrideReason: body.override_reason ?? null,
    })
    if (!transition.ok) {
      return NextResponse.json({ error: transition.error }, { status: transition.status })
    }

    // Idempotency: claim only after gates pass.
    const idemKey = request.headers.get("idempotency-key")
    const idemEndpoint = `decision:${id}`
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

    const decidedAt = new Date().toISOString()

    // Handle "Redirect to Free Session" decision
    if (body.decision === "redirected") {
      const { data: freeCategory } = await adminClient
        .from("abstract_categories")
        .select("id")
        .eq("event_id", abstract.event_id)
        .eq("is_award_category", false)
        .eq("is_active", true)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!freeCategory) {
        await claim.release()
        return NextResponse.json(
          { error: "No free session category found. Please create a non-award category first." },
          { status: 400 }
        )
      }

      const { data: redirectedData, error: redirectError } = await adminClient
        .from("abstracts")
        .update({
          status: "accepted",
          decision_date: decidedAt,
          decision_notes: body.decision_notes || "Redirected to free session",
          redirected_from_category_id: abstract.category_id,
          category_id: freeCategory.id,
          accepted_as: body.accepted_as || abstract.presentation_type || "oral",
        })
        .eq("id", id)
        .select()
        .single()

      if (redirectError) {
        console.error("Error redirecting abstract:", redirectError)
        await claim.release()
        return NextResponse.json({ error: "Failed to redirect abstract" }, { status: 500 })
      }

      await claim.commit(200, redirectedData)
      return NextResponse.json(redirectedData)
    }

    // Build update payload for non-redirect decisions
    const updateData: Record<string, unknown> = {
      status: body.decision,
      decision_date: decidedAt,
    }

    if (body.decision_notes !== undefined) {
      updateData.decision_notes = body.decision_notes
    }
    if (body.decision === "accepted" && body.accepted_as) {
      updateData.accepted_as = body.accepted_as
    }
    if (body.decision === "revision_requested") {
      updateData.accepted_as = null
    }

    const { data, error } = await adminClient
      .from("abstracts")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating abstract decision:", error)
      await claim.release()
      return NextResponse.json({ error: "Failed to update decision" }, { status: 500 })
    }

    await claim.commit(200, data)
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in PUT /api/abstracts/[id]/decision:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/abstracts/[id]/decision - Bulk decision for multiple abstracts.
// Transition gate runs per-row so partial-legal batches are reported, not
// silently let through.
export async function POST(
  request: NextRequest,
  { params: _params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminClient: SupabaseClient = await createAdminClient()
    const body = await request.json()

    if (!body.abstract_ids || !Array.isArray(body.abstract_ids) || body.abstract_ids.length === 0) {
      return NextResponse.json({ error: "abstract_ids array is required" }, { status: 400 })
    }
    if (!body.decision) {
      return NextResponse.json({ error: "decision is required" }, { status: 400 })
    }
    if (!isInitialDecision(body.decision)) {
      return NextResponse.json(
        { error: `Invalid decision. Must be one of: ${VALID_INITIAL_DECISIONS.join(", ")}` },
        { status: 400 }
      )
    }

    if (body.decision === "accepted" && body.accepted_as) {
      const validAcceptedAs = ["oral", "poster", "video"]
      if (!validAcceptedAs.includes(body.accepted_as)) {
        return NextResponse.json(
          { error: `Invalid accepted_as value. Must be one of: ${validAcceptedAs.join(", ")}` },
          { status: 400 }
        )
      }
    }

    // Fetch all abstracts upfront so we can run per-row transition checks
    // BEFORE writing anything.
    const { data: abstracts, error: fetchError } = await adminClient
      .from("abstracts")
      .select("id, event_id, category_id, presentation_type, status, decision_notified_at")
      .in("id", body.abstract_ids)

    if (fetchError || !abstracts || abstracts.length === 0) {
      return NextResponse.json({ error: "No abstracts found for the provided IDs" }, { status: 404 })
    }
    if (abstracts.length !== body.abstract_ids.length) {
      return NextResponse.json({ error: "Some abstract IDs were not found" }, { status: 404 })
    }

    const eventIds = new Set(abstracts.map((a: any) => a.event_id))
    if (eventIds.size > 1) {
      return NextResponse.json(
        { error: "All abstracts must belong to the same event for bulk decisions" },
        { status: 400 }
      )
    }

    const { error: permError } = await requireEventAndPermission(abstracts[0].event_id, "abstracts")
    if (permError) return permError

    // Per-row transition check. If ANY row would be an illegal transition
    // (or a re-decide without force_redecide), reject the whole batch — the
    // safer all-or-nothing semantic for a curl-bypass-able admin tool.
    const targetStatus = targetStatusFor(body.decision)
    const blockedRows: { id: string; reason: string }[] = []
    for (const a of abstracts) {
      if (!isAbstractStatus(a.status)) {
        blockedRows.push({ id: a.id, reason: `unknown status: ${a.status}` })
        continue
      }
      const t = canTransition(a.status, targetStatus, {
        notified: Boolean(a.decision_notified_at),
        forceRedecide: Boolean(body.force_redecide),
        overrideReason: body.override_reason ?? null,
      })
      if (!t.ok) blockedRows.push({ id: a.id, reason: t.error })
    }
    if (blockedRows.length > 0) {
      return NextResponse.json(
        {
          error: "Bulk decision rejected: one or more rows would violate transition rules",
          blocked: blockedRows,
        },
        { status: 422 }
      )
    }

    // Idempotency on the bulk call.
    const idemKey = request.headers.get("idempotency-key")
    const idemEndpoint = `decision:bulk:${abstracts[0].event_id}`
    const claim = await claimIdempotency(idemEndpoint, idemKey, body)
    if (claim.kind === "cached") {
      return NextResponse.json(claim.body, { status: claim.status })
    }
    if (claim.kind === "in_progress") {
      return NextResponse.json(
        { error: "A bulk decision with this Idempotency-Key is already being processed" },
        { status: 409 }
      )
    }
    if (claim.kind === "key_conflict") {
      return NextResponse.json(
        { error: "This Idempotency-Key was used for a different request body" },
        { status: 422 }
      )
    }

    const decidedAt = new Date().toISOString()

    // Bulk redirect: per-row update to preserve each abstract's original
    // category_id. Failures surface, don't get swallowed.
    if (body.decision === "redirected") {
      const eventId = abstracts[0].event_id
      const { data: freeCategory } = await adminClient
        .from("abstract_categories")
        .select("id")
        .eq("event_id", eventId)
        .eq("is_award_category", false)
        .eq("is_active", true)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!freeCategory) {
        await claim.release()
        return NextResponse.json(
          { error: "No free session category found. Please create a non-award category first." },
          { status: 400 }
        )
      }

      const results: unknown[] = []
      const failures: { id: string; error: string }[] = []
      for (const abstract of abstracts) {
        const { data: updated, error: updateErr } = await adminClient
          .from("abstracts")
          .update({
            status: "accepted",
            decision_date: decidedAt,
            decision_notes: body.decision_notes || "Redirected to free session",
            redirected_from_category_id: abstract.category_id,
            category_id: freeCategory.id,
            accepted_as: body.accepted_as || abstract.presentation_type || "oral",
          })
          .eq("id", abstract.id)
          .select()
          .single()

        if (updateErr) {
          console.error(`Error redirecting abstract ${abstract.id}:`, updateErr)
          failures.push({ id: abstract.id, error: updateErr.message })
        } else {
          results.push(updated)
        }
      }

      const responseBody = {
        success: failures.length === 0,
        updated: results.length,
        failed: failures.length,
        failures: failures.length > 0 ? failures : undefined,
        abstracts: results,
      }
      await claim.commit(200, responseBody)
      return NextResponse.json(responseBody)
    }

    // Non-redirect bulk: single UPDATE … IN (…).
    const updateData: Record<string, unknown> = {
      status: body.decision,
      decision_date: decidedAt,
    }
    if (body.decision_notes !== undefined) {
      updateData.decision_notes = body.decision_notes
    }
    if (body.decision === "accepted" && body.accepted_as) {
      updateData.accepted_as = body.accepted_as
    }

    const { data, error } = await adminClient
      .from("abstracts")
      .update(updateData)
      .in("id", body.abstract_ids)
      .select()

    if (error) {
      console.error("Error bulk updating abstract decisions:", error)
      await claim.release()
      return NextResponse.json({ error: "Failed to update decisions" }, { status: 500 })
    }

    const responseBody = {
      success: true,
      updated: data?.length || 0,
      abstracts: data,
    }
    await claim.commit(200, responseBody)
    return NextResponse.json(responseBody)
  } catch (error) {
    console.error("Error in POST /api/abstracts/[id]/decision:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
