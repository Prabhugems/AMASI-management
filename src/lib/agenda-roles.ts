// The single role vocabulary for the Agenda and Invitation modules.
//
// Three authorities disagreed before this file existed: the `faculty_assignments`
// role CHECK allows 6 values, `/api/events/[eventId]/session-speakers` allowed 6,
// `/api/events/[eventId]/program/faculty/[assignmentId]` allowed 5, and the
// original schema had 4. A `GROUP BY role` was therefore only as trustworthy as
// whichever writer happened to create the row. Everything imports from here now.
//
// Also holds the default rosters that make each event cheaper to set up than the
// last: a session type implies a starting set of role requirements, which the
// coordinator then edits. See docs/superpowers/specs/ (Agenda Builder) and the
// Phase 1 plan.

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

export const ROLE_LABELS: Record<FacultyRole, { one: string; many: string }> = {
  speaker: { one: "Speaker", many: "Speakers" },
  chairperson: { one: "Chair", many: "Chairs" },
  moderator: { one: "Moderator", many: "Moderators" },
  panelist: { one: "Panelist", many: "Panelists" },
  keynote: { one: "Keynote", many: "Keynotes" },
  discussant: { one: "Discussant", many: "Discussants" },
}

/** "3 Speakers", "1 Chair" — for Open Slots and the Role Requirements editor. */
export function formatRoleCount(role: FacultyRole, count: number): string {
  const label = ROLE_LABELS[role]
  return `${count} ${count === 1 ? label.one : label.many}`
}

/** Roles that mean "on their feet delivering content", as opposed to running the room. */
export const PRESENTING_ROLES: ReadonlySet<FacultyRole> = new Set(["speaker", "keynote"])

/**
 * Human-readable phrasing for an invitation email or the speaker portal.
 * `null` is a real case: a match derived from `sessions.description`, where the
 * column has five incompatible historical formats and no role can be inferred.
 */
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

// ---------------------------------------------------------------------------
// Session types and their default rosters
// ---------------------------------------------------------------------------

/**
 * `sessions.session_type` is free-form TEXT with no DB constraint. These are the
 * values actually present in production (2026-08-07), not an invented taxonomy.
 *
 * Note `exam` (15 rows) and `examination` (7 rows) are two spellings of one
 * thing — normalised by `normaliseSessionType` here, and due a data fix in the
 * Phase 3 session-editor work.
 */
export const KNOWN_SESSION_TYPES = [
  "lecture",
  "live_surgery",
  "panel",
  "workshop",
  "symposium",
  "keynote",
  "plenary",
  "oration",
  "award",
  "exam",
  "break",
  "ceremony",
] as const

export type SessionType = (typeof KNOWN_SESSION_TYPES)[number]

const SESSION_TYPE_ALIASES: Record<string, SessionType> = {
  examination: "exam",
  hands_on: "workshop",
  video: "lecture",
  inauguration: "ceremony",
  valedictory: "ceremony",
}

export function normaliseSessionType(raw: string | null | undefined): SessionType | null {
  if (!raw) return null
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_")
  if ((KNOWN_SESSION_TYPES as readonly string[]).includes(key)) return key as SessionType
  return SESSION_TYPE_ALIASES[key] ?? null
}

/** Session types that legitimately need nobody. An empty roster is correct here, not a gap. */
export const FACULTY_FREE_SESSION_TYPES: ReadonlySet<SessionType> = new Set([
  "break",
  "ceremony",
  "exam",
])

/**
 * Starting rosters, by session type. These are DEFAULTS a coordinator edits per
 * session -- not rules. They exist so setting up event N+1 begins from a library
 * rather than a blank sheet, which is the whole point of the roadmap.
 *
 * Deliberately conservative: it is better to under-declare and have a coordinator
 * add a slot than to over-declare and have Open Slots cry wolf on 150 sessions.
 */
export const DEFAULT_ROSTERS: Record<SessionType, Partial<Record<FacultyRole, number>>> = {
  symposium: { chairperson: 2, speaker: 4 },
  panel: { moderator: 1, panelist: 4 },
  plenary: { chairperson: 2, speaker: 2 },
  lecture: { speaker: 1 },
  keynote: { keynote: 1, chairperson: 1 },
  oration: { keynote: 1, chairperson: 1 },
  workshop: { moderator: 1, speaker: 2 },
  live_surgery: { speaker: 1, moderator: 1 },
  award: { chairperson: 1 },
  exam: {},
  break: {},
  ceremony: {},
}

export interface RoleRequirement {
  role: FacultyRole
  required_count: number
}

/**
 * The default requirement rows for a session type, ready to insert into
 * `session_role_requirements`. Returns [] for an unknown or faculty-free type --
 * an unrecognised type must not silently inherit someone else's roster.
 */
export function defaultRosterFor(sessionType: string | null | undefined): RoleRequirement[] {
  const type = normaliseSessionType(sessionType)
  if (!type) return []

  const roster = DEFAULT_ROSTERS[type]
  return FACULTY_ROLES.filter((role) => (roster[role] ?? 0) > 0).map((role) => ({
    role,
    required_count: roster[role]!,
  }))
}

/** "2 Chairs, 4 Speakers" — a one-line roster summary for the Schedule view. */
export function describeRoster(requirements: readonly RoleRequirement[]): string {
  if (requirements.length === 0) return "No faculty required"
  return requirements.map((r) => formatRoleCount(r.role, r.required_count)).join(", ")
}
