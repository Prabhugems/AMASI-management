// Pure derivation of the Agenda Builder's approval/publish lifecycle state
// from an append-only log (agenda_approval_log). See docs/superpowers/specs/
// 2026-07-30-agenda-builder-data-model-design.md, section 7. No database
// access -- the caller (API route) fetches the log rows and passes them in.

export interface ApprovalLogRow {
  action: "submitted" | "approved" | "changes_requested" | "published"
  created_at: string
}

export type AgendaStatus = "draft" | "submitted" | "approved" | "published"

function mostRecent(log: ApprovalLogRow[]): ApprovalLogRow | null {
  if (log.length === 0) return null
  return [...log].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
}

export function deriveAgendaStatus(log: ApprovalLogRow[]): AgendaStatus {
  const latest = mostRecent(log)
  if (!latest) return "draft"
  switch (latest.action) {
    case "submitted":
      return "submitted"
    case "approved":
      return "approved"
    case "published":
      return "published"
    case "changes_requested":
      return "draft"
  }
}

export function canSubmitForApproval(conflicts: { severity: "blocking" | "warning" }[]): boolean {
  return !conflicts.some((c) => c.severity === "blocking")
}

export function getLastApprovalTimestamp(log: ApprovalLogRow[]): string | null {
  const approvalRows = log.filter((row) => row.action === "approved" || row.action === "published")
  const latest = mostRecent(approvalRows)
  return latest ? latest.created_at : null
}
