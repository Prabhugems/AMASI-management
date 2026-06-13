// Committee decision verb vocabulary, mirrored from the DB CHECK function
// `public.is_valid_committee_decision`. Both must move together.
// See migration `phase_1b_committee_decision_columns_and_shared_check`.

import type { AbstractStatus } from "./transitions"

export type CommitteeDecision =
  | "accept_oral"
  | "accept_poster"
  | "accept_video"
  | "second_review"
  | "reject"
  | "revision_requested"
  | "under_review"

const ALL_DECISIONS: ReadonlyArray<CommitteeDecision> = [
  "accept_oral",
  "accept_poster",
  "accept_video",
  "second_review",
  "reject",
  "revision_requested",
  "under_review",
]

export function isCommitteeDecision(value: unknown): value is CommitteeDecision {
  return typeof value === "string" && (ALL_DECISIONS as readonly string[]).includes(value)
}

export type CommitteeDecisionOutcome = {
  targetStatus: AbstractStatus
  // For accept_* decisions; null otherwise.
  acceptedAs: "oral" | "poster" | "video" | null
  // Workflow stage to write alongside status.
  workflowStage: "review" | "closed" | "scheduling"
  // Whether this decision bumps the review round (second_review only).
  bumpsReviewRound: boolean
}

// Map a committee verb to the resulting row state. Kept here (not in route
// code) so the mapping can't drift between routes that might call this in
// future (e.g. bulk committee-decision).
export function outcomeFor(decision: CommitteeDecision): CommitteeDecisionOutcome {
  switch (decision) {
    case "accept_oral":
      return { targetStatus: "accepted", acceptedAs: "oral", workflowStage: "scheduling", bumpsReviewRound: false }
    case "accept_poster":
      return { targetStatus: "accepted", acceptedAs: "poster", workflowStage: "scheduling", bumpsReviewRound: false }
    case "accept_video":
      return { targetStatus: "accepted", acceptedAs: "video", workflowStage: "scheduling", bumpsReviewRound: false }
    case "second_review":
      return { targetStatus: "under_review", acceptedAs: null, workflowStage: "review", bumpsReviewRound: true }
    case "reject":
      return { targetStatus: "rejected", acceptedAs: null, workflowStage: "closed", bumpsReviewRound: false }
    case "revision_requested":
      return { targetStatus: "revision_requested", acceptedAs: null, workflowStage: "review", bumpsReviewRound: false }
    case "under_review":
      // Override target only: park back into the review queue without
      // bumping the round (which would re-clear assignments).
      return { targetStatus: "under_review", acceptedAs: null, workflowStage: "review", bumpsReviewRound: false }
  }
}
