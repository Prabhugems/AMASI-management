import { describe, it, expect } from "vitest"
import {
  buildNameMatcher,
  describeRole,
  matchFacultySessions,
  presentingSessionIds,
  primaryRoleBySession,
  sessionIdsForRole,
  stripTitle,
  type MatchableAssignment,
  type MatchableSession,
} from "./faculty-session-match"

const session = (over: Partial<MatchableSession> & { id: string }): MatchableSession => ({
  speakers: null,
  chairpersons: null,
  moderators: null,
  speakers_text: null,
  chairpersons_text: null,
  moderators_text: null,
  description: null,
  ...over,
})

const assignment = (over: Partial<MatchableAssignment>): MatchableAssignment => ({
  session_id: "s1",
  faculty_email: null,
  faculty_name: null,
  role: null,
  ...over,
})

describe("stripTitle", () => {
  it("drops common honorifics", () => {
    expect(stripTitle("Dr. Anitha Ravindran")).toBe("Anitha Ravindran")
    expect(stripTitle("Prof Venkat Subramanian")).toBe("Venkat Subramanian")
    expect(stripTitle("Smt. Latha Narayanan")).toBe("Latha Narayanan")
  })

  it("leaves an untitled name alone", () => {
    expect(stripTitle("Anitha Ravindran")).toBe("Anitha Ravindran")
  })
})

describe("buildNameMatcher", () => {
  it("refuses single-token names, which are too collision-prone", () => {
    // The reported failure mode: "Dr Rao" must never match "Dr Raghava Rao".
    expect(buildNameMatcher("Dr Rao")).toBeNull()
    expect(buildNameMatcher("Rao")).toBeNull()
    expect(buildNameMatcher("")).toBeNull()
    expect(buildNameMatcher(null)).toBeNull()
  })

  it("matches on a word boundary, not a bare substring", () => {
    const m = buildNameMatcher("Dr. Hari Prasad")!
    expect(m.test("Hari Prasad, Meera Kulkarni")).toBe(true)
    expect(m.test("Dr. Hari Prasad")).toBe(true)
    // "Hari Prasad" must not be found inside a longer single token.
    expect(m.test("Hari Prasadan")).toBe(false)
    expect(m.test("XHari Prasad")).toBe(false)
  })

  it("tolerates extra whitespace between name parts", () => {
    const m = buildNameMatcher("Anitha Ravindran")!
    expect(m.test("Anitha  Ravindran")).toBe(true)
  })

  it("is case-insensitive", () => {
    const m = buildNameMatcher("Anitha Ravindran")!
    expect(m.test("ANITHA RAVINDRAN")).toBe(true)
  })

  it("treats regex metacharacters in a name as literals", () => {
    const m = buildNameMatcher("Dr. P. Rajagopal")!
    expect(m.test("P. Rajagopal")).toBe(true)
    expect(m.test("PXRajagopal")).toBe(false)
  })

  it("stays linear on a pathological haystack", () => {
    const m = buildNameMatcher("Anitha Ravindran")!
    const start = performance.now()
    m.test(" ".repeat(50_000))
    expect(performance.now() - start).toBeLessThan(100)
  })
})

describe("matchFacultySessions — the 127 FMAS chairperson bug", () => {
  // A chairperson of a 3-talk block. Their name appears in `chairpersons` on
  // all three sessions; they present none of them.
  const chair = "Dr. Venkat Subramanian"
  const sessions = [
    session({ id: "t1", speakers: "Dr. Meera Kulkarni", chairpersons: chair }),
    session({ id: "t2", speakers: "Dr. Shalini Bose", chairpersons: chair }),
    session({ id: "t3", speakers: "Dr. Girish Patel", chairpersons: chair }),
  ]

  it("finds all three sessions, tagged as chairing rather than presenting", () => {
    const matches = matchFacultySessions(sessions, [], { name: chair })
    expect(matches).toHaveLength(3)
    expect(matches.every((m) => m.role === "chairperson")).toBe(true)
  })

  it("attributes none of the three talks to them as a speaker", () => {
    const matches = matchFacultySessions(sessions, [], { name: chair })
    // This is the regression the whole module exists to prevent.
    expect(sessionIdsForRole(matches, "speaker").size).toBe(0)
  })

  it("still lists a genuine speaker's own talk as theirs", () => {
    const matches = matchFacultySessions(sessions, [], { name: "Dr. Shalini Bose" })
    expect([...sessionIdsForRole(matches, "speaker")]).toEqual(["t2"])
  })
})

describe("matchFacultySessions — sources and precedence", () => {
  it("prefers a structured assignment over a free-text hit", () => {
    const sessions = [session({ id: "s1", speakers: "Dr. Anitha Ravindran" })]
    const assignments = [
      assignment({ session_id: "s1", faculty_email: "anitha@kims.in", role: "speaker" }),
    ]
    const matches = matchFacultySessions(sessions, assignments, {
      email: "anitha@kims.in",
      name: "Dr. Anitha Ravindran",
    })
    expect(matches).toHaveLength(1)
    expect(matches[0].source).toBe("assignment")
  })

  it("matches an assignment by email case-insensitively", () => {
    const sessions = [session({ id: "s1" })]
    const assignments = [
      assignment({ session_id: "s1", faculty_email: "Anitha@KIMS.in", role: "chairperson" }),
    ]
    const matches = matchFacultySessions(sessions, assignments, { email: "anitha@kims.in" })
    expect(matches).toEqual([{ session_id: "s1", role: "chairperson", source: "assignment" }])
  })

  it("does not rescue an assignment that carries a different email", () => {
    // Same name, different person. The row has an email of its own, so the
    // name must not override it.
    const sessions = [session({ id: "s1" })]
    const assignments = [
      assignment({
        session_id: "s1",
        faculty_email: "other.anitha@example.com",
        faculty_name: "Dr. Anitha Ravindran",
        role: "speaker",
      }),
    ]
    const matches = matchFacultySessions(sessions, assignments, {
      email: "anitha@kims.in",
      name: "Dr. Anitha Ravindran",
    })
    expect(matches).toEqual([])
  })

  it("falls back to the name only when the assignment row has no email", () => {
    // 723 live assignments have no email at all -- this path is load-bearing.
    const sessions = [session({ id: "s1" })]
    const assignments = [
      assignment({ session_id: "s1", faculty_name: "Dr. Anitha Ravindran", role: "moderator" }),
    ]
    const matches = matchFacultySessions(sessions, assignments, {
      email: "anitha@kims.in",
      name: "Dr. Anitha Ravindran",
    })
    expect(matches).toEqual([{ session_id: "s1", role: "moderator", source: "assignment" }])
  })

  it("derives the role from whichever text column matched", () => {
    const sessions = [
      session({ id: "s1", speakers_text: "Dr. Anitha Ravindran (anitha@kims.in, 99999)" }),
      session({ id: "s2", chairpersons_text: "Dr. Anitha Ravindran (anitha@kims.in, 99999)" }),
      session({ id: "s3", moderators_text: "Dr. Anitha Ravindran (anitha@kims.in, 99999)" }),
    ]
    const matches = matchFacultySessions(sessions, [], { email: "anitha@kims.in" })
    const byId = new Map(matches.map((m) => [m.session_id, m.role]))
    expect(byId.get("s1")).toBe("speaker")
    expect(byId.get("s2")).toBe("chairperson")
    expect(byId.get("s3")).toBe("moderator")
  })

  it("records both roles when someone chairs and speaks in the same session", () => {
    const sessions = [
      session({
        id: "s1",
        speakers: "Dr. Anitha Ravindran",
        chairpersons: "Dr. Anitha Ravindran",
      }),
    ]
    const matches = matchFacultySessions(sessions, [], { name: "Dr. Anitha Ravindran" })
    expect(matches.map((m) => m.role).sort()).toEqual(["chairperson", "speaker"])
  })

  it("never infers a role from description, and never name-matches it", () => {
    const sessions = [
      session({ id: "s1", description: "Panel with Dr. Anitha Ravindran (anitha@kims.in)" }),
      session({ id: "s2", description: "A discussion led by Dr. Anitha Ravindran" }),
    ]
    const matches = matchFacultySessions(sessions, [], {
      email: "anitha@kims.in",
      name: "Dr. Anitha Ravindran",
    })
    // s1 matches on email with an unknown role; s2 (name only) does not match.
    expect(matches).toEqual([{ session_id: "s1", role: null, source: "description" }])
  })

  it("ignores assignments pointing at sessions outside the given set", () => {
    // 58 live assignments are orphaned (session_id null) and events get filtered.
    const sessions = [session({ id: "s1" })]
    const assignments = [
      assignment({ session_id: null, faculty_email: "anitha@kims.in", role: "speaker" }),
      assignment({ session_id: "other-event", faculty_email: "anitha@kims.in", role: "speaker" }),
    ]
    expect(matchFacultySessions(sessions, assignments, { email: "anitha@kims.in" })).toEqual([])
  })

  it("returns nothing for a person with neither a usable email nor a usable name", () => {
    const sessions = [session({ id: "s1", speakers: "Dr. Anitha Ravindran" })]
    expect(matchFacultySessions(sessions, [], { email: "", name: "Rao" })).toEqual([])
  })

  it("keeps an unrecognised assignment role as unknown rather than guessing", () => {
    const sessions = [session({ id: "s1" })]
    const assignments = [
      assignment({ session_id: "s1", faculty_email: "anitha@kims.in", role: "co-chair" }),
    ]
    const matches = matchFacultySessions(sessions, assignments, { email: "anitha@kims.in" })
    expect(matches[0].role).toBeNull()
  })
})

describe("primaryRoleBySession", () => {
  it("prefers the more specific role when someone holds two in one session", () => {
    const matches = matchFacultySessions(
      [session({ id: "s1", speakers: "Dr. Anitha Ravindran", chairpersons: "Dr. Anitha Ravindran" })],
      [],
      { name: "Dr. Anitha Ravindran" }
    )
    expect(primaryRoleBySession(matches).get("s1")).toBe("speaker")
  })

  it("upgrades an unknown role to a known one for the same session", () => {
    const matches = [
      { session_id: "s1", role: null, source: "description" as const },
      { session_id: "s1", role: "chairperson" as const, source: "session_text" as const },
    ]
    expect(primaryRoleBySession(matches).get("s1")).toBe("chairperson")
  })
})

describe("presentingSessionIds", () => {
  it("keeps a chaired session out of the presenting list", () => {
    const matches = matchFacultySessions(
      [session({ id: "t1", speakers: "Dr. Meera Kulkarni", chairpersons: "Dr. Venkat Subramanian" })],
      [],
      { name: "Dr. Venkat Subramanian" }
    )
    expect(presentingSessionIds(matches).size).toBe(0)
  })

  it("includes a session whose only link is an email in the description", () => {
    // 69 live sessions have no other faculty linkage at all. Dropping these
    // would blank those speakers' portals.
    const matches = matchFacultySessions(
      [session({ id: "s1", description: "Panel with Dr. Anitha Ravindran (anitha@kims.in)" })],
      [],
      { email: "anitha@kims.in" }
    )
    expect([...presentingSessionIds(matches)]).toEqual(["s1"])
  })

  it("lets a known chairing role beat an unknown description match on the same session", () => {
    const matches = matchFacultySessions(
      [
        session({
          id: "s1",
          chairpersons_text: "Dr. Anitha Ravindran (anitha@kims.in)",
          description: "Chaired by Dr. Anitha Ravindran (anitha@kims.in)",
        }),
      ],
      [],
      { email: "anitha@kims.in" }
    )
    expect(presentingSessionIds(matches).size).toBe(0)
  })

  it("counts a keynote as presenting", () => {
    const matches = matchFacultySessions(
      [session({ id: "s1" })],
      [assignment({ session_id: "s1", faculty_email: "a@b.in", role: "keynote" })],
      { email: "a@b.in" }
    )
    expect([...presentingSessionIds(matches)]).toEqual(["s1"])
  })

  it("includes a session where the person both chairs and speaks", () => {
    const matches = matchFacultySessions(
      [session({ id: "s1", speakers: "Dr. Anitha Ravindran", chairpersons: "Dr. Anitha Ravindran" })],
      [],
      { name: "Dr. Anitha Ravindran" }
    )
    expect([...presentingSessionIds(matches)]).toEqual(["s1"])
  })
})

describe("describeRole", () => {
  it("distinguishes chairing from presenting", () => {
    expect(describeRole("chairperson")).toBe("You are chairing")
    expect(describeRole("speaker")).toBe("You are presenting")
  })

  it("stays neutral when the role is unknown", () => {
    expect(describeRole(null)).toBe("You are taking part")
  })
})
