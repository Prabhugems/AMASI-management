// Matching a faculty member to the sessions they take part in, and to WHICH
// ROLE they hold in each one. Pure and framework-free -- callers fetch the
// sessions/assignments and pass plain data in.
//
// This exists because the same matching logic was written twice, diverged, and
// one copy shipped a real bug: a chairperson of a 3-talk block was told all 3
// talks were their own (the 127 FMAS bug). The fix landed in the speaker portal
// (`/api/speaker/[token]`) and never reached the bulk invitation sender
// (`/api/email/speaker-invitation`), which is the path that actually sends.
//
// The rule that prevents it: a match ALWAYS carries the role it was derived
// from. Nothing may claim a person is presenting merely because their name
// appeared somewhere on the session. Callers then decide what to do with the
// role -- the speaker portal keeps only `speaker` matches ("sessions you are
// assigned to present"), while an invitation email keeps all of them and
// labels each one.

import { escapeRegex } from "./string-utils"

export const FACULTY_ROLES = [
  "speaker",
  "chairperson",
  "moderator",
  "panelist",
  "keynote",
  "discussant",
] as const

export type FacultyRole = (typeof FACULTY_ROLES)[number]

export function isFacultyRole(value: unknown): value is FacultyRole {
  return typeof value === "string" && (FACULTY_ROLES as readonly string[]).includes(value)
}

/** Only the session columns matching needs. Extra columns are ignored. */
export interface MatchableSession {
  id: string
  speakers?: string | null
  chairpersons?: string | null
  moderators?: string | null
  speakers_text?: string | null
  chairpersons_text?: string | null
  moderators_text?: string | null
  description?: string | null
}

export interface MatchableAssignment {
  session_id: string | null
  faculty_email?: string | null
  faculty_name?: string | null
  role?: string | null
}

export interface FacultyIdentity {
  email?: string | null
  name?: string | null
}

/**
 * Where a match came from, in descending order of trust.
 * `assignment` is a structured faculty_assignments row; the other two are
 * heuristics over free-text columns kept because 54% of live sessions have no
 * assignment row at all.
 */
export type MatchSource = "assignment" | "session_text" | "description"

export interface SessionMatch {
  session_id: string
  /**
   * `null` means "takes part, role unknown" -- only ever produced by a
   * description match, where the column has five incompatible historical
   * formats and no role can honestly be inferred. Render these neutrally;
   * never assume `speaker`.
   */
  role: FacultyRole | null
  source: MatchSource
}

/** Which free-text column implies which role. */
const TEXT_FIELD_ROLES: ReadonlyArray<{
  nameField: keyof MatchableSession
  contactField: keyof MatchableSession
  role: FacultyRole
}> = [
  { nameField: "speakers", contactField: "speakers_text", role: "speaker" },
  { nameField: "chairpersons", contactField: "chairpersons_text", role: "chairperson" },
  { nameField: "moderators", contactField: "moderators_text", role: "moderator" },
]

const TITLE_PREFIX = /^(dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?|shri\.?|smt\.?)\s+/i

/** Drop a leading honorific so "Dr. Anitha Ravindran" matches "Anitha Ravindran". */
export function stripTitle(name: string): string {
  return name.replace(TITLE_PREFIX, "").trim()
}

/**
 * A word-boundary-anchored name test.
 *
 * `String.includes()` was the old behaviour and is unsafe here: "Dr Rao"
 * matches "Dr Raghava Rao", and with 43% of live assignments carrying no email
 * at all, name matching is the primary path rather than a fallback.
 *
 * The generated pattern is an escaped literal with lookarounds -- no nested
 * quantifiers, so it stays linear. (See the ReDoS note in the import routes:
 * `([^(]+)\s*` looked benign and took 2,400ms.)
 */
export interface NameMatcher {
  readonly stripped: string
  test(haystack: string | null | undefined): boolean
}

export function buildNameMatcher(name: string | null | undefined): NameMatcher | null {
  const stripped = name ? stripTitle(name) : ""
  // Single-token names ("Rao") are too collision-prone to match on their own.
  if (stripped.length < 3 || !stripped.includes(" ")) return null

  const escaped = escapeRegex(stripped)
  // Collapse whitespace runs so "Anitha  Ravindran" still matches.
  const pattern = new RegExp(`(?<!\\p{L})${escaped.replace(/\s+/g, "\\s+")}(?!\\p{L})`, "iu")

  return {
    stripped,
    test(haystack) {
      if (!haystack) return false
      return pattern.test(haystack)
    },
  }
}

function emailAppearsIn(haystack: string | null | undefined, email: string): boolean {
  if (!haystack) return false
  return haystack.toLowerCase().includes(email)
}

/**
 * Every session this person takes part in, tagged with the role each match
 * implies. Deduplicated on (session_id, role), keeping the most trusted source.
 *
 * Precedence: assignment > session_text > description.
 */
export function matchFacultySessions(
  sessions: readonly MatchableSession[],
  assignments: readonly MatchableAssignment[],
  identity: FacultyIdentity
): SessionMatch[] {
  const email = identity.email?.trim().toLowerCase() || ""
  const nameMatcher = buildNameMatcher(identity.name)

  const sessionIds = new Set(sessions.map((s) => s.id))
  const best = new Map<string, SessionMatch>()

  const sourceRank: Record<MatchSource, number> = {
    assignment: 3,
    session_text: 2,
    description: 1,
  }

  const record = (match: SessionMatch) => {
    if (!sessionIds.has(match.session_id)) return
    const key = `${match.session_id}::${match.role ?? "unknown"}`
    const existing = best.get(key)
    if (existing && sourceRank[existing.source] >= sourceRank[match.source]) return
    best.set(key, match)
  }

  // --- Structured assignments (authoritative) -------------------------------
  for (const a of assignments) {
    if (!a.session_id) continue

    const assignmentEmail = a.faculty_email?.trim().toLowerCase() || ""
    let identifies = false

    if (email && assignmentEmail) {
      identifies = assignmentEmail === email
    } else if (nameMatcher && !assignmentEmail && a.faculty_name) {
      // Only fall back to the name when the ROW has no email of its own --
      // an assignment carrying a different email is a different person, not a
      // near-miss worth rescuing.
      identifies = nameMatcher.test(a.faculty_name)
    }

    if (!identifies) continue

    record({
      session_id: a.session_id,
      role: isFacultyRole(a.role) ? a.role : null,
      source: "assignment",
    })
  }

  // --- Free-text columns ----------------------------------------------------
  for (const session of sessions) {
    for (const { nameField, contactField, role } of TEXT_FIELD_ROLES) {
      const nameValue = session[nameField] as string | null | undefined
      const contactValue = session[contactField] as string | null | undefined

      const hit =
        (email && (emailAppearsIn(contactValue, email) || emailAppearsIn(nameValue, email))) ||
        (nameMatcher && (nameMatcher.test(contactValue) || nameMatcher.test(nameValue)))

      if (hit) record({ session_id: session.id, role, source: "session_text" })
    }

    // `description` is email-only on purpose. It holds five incompatible
    // formats across the four historical importers and the free-prose the
    // Schedule editor writes, so a name found there proves nothing about role
    // -- and name-matching admin prose is exactly how false positives happen.
    if (email && emailAppearsIn(session.description, email)) {
      record({ session_id: session.id, role: null, source: "description" })
    }
  }

  return [...best.values()]
}

/** Session ids where this person holds the given role. */
export function sessionIdsForRole(
  matches: readonly SessionMatch[],
  role: FacultyRole
): Set<string> {
  return new Set(matches.filter((m) => m.role === role).map((m) => m.session_id))
}

/** Roles that mean "this person is on their feet delivering content". */
const PRESENTING_ROLES: ReadonlySet<FacultyRole> = new Set(["speaker", "keynote"])

/**
 * Sessions to show under "sessions you are assigned to present".
 *
 * Includes a session when the person holds a presenting role in it, OR when
 * every match for that session has an unknown role -- an unknown-role match
 * comes from a `description` email hit, which is a presence signal with no
 * role attached. Excluding those outright would blank the portal for the 69
 * live sessions whose only faculty linkage is that column.
 *
 * A known non-presenting role always wins over an unknown one: someone who
 * chairs a session and also appears in its description is chairing, not
 * presenting. That asymmetry is the 127 FMAS bug, stated as a rule.
 */
export function presentingSessionIds(matches: readonly SessionMatch[]): Set<string> {
  const knownRolesBySession = new Map<string, Set<FacultyRole>>()
  const allSessionIds = new Set<string>()

  for (const m of matches) {
    allSessionIds.add(m.session_id)
    if (m.role == null) continue
    const set = knownRolesBySession.get(m.session_id) ?? new Set<FacultyRole>()
    set.add(m.role)
    knownRolesBySession.set(m.session_id, set)
  }

  const out = new Set<string>()
  for (const id of allSessionIds) {
    const known = knownRolesBySession.get(id)
    if (!known) {
      out.add(id) // unknown role only -- preserve the legacy inclusion
      continue
    }
    if ([...known].some((r) => PRESENTING_ROLES.has(r))) out.add(id)
  }
  return out
}

/**
 * Collapse to one entry per session, preferring the most specific known role.
 * Use when rendering a person-facing list where one row per session reads
 * better than one row per role.
 */
export function primaryRoleBySession(
  matches: readonly SessionMatch[]
): Map<string, FacultyRole | null> {
  const rolePreference: ReadonlyArray<FacultyRole> = [
    "keynote",
    "speaker",
    "chairperson",
    "moderator",
    "panelist",
    "discussant",
  ]

  const out = new Map<string, FacultyRole | null>()
  for (const m of matches) {
    const current = out.get(m.session_id)
    if (!out.has(m.session_id)) {
      out.set(m.session_id, m.role)
      continue
    }
    if (current == null) {
      out.set(m.session_id, m.role)
      continue
    }
    if (m.role == null) continue
    if (rolePreference.indexOf(m.role) < rolePreference.indexOf(current)) {
      out.set(m.session_id, m.role)
    }
  }
  return out
}

/** Human-readable phrasing for an invitation email or portal. */
export function describeRole(role: FacultyRole | null): string {
  switch (role) {
    case "speaker":
      return "You are presenting"
    case "keynote":
      return "You are delivering the keynote"
    case "chairperson":
      return "You are chairing"
    case "moderator":
      return "You are moderating"
    case "panelist":
      return "You are on the panel"
    case "discussant":
      return "You are the discussant"
    default:
      return "You are taking part"
  }
}
