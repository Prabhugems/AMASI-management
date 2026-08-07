// Open Slots -- every session+role combination still short of its requirement.
// The Agenda module's "to-do list" view.
//
// Pure and framework-free: callers (API routes) fetch sessions, requirements and
// assignments and pass plain data in, matching src/lib/agenda-conflicts.ts.
//
// THE TRAP THIS MODULE EXISTS TO AVOID
// ------------------------------------
// 1,242 sessions in production are staffed only in free text (`speakers`,
// `chairpersons`, `moderators`) with no `faculty_assignments` row at all --
// 54% of all sessions. A naive `left join requirements to assignments` calls
// every one of them open, and the screen tells a coordinator to re-invite
// people who are already booked.
//
// So a session with no assignment rows but with faculty text is `unverified`,
// never `open`. Those two states must stay visually and semantically distinct:
// `open` means "nobody is doing this, go find someone"; `unverified` means
// "somebody may already be doing this, but only a human can confirm who".
// Auto-matching those names is explicitly deferred -- attributing a session to
// the wrong person is worse than showing a coordinator a short review queue.

import { ROLE_LABELS, type FacultyRole } from "./agenda-roles"
import { buildHallLabels } from "./venue-tree"

// Label formatting lives in ./venue-tree -- one owner for "Hall A › Screen 2",
// shared with the location picker and the Session Builder.
export { buildHallLabels } from "./venue-tree"

export interface OpenSlotSession {
  id: string
  session_name: string
  session_date: string | null
  start_time: string | null
  end_time: string | null
  hall_id: string | null
  /** Free-text faculty columns. Presence is what makes a session `unverified`. */
  speakers?: string | null
  chairpersons?: string | null
  moderators?: string | null
  speakers_text?: string | null
  chairpersons_text?: string | null
  moderators_text?: string | null
}

/** A talk inside a block. Blocks with no talks (LUNCH, breaks) simply have none. */
export interface OpenSlotTalk {
  id: string
  session_id: string
  title: string | null
  start_time: string | null
  display_order?: number | null
}

/**
 * A requirement hangs off whichever level owns the role: a chairperson belongs
 * to the block (`talk_id` null), a speaker or panellist to a talk.
 */
export interface RoleRequirementRow {
  session_id: string
  talk_id?: string | null
  role: FacultyRole
  required_count: number
}

export interface AssignmentRow {
  session_id: string | null
  talk_id?: string | null
  role: string
  status: string | null
}

export interface HallRef {
  id: string
  name: string
  parent_id?: string | null
}

/**
 * `open`       -- declared requirement, not enough assignments, no stray text.
 * `unverified` -- declared requirement, not enough assignments, but the session
 *                 carries free-text faculty that nobody has reconciled yet.
 */
export type SlotState = "open" | "unverified"

export interface OpenSlot {
  session_id: string
  /** The block's name — "GALL BLADDER". */
  session_name: string
  /** Set when the gap is inside a talk; null when the role belongs to the block. */
  talk_id: string | null
  /** The talk's title — "Bile Duct Injury in 2025". Null for a block-level role. */
  talk_title: string | null
  session_date: string | null
  /** The talk's own start time when it has one, otherwise the block's. */
  start_time: string | null
  hall_id: string | null
  /** Rendered as "Hall A › Screen 2" when the hall is nested. */
  hall_label: string | null
  role: FacultyRole
  role_label: string
  required_count: number
  filled_count: number
  open_count: number
  state: SlotState
}

/**
 * Assignment statuses that do NOT occupy a slot.
 *
 * `declined` and `cancelled` mean the person said no or was stood down, so the
 * slot genuinely reopens -- this is what makes "declined reopens the slot"
 * work without any extra bookkeeping. Everything else, including `pending`,
 * counts as filled: 95% of live rows sit at `pending`, and treating those as
 * open would report almost every booked slot as vacant.
 */
const VACATING_STATUSES: ReadonlySet<string> = new Set(["declined", "cancelled", "withdrawn"])

function occupiesSlot(a: AssignmentRow): boolean {
  return !VACATING_STATUSES.has((a.status ?? "").toLowerCase())
}

function hasFacultyText(s: OpenSlotSession): boolean {
  return [
    s.speakers,
    s.chairpersons,
    s.moderators,
    s.speakers_text,
    s.chairpersons_text,
    s.moderators_text,
  ].some((v) => typeof v === "string" && v.trim() !== "")
}

/**
 * A requirement and an assignment must be counted at the same grain, or a
 * block-level chair would be cancelled out by a talk-level speaker. `null` and
 * `undefined` both mean "block level".
 */
function grainKey(sessionId: string, talkId: string | null | undefined, role: string): string {
  return `${sessionId}::${talkId ?? ""}::${role}`
}

export function getOpenSlots(input: {
  sessions: readonly OpenSlotSession[]
  requirements: readonly RoleRequirementRow[]
  assignments: readonly AssignmentRow[]
  talks?: readonly OpenSlotTalk[]
  halls?: readonly HallRef[]
}): OpenSlot[] {
  const sessionsById = new Map(input.sessions.map((s) => [s.id, s]))
  const talksById = new Map((input.talks ?? []).map((t) => [t.id, t]))
  const hallLabels = buildHallLabels(input.halls ?? [])

  // (session, talk, role) -> how many people currently occupy it
  const filled = new Map<string, number>()
  for (const a of input.assignments) {
    if (!a.session_id) continue // 58 live rows are orphaned
    if (!occupiesSlot(a)) continue
    const key = grainKey(a.session_id, a.talk_id, a.role)
    filled.set(key, (filled.get(key) ?? 0) + 1)
  }

  // Reconciliation is judged per BLOCK, not per talk: leftover free text sits on
  // the session's columns and says nothing about which talk it belongs to.
  const sessionsWithAnyAssignment = new Set(
    input.assignments.map((a) => a.session_id).filter((id): id is string => !!id)
  )

  const slots: OpenSlot[] = []

  for (const req of input.requirements) {
    const session = sessionsById.get(req.session_id)
    if (!session) continue // requirement for a session outside this event

    // A talk-level requirement whose talk is missing is dropped rather than
    // silently reported at block level, which would double-count the block.
    const talk = req.talk_id ? talksById.get(req.talk_id) : undefined
    if (req.talk_id && !talk) continue

    const filledCount = filled.get(grainKey(req.session_id, req.talk_id, req.role)) ?? 0
    const openCount = req.required_count - filledCount
    if (openCount <= 0) continue

    // Any assignment row at all for this block means somebody has already
    // reconciled it; the leftover text is then just a stale duplicate, not an
    // unreviewed roster. Only a block with NO assignments and SOME text is
    // genuinely unverified.
    const state: SlotState =
      !sessionsWithAnyAssignment.has(req.session_id) && hasFacultyText(session)
        ? "unverified"
        : "open"

    slots.push({
      session_id: session.id,
      session_name: session.session_name,
      talk_id: talk?.id ?? null,
      talk_title: talk?.title ?? null,
      session_date: session.session_date,
      // A talk's own time wins when it has one — the list is sorted soonest
      // first, and a talk at 16:00 inside a block starting at 09:30 belongs at
      // 16:00, not at the top of the day.
      start_time: talk?.start_time ?? session.start_time,
      hall_id: session.hall_id,
      hall_label: session.hall_id ? hallLabels.get(session.hall_id) ?? null : null,
      role: req.role,
      role_label: ROLE_LABELS[req.role].one,
      required_count: req.required_count,
      filled_count: filledCount,
      open_count: openCount,
      state,
    })
  }

  // Chronological, so the to-do list reads in the order the conference runs.
  // Undated sessions sort last -- they need scheduling before staffing.
  return slots.sort((a, b) => {
    const ad = a.session_date ?? "9999-12-31"
    const bd = b.session_date ?? "9999-12-31"
    if (ad !== bd) return ad.localeCompare(bd)
    const at = a.start_time ?? "99:99"
    const bt = b.start_time ?? "99:99"
    if (at !== bt) return at.localeCompare(bt)
    if (a.session_name !== b.session_name) return a.session_name.localeCompare(b.session_name)
    // Block-level roles (the chair) before the talks they preside over.
    const at2 = a.talk_title ?? ""
    const bt2 = b.talk_title ?? ""
    if (at2 !== bt2) return at2.localeCompare(bt2)
    return a.role.localeCompare(b.role)
  })
}

export interface OpenSlotSummary {
  /** People still needed across every genuinely open slot. */
  openCount: number
  /** People still needed on sessions awaiting reconciliation. */
  unverifiedCount: number
  sessionsAffected: number
  byRole: Array<{ role: FacultyRole; role_label: string; open_count: number }>
}

/** Counters for the Open Slots header and the Agenda dashboard tile. */
export function summariseOpenSlots(slots: readonly OpenSlot[]): OpenSlotSummary {
  const byRole = new Map<FacultyRole, number>()
  let openCount = 0
  let unverifiedCount = 0

  for (const s of slots) {
    if (s.state === "open") {
      openCount += s.open_count
      byRole.set(s.role, (byRole.get(s.role) ?? 0) + s.open_count)
    } else {
      unverifiedCount += s.open_count
    }
  }

  return {
    openCount,
    unverifiedCount,
    sessionsAffected: new Set(slots.map((s) => s.session_id)).size,
    byRole: [...byRole.entries()]
      .map(([role, open_count]) => ({ role, role_label: ROLE_LABELS[role].one, open_count }))
      .sort((a, b) => b.open_count - a.open_count),
  }
}

/**
 * Sessions with no declared roster at all.
 *
 * Distinct from an open slot: nobody has said what this session needs, so it
 * cannot appear in Open Slots by construction. Without surfacing these, the
 * screen reads "0 open" on an event where nothing has been declared -- the most
 * dangerous possible false reassurance.
 */
export function sessionsMissingRequirements(
  sessions: readonly OpenSlotSession[],
  requirements: readonly RoleRequirementRow[]
): OpenSlotSession[] {
  const declared = new Set(requirements.map((r) => r.session_id))
  return sessions.filter((s) => !declared.has(s.id))
}
