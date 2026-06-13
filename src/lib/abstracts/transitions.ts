// Single source of truth for legal status transitions on `abstracts.status`.
//
// Both decision routes (`PUT /api/abstracts/[id]/decision` and
// `POST /api/abstracts/[id]/committee-decision`) call canTransition() before
// writing. Don't duplicate per-route — the brief specifically called out
// "implement it as a single canTransition() function both decision routes
// call — not duplicated per-route logic, or they'll drift."
//
// The matrix here mirrors the one accepted in Phase 0. Author-side resubmit
// (revision_requested → submitted) belongs to the submit-abstract route, not
// here, so this matrix omits that edge.

export type AbstractStatus =
  | "submitted"
  | "under_review"
  | "revision_requested"
  | "accepted"
  | "rejected"
  | "withdrawn"

const ALL_STATUSES: ReadonlyArray<AbstractStatus> = [
  "submitted",
  "under_review",
  "revision_requested",
  "accepted",
  "rejected",
  "withdrawn",
]

export function isAbstractStatus(value: unknown): value is AbstractStatus {
  return typeof value === "string" && (ALL_STATUSES as readonly string[]).includes(value)
}

// Legal transitions. Self-loops (e.g. under_review → under_review for a
// second-review round bump) are listed where they're meaningful — committee
// can re-queue an under_review abstract for another round.
const MATRIX: Readonly<Record<AbstractStatus, ReadonlySet<AbstractStatus>>> = {
  submitted:           new Set(["under_review", "revision_requested", "accepted", "rejected", "withdrawn"]),
  under_review:        new Set(["under_review", "revision_requested", "accepted", "rejected", "withdrawn"]),
  revision_requested:  new Set(["under_review", "accepted", "rejected", "withdrawn"]),
  accepted:            new Set(["withdrawn"]),
  rejected:            new Set(["under_review"]),
  withdrawn:           new Set([]),
}

export type TransitionContext = {
  // True when the author has already been notified of the current decision.
  // Sourced from `abstracts.decision_notified_at IS NOT NULL`.
  notified?: boolean
  // Set when the caller explicitly opts into overriding a notified decision.
  forceRedecide?: boolean
  // Required when forceRedecide is true. Written to the audit log atomically
  // with is_override so the DB CHECK and the route can't diverge.
  overrideReason?: string | null
}

export type TransitionResult =
  | { ok: true; isOverride: false }
  | { ok: true; isOverride: true; overrideReason: string }
  | { ok: false; status: number; error: string }

// Decide whether `from → to` is legal under the matrix, gated by the
// notified/override rules.
//
// Rules:
//   1. Transition must exist in the matrix.
//   2. If the author has been notified, the caller must pass
//      forceRedecide=true AND a non-empty overrideReason. Anything else is
//      rejected with HTTP 409. The audit row gets is_override=true and the
//      reason in the same call.
//   3. If not notified, no override required — normal transition.
//
// The "same code path" rule: both is_override and override_reason flow from
// the same TransitionResult so they can't diverge from the DB CHECK
// (abstract_committee_decisions: is_override = false OR override_reason IS NOT NULL).
export function canTransition(
  from: AbstractStatus,
  to: AbstractStatus,
  ctx: TransitionContext = {}
): TransitionResult {
  const allowedTargets = MATRIX[from]
  if (!allowedTargets || !allowedTargets.has(to)) {
    return {
      ok: false,
      status: 422,
      error: `Illegal transition: ${from} → ${to}`,
    }
  }

  if (ctx.notified) {
    if (!ctx.forceRedecide) {
      return {
        ok: false,
        status: 409,
        error:
          "Author has already been notified. To change the decision, pass force_redecide:true with a non-empty override_reason.",
      }
    }
    const reason = (ctx.overrideReason ?? "").trim()
    if (!reason) {
      return {
        ok: false,
        status: 422,
        error: "override_reason is required when force_redecide is true.",
      }
    }
    return { ok: true, isOverride: true, overrideReason: reason }
  }

  return { ok: true, isOverride: false }
}
