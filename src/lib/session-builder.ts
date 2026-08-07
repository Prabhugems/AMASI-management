// Session Builder — the arithmetic behind a session block and its talks.
//
// Pure and framework-free, matching src/lib/agenda-conflicts.ts and
// src/lib/agenda-open-slots.ts: callers fetch the block, its talks, its role
// requirements and its assignments, and pass plain data in.
//
// THE GOVERNING RULE, from state 2g of the design: time problems are WARNINGS,
// never blocks. "2 warnings — you can still save." A real programme is edited
// out of order — a talk gets its time before its block does, two talks overlap
// because they genuinely run in parallel on two screens — and a builder that
// refuses to save until everything is consistent cannot be used for the job.
// Nothing in this module returns a blocking severity for a time problem.

import { ROLE_LABELS, type FacultyRole } from "./agenda-roles"

export interface BuilderBlock {
  id: string
  session_name: string
  session_date: string | null
  start_time: string | null
  end_time: string | null
}

export interface BuilderTalk {
  id: string
  session_id: string
  title: string | null
  talk_type?: string | null
  start_time: string | null
  end_time: string | null
  display_order?: number | null
}

export interface BuilderRequirement {
  session_id: string
  talk_id?: string | null
  role: FacultyRole
  required_count: number
}

export interface BuilderAssignment {
  session_id: string | null
  talk_id?: string | null
  role: string
  status: string | null
}

/** Mirrors agenda-open-slots: only these free a slot back up. */
const VACATING_STATUSES: ReadonlySet<string> = new Set(["declined", "cancelled", "withdrawn"])

export function toMinutes(time: string | null | undefined): number | null {
  if (!time || !time.includes(":")) return null
  const [h, m] = time.split(":").map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

/** 90 -> "1h 30m", 45 -> "45m", 120 -> "2h". */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0m"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// ---------------------------------------------------------------------------
// Time validation
// ---------------------------------------------------------------------------

export type TimeIssueCode =
  | "end_before_start"
  | "outside_block"
  | "overlaps_sibling"
  | "block_end_before_start"

export interface TimeIssue {
  code: TimeIssueCode
  /** The talk this is about; null when the issue is on the block itself. */
  talk_id: string | null
  message: string
}

/**
 * Everything questionable about the times in one block.
 *
 * An overlap is reported with the hedge the design uses — "fine if they run in
 * parallel" — because on a multi-screen hall that is a legitimate programme,
 * not a mistake. The screen shows it; the coordinator decides.
 */
export function validateBlockTimes(block: BuilderBlock, talks: readonly BuilderTalk[]): TimeIssue[] {
  const issues: TimeIssue[] = []

  const blockStart = toMinutes(block.start_time)
  const blockEnd = toMinutes(block.end_time)

  if (blockStart !== null && blockEnd !== null && blockEnd <= blockStart) {
    issues.push({
      code: "block_end_before_start",
      talk_id: null,
      message: "End time should be after the start time",
    })
  }

  for (const t of talks) {
    const s = toMinutes(t.start_time)
    const e = toMinutes(t.end_time)

    if (s !== null && e !== null && e <= s) {
      issues.push({
        code: "end_before_start",
        talk_id: t.id,
        message: "End time should be after the start time",
      })
      continue
    }

    // Only meaningful once the block itself has a range to be outside of.
    if (blockStart !== null && blockEnd !== null && s !== null && e !== null) {
      if (s < blockStart || e > blockEnd) {
        issues.push({
          code: "outside_block",
          talk_id: t.id,
          message: "This talk's time falls outside the session block's range",
        })
      }
    }
  }

  // Overlaps, each pair reported once against the EARLIER talk and naming the
  // later one — matching the design, where the warning sits on the talk at
  // 10:15 and names the 10:30 panel it runs into. Reading top-down, you meet
  // the warning at the first talk involved rather than after the fact.
  const timed = talks
    .filter((t) => toMinutes(t.start_time) !== null && toMinutes(t.end_time) !== null)
    .sort((a, b) => toMinutes(a.start_time)! - toMinutes(b.start_time)!)

  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const earlier = timed[i]
      const later = timed[j]
      if (toMinutes(later.start_time)! >= toMinutes(earlier.end_time)!) break // sorted
      const label = later.title?.trim() || "another talk"
      const when = `${later.start_time?.slice(0, 5)} – ${later.end_time?.slice(0, 5)}`
      issues.push({
        code: "overlaps_sibling",
        talk_id: earlier.id,
        message: `Overlaps “${label}” (${when}) — fine if they run in parallel`,
      })
    }
  }

  return issues
}

/** "2 warnings — you can still save". Empty string when there is nothing to say. */
export function describeTimeIssues(issues: readonly TimeIssue[]): string {
  if (issues.length === 0) return ""
  return `${issues.length} warning${issues.length === 1 ? "" : "s"} — you can still save`
}

// ---------------------------------------------------------------------------
// Unscheduled time
// ---------------------------------------------------------------------------

export interface UnscheduledRange {
  start: string
  end: string
  minutes: number
}

/**
 * The parts of a block no talk covers — "11:00 – 11:30 unscheduled".
 *
 * Merges overlapping talks before subtracting, so two parallel talks on two
 * screens count once rather than making the block look over-full. Talks with no
 * time are ignored; they are not yet placed anywhere.
 */
export function findUnscheduledRanges(
  block: BuilderBlock,
  talks: readonly BuilderTalk[]
): UnscheduledRange[] {
  const blockStart = toMinutes(block.start_time)
  const blockEnd = toMinutes(block.end_time)
  if (blockStart === null || blockEnd === null || blockEnd <= blockStart) return []

  const spans = talks
    .map((t) => [toMinutes(t.start_time), toMinutes(t.end_time)] as const)
    .filter((v): v is readonly [number, number] => v[0] !== null && v[1] !== null && v[1] > v[0])
    // Clamp to the block; a talk running outside it is flagged separately and
    // must not subtract time the block does not have.
    .map(([s, e]) => [Math.max(s, blockStart), Math.min(e, blockEnd)] as const)
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0])

  const merged: Array<[number, number]> = []
  for (const [s, e] of spans) {
    const last = merged[merged.length - 1]
    if (last && s <= last[1]) last[1] = Math.max(last[1], e)
    else merged.push([s, e])
  }

  const fmt = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`

  const gaps: UnscheduledRange[] = []
  let cursor = blockStart
  for (const [s, e] of merged) {
    if (s > cursor) gaps.push({ start: fmt(cursor), end: fmt(s), minutes: s - cursor })
    cursor = Math.max(cursor, e)
  }
  if (cursor < blockEnd) gaps.push({ start: fmt(cursor), end: fmt(blockEnd), minutes: blockEnd - cursor })

  return gaps
}

/** Below this, a single gap is named precisely; at or above it, as a duration. */
const PRECISE_GAP_LIMIT_MINUTES = 60

/**
 * One line for the block footer.
 *
 * The design uses both forms for a single trailing gap and the discriminator is
 * size: 30 minutes left reads "11:00 – 11:30 unscheduled" (state 2c), while 90
 * minutes left reads "1h 30m of the block still unscheduled" (state 2b). A
 * short gap is actionable as a specific slot you could drop a talk into; a
 * large remainder is better answered with how much there is to fill.
 *
 *   one short gap -> "11:00 – 11:30 unscheduled"
 *   otherwise     -> "1h 30m of the block still unscheduled"
 *   nothing       -> ""
 */
export function describeUnscheduled(ranges: readonly UnscheduledRange[]): string {
  if (ranges.length === 0) return ""
  if (ranges.length === 1 && ranges[0].minutes < PRECISE_GAP_LIMIT_MINUTES) {
    return `${ranges[0].start} – ${ranges[0].end} unscheduled`
  }
  const total = ranges.reduce((n, r) => n + r.minutes, 0)
  return `${formatDuration(total)} of the block still unscheduled`
}

// ---------------------------------------------------------------------------
// Role rollup
// ---------------------------------------------------------------------------

export interface RoleFill {
  role: FacultyRole
  role_label: string
  required: number
  filled: number
}

export interface BlockRollup {
  required: number
  filled: number
  /** required - filled, floored at 0. */
  unfilled: number
  /** Per-talk breakdown, keyed by talk id; block-level roles under `null`. */
  byTalk: Map<string | null, RoleFill[]>
}

function occupies(a: BuilderAssignment): boolean {
  return !VACATING_STATUSES.has((a.status ?? "").toLowerCase())
}

function key(talkId: string | null | undefined, role: string): string {
  return `${talkId ?? ""}::${role}`
}

/**
 * "12 of 13 roles filled" for a block, and the per-talk detail behind it.
 *
 * Counts at both grains: a chairperson belongs to the block, a speaker or
 * panellist to a talk. Extra people beyond the requirement do not inflate the
 * filled count past what was asked for — six panellists against a requirement
 * of six reads 6 of 6, and a seventh does not make it 7 of 6.
 */
export function rollupBlockRoles(
  blockId: string,
  requirements: readonly BuilderRequirement[],
  assignments: readonly BuilderAssignment[]
): BlockRollup {
  const filledCounts = new Map<string, number>()
  for (const a of assignments) {
    if (a.session_id !== blockId) continue
    if (!occupies(a)) continue
    const k = key(a.talk_id, a.role)
    filledCounts.set(k, (filledCounts.get(k) ?? 0) + 1)
  }

  const byTalk = new Map<string | null, RoleFill[]>()
  let required = 0
  let filled = 0

  for (const r of requirements) {
    if (r.session_id !== blockId) continue
    const talkId = r.talk_id ?? null
    const got = Math.min(filledCounts.get(key(talkId, r.role)) ?? 0, r.required_count)

    required += r.required_count
    filled += got

    const list = byTalk.get(talkId) ?? []
    list.push({
      role: r.role,
      role_label: ROLE_LABELS[r.role].one,
      required: r.required_count,
      filled: got,
    })
    byTalk.set(talkId, list)
  }

  return { required, filled, unfilled: Math.max(0, required - filled), byTalk }
}

/**
 * The block header's status line.
 *   nothing declared -> "No roles set"
 *   all filled       -> "All roles filled"
 *   otherwise        -> "1 unfilled"
 */
export function describeRollup(rollup: BlockRollup): string {
  if (rollup.required === 0) return "No roles set"
  if (rollup.unfilled === 0) return "All roles filled"
  return `${rollup.unfilled} unfilled`
}

/** "5 talks · 12 of 13 roles filled" — the talks-section subheading. */
export function describeBlockSummary(talkCount: number, rollup: BlockRollup): string {
  const talks = `${talkCount} talk${talkCount === 1 ? "" : "s"}`
  if (rollup.required === 0) return talks
  return `${talks} · ${rollup.filled} of ${rollup.required} roles filled`
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

/**
 * Running order within a block: display_order first, then start_time, then
 * created position. A talk with no time keeps its place in the list rather than
 * jumping to the end — it has been added deliberately and is simply not yet
 * scheduled.
 */
export function sortTalks(talks: readonly BuilderTalk[]): BuilderTalk[] {
  return [...talks].sort((a, b) => {
    const ao = a.display_order ?? 0
    const bo = b.display_order ?? 0
    if (ao !== bo) return ao - bo
    const as = toMinutes(a.start_time)
    const bs = toMinutes(b.start_time)
    if (as !== null && bs !== null && as !== bs) return as - bs
    if (as === null && bs !== null) return 1
    if (as !== null && bs === null) return -1
    return (a.title ?? "").localeCompare(b.title ?? "")
  })
}

/** Next display_order for a talk appended to a block. */
export function nextTalkOrder(talks: readonly BuilderTalk[]): number {
  if (talks.length === 0) return 0
  return Math.max(...talks.map((t) => t.display_order ?? 0)) + 1
}
