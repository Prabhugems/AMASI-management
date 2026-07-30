import { describe, it, expect } from "vitest"
import { deriveAgendaStatus, canSubmitForApproval, getLastApprovalTimestamp, type ApprovalLogRow } from "./agenda-approval-state"

describe("deriveAgendaStatus", () => {
  it("is draft when the log is empty", () => {
    expect(deriveAgendaStatus([])).toBe("draft")
  })

  it("is submitted after a submitted action", () => {
    const log: ApprovalLogRow[] = [{ action: "submitted", created_at: "2026-08-01T00:00:00.000Z" }]
    expect(deriveAgendaStatus(log)).toBe("submitted")
  })

  it("is approved after an approved action", () => {
    const log: ApprovalLogRow[] = [
      { action: "submitted", created_at: "2026-08-01T00:00:00.000Z" },
      { action: "approved", created_at: "2026-08-02T00:00:00.000Z" },
    ]
    expect(deriveAgendaStatus(log)).toBe("approved")
  })

  it("falls back to draft after changes_requested, even if approved earlier", () => {
    const log: ApprovalLogRow[] = [
      { action: "approved", created_at: "2026-08-01T00:00:00.000Z" },
      { action: "changes_requested", created_at: "2026-08-02T00:00:00.000Z" },
    ]
    expect(deriveAgendaStatus(log)).toBe("draft")
  })

  it("is published after a published action", () => {
    const log: ApprovalLogRow[] = [
      { action: "approved", created_at: "2026-08-01T00:00:00.000Z" },
      { action: "published", created_at: "2026-08-02T00:00:00.000Z" },
    ]
    expect(deriveAgendaStatus(log)).toBe("published")
  })

  it("uses the most recent row regardless of array order", () => {
    const log: ApprovalLogRow[] = [
      { action: "published", created_at: "2026-08-02T00:00:00.000Z" },
      { action: "approved", created_at: "2026-08-01T00:00:00.000Z" },
    ]
    expect(deriveAgendaStatus(log)).toBe("published")
  })
})

describe("canSubmitForApproval", () => {
  it("is true when there are no blocking conflicts", () => {
    expect(canSubmitForApproval([{ severity: "warning" }])).toBe(true)
    expect(canSubmitForApproval([])).toBe(true)
  })

  it("is false when any conflict is blocking", () => {
    expect(canSubmitForApproval([{ severity: "warning" }, { severity: "blocking" }])).toBe(false)
  })
})

describe("getLastApprovalTimestamp", () => {
  it("returns null when never approved or published", () => {
    const log: ApprovalLogRow[] = [{ action: "submitted", created_at: "2026-08-01T00:00:00.000Z" }]
    expect(getLastApprovalTimestamp(log)).toBeNull()
  })

  it("returns the timestamp of the most recent approved or published row", () => {
    const log: ApprovalLogRow[] = [
      { action: "approved", created_at: "2026-08-01T00:00:00.000Z" },
      { action: "published", created_at: "2026-08-03T00:00:00.000Z" },
      { action: "submitted", created_at: "2026-08-02T00:00:00.000Z" },
    ]
    expect(getLastApprovalTimestamp(log)).toBe("2026-08-03T00:00:00.000Z")
  })
})
