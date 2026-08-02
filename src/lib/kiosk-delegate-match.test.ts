import { describe, it, expect } from "vitest"
import { matchDelegate, searchDelegates, type CachedDelegate } from "./kiosk-delegate-match"

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

describe("searchDelegates", () => {
  it("returns [] for a query under 2 characters", () => {
    expect(searchDelegates([delegate()], "")).toEqual([])
    expect(searchDelegates([delegate()], "j")).toEqual([])
  })

  it("returns [] when nothing matches", () => {
    expect(searchDelegates([delegate()], "no-such-person")).toEqual([])
  })

  it("returns every delegate whose name matches, not just the first", () => {
    const a = delegate({ id: "reg-1", attendee_name: "Jane Doe" })
    const b = delegate({ id: "reg-2", registration_number: "REG-002", attendee_name: "Jane Smith" })
    const results = searchDelegates([a, b], "jane")
    expect(results.map((d) => d.id).sort()).toEqual(["reg-1", "reg-2"])
  })

  it("prioritizes registration-number matches over name matches", () => {
    const byName = delegate({ id: "reg-1", registration_number: "REG-001", attendee_name: "5551234 Ventures Rep" })
    const byNumber = delegate({ id: "reg-2", registration_number: "5551234" })
    const results = searchDelegates([byName, byNumber], "5551234")
    expect(results[0].id).toBe("reg-2")
  })

  it("never returns the same delegate twice even if multiple fields match", () => {
    const d = delegate({ attendee_name: "9998887 Corp", registration_number: "9998887" })
    expect(searchDelegates([d], "9998887")).toEqual([d])
  })

  it("caps results at the given limit", () => {
    const delegates = Array.from({ length: 10 }, (_, i) =>
      delegate({ id: `reg-${i}`, registration_number: `REG-${i}`, attendee_name: `Jane Doe ${i}` })
    )
    expect(searchDelegates(delegates, "jane", 3)).toHaveLength(3)
  })

  it("tolerates null phone/designation/institution without throwing", () => {
    const d = delegate({ attendee_phone: null })
    expect(searchDelegates([d], "doe")).toEqual([d])
  })
})
