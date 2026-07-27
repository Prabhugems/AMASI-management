import { describe, it, expect } from "vitest"
import { matchDelegate, type CachedDelegate } from "./kiosk-delegate-match"

function delegate(overrides: Partial<CachedDelegate> = {}): CachedDelegate {
  return {
    id: "reg-1",
    registration_number: "REG-001",
    attendee_name: "Jane Doe",
    attendee_email: "jane@example.com",
    attendee_phone: "9876543210",
    attendee_designation: null,
    attendee_institution: null,
    ...overrides,
  }
}

describe("matchDelegate", () => {
  it("returns null for an empty query", () => {
    expect(matchDelegate([delegate()], "")).toBeNull()
    expect(matchDelegate([delegate()], "   ")).toBeNull()
  })

  it("returns null when nothing matches", () => {
    expect(matchDelegate([delegate()], "no-such-person")).toBeNull()
  })

  it("matches by exact registration number, case-insensitively", () => {
    const d = delegate()
    expect(matchDelegate([d], "reg-001")).toEqual(d)
  })

  it("matches by partial registration number", () => {
    const d = delegate({ registration_number: "124A1001" })
    expect(matchDelegate([d], "1001")).toEqual(d)
  })

  it("matches by email substring, case-insensitively", () => {
    const d = delegate()
    expect(matchDelegate([d], "JANE@EXAMPLE")).toEqual(d)
  })

  it("matches by name substring", () => {
    const d = delegate()
    expect(matchDelegate([d], "doe")).toEqual(d)
  })

  it("matches by phone substring", () => {
    const d = delegate()
    expect(matchDelegate([d], "654321")).toEqual(d)
  })

  it("prioritizes a registration-number match over a name match when both could apply", () => {
    const byNumber = delegate({ id: "reg-1", registration_number: "5551234" })
    const byName = delegate({ id: "reg-2", registration_number: "REG-002", attendee_name: "5551234 Ventures Rep" })
    expect(matchDelegate([byName, byNumber], "5551234")).toEqual(byNumber)
  })

  it("tolerates null phone/designation/institution without throwing", () => {
    const d = delegate({ attendee_phone: null })
    expect(matchDelegate([d], "doe")).toEqual(d)
  })
})
