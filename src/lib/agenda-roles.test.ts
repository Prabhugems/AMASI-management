import { describe, it, expect } from "vitest"
import {
  DEFAULT_ROSTERS,
  FACULTY_FREE_SESSION_TYPES,
  FACULTY_ROLES,
  KNOWN_SESSION_TYPES,
  defaultRosterFor,
  describeRole,
  describeRoster,
  formatRoleCount,
  isFacultyRole,
  normaliseSessionType,
} from "./agenda-roles"

describe("role vocabulary", () => {
  it("matches the six values the database CHECK allows", () => {
    // faculty_assignments_role_check, verified live 2026-08-07.
    expect([...FACULTY_ROLES].sort()).toEqual(
      ["chairperson", "discussant", "keynote", "moderator", "panelist", "speaker"].sort()
    )
  })

  it("rejects values the old code paths used to accept", () => {
    expect(isFacultyRole("co-chair")).toBe(false)
    expect(isFacultyRole("faculty")).toBe(false)
    expect(isFacultyRole("")).toBe(false)
    expect(isFacultyRole(null)).toBe(false)
  })

  it("pluralises role counts", () => {
    expect(formatRoleCount("chairperson", 1)).toBe("1 Chair")
    expect(formatRoleCount("chairperson", 2)).toBe("2 Chairs")
    expect(formatRoleCount("speaker", 3)).toBe("3 Speakers")
  })

  it("distinguishes chairing from presenting", () => {
    expect(describeRole("chairperson")).toBe("You are chairing")
    expect(describeRole("speaker")).toBe("You are presenting")
    expect(describeRole(null)).toBe("You are taking part")
  })
})

describe("normaliseSessionType", () => {
  it("folds the two spellings of exam", () => {
    // 15 rows say `exam`, 7 say `examination`. Same thing.
    expect(normaliseSessionType("examination")).toBe("exam")
    expect(normaliseSessionType("exam")).toBe("exam")
  })

  it("maps the Schedule editor's own type list onto the stored values", () => {
    expect(normaliseSessionType("hands_on")).toBe("workshop")
    expect(normaliseSessionType("inauguration")).toBe("ceremony")
    expect(normaliseSessionType("valedictory")).toBe("ceremony")
  })

  it("is tolerant of case and separators", () => {
    expect(normaliseSessionType("Live Surgery")).toBe("live_surgery")
    expect(normaliseSessionType("  LIVE-SURGERY ")).toBe("live_surgery")
  })

  it("returns null rather than guessing at an unknown type", () => {
    expect(normaliseSessionType("fireside_chat")).toBeNull()
    expect(normaliseSessionType(null)).toBeNull()
    expect(normaliseSessionType("")).toBeNull()
  })
})

describe("defaultRosterFor", () => {
  it("gives a symposium chairs and speakers", () => {
    expect(defaultRosterFor("symposium")).toEqual([
      { role: "speaker", required_count: 4 },
      { role: "chairperson", required_count: 2 },
    ])
  })

  it("gives a panel a moderator and panelists", () => {
    expect(defaultRosterFor("panel")).toEqual([
      { role: "moderator", required_count: 1 },
      { role: "panelist", required_count: 4 },
    ])
  })

  it("returns an empty roster for session types that need nobody", () => {
    for (const type of FACULTY_FREE_SESSION_TYPES) {
      expect(defaultRosterFor(type)).toEqual([])
    }
  })

  it("returns an empty roster for an unknown type instead of inheriting one", () => {
    // An unrecognised type must not silently pick up someone else's roster.
    expect(defaultRosterFor("fireside_chat")).toEqual([])
    expect(defaultRosterFor(null)).toEqual([])
  })

  it("applies aliases before looking up the roster", () => {
    expect(defaultRosterFor("hands_on")).toEqual(defaultRosterFor("workshop"))
  })

  it("only ever emits roles the database will accept", () => {
    for (const type of KNOWN_SESSION_TYPES) {
      for (const req of defaultRosterFor(type)) {
        expect(isFacultyRole(req.role)).toBe(true)
        expect(req.required_count).toBeGreaterThan(0)
      }
    }
  })

  it("covers every known session type, so none falls through silently", () => {
    for (const type of KNOWN_SESSION_TYPES) {
      expect(DEFAULT_ROSTERS[type]).toBeDefined()
    }
  })
})

describe("describeRoster", () => {
  it("summarises a roster in one line", () => {
    expect(describeRoster(defaultRosterFor("symposium"))).toBe("4 Speakers, 2 Chairs")
  })

  it("says so explicitly when nobody is required", () => {
    expect(describeRoster([])).toBe("No faculty required")
  })
})

describe("AMASICON 2026 coverage", () => {
  it("has a roster for all six session types that event uses", () => {
    // symposium 64, workshop 55, lecture 14, plenary 9, award 5, oration 3 = 150.
    const used = ["symposium", "workshop", "lecture", "plenary", "award", "oration"]
    for (const type of used) {
      expect(normaliseSessionType(type)).not.toBeNull()
      expect(defaultRosterFor(type).length).toBeGreaterThan(0)
    }
  })
})
