// Timing a session: durations, ripple, anchors, and the bar you see it in.
//
// Pure and framework-free, like the rest of src/lib/agenda-*.
//
// WHY THIS SHAPE
//
// A real programme (counted from a live AMASI sheet) runs 10, 20, 20, 20, 15,
// 15, 5, 15, 20, 20, 20, 15, 15, 15, 45, 25, 25, 25, 20, 40 — seven distinct
// durations across 21 rows. So "split the session evenly" is the wrong answer
// for nearly every row and is only ever a first stroke on an empty session.
//
// What the same sheet does show is runs of equal length separated by fixed
// points: seven 20-minute talks, six 15s, and LUNCH nailed to 13:00-13:45. So
// the two operations worth optimising are:
//
//   * set a duration and let everything after it move (ripple), and
//   * never let that move something that must not move (anchors).
//
// ANCHORS ARE JUST BREAKS. A break row is already in the model and already
// means "this is not a talk" — LUNCH, tea. Treating breaks as the things that
// hold their position introduces no new concept for a coordinator to learn: no
// lock icons, no extra column, no explanation. Breaks partition the session
// into runs, and talks flow within their run.

export interface TimedTalk {
  id: string
  start_time: string | null
  end_time: string | null
  talk_type?: string | null
  display_order?: number | null
  /** Only used to label a timeline segment; timing never depends on it. */
  title?: string | null
}

export interface TimeBlock {
  start_time: string | null
  end_time: string | null
}

/** New start/end for a talk, in HH:MM. */
export interface Retimed {
  id: string
  start_time: string
  end_time: string
}

export function toMinutes(t: string | null | undefined): number | null {
  if (!t || !t.includes(":")) return null
  const [h, m] = t.split(":").map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

export function toClock(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`
}

/** A break holds its position; everything else flows around it. */
export function isAnchor(talk: TimedTalk): boolean {
  return talk.talk_type === "break"
}

export function durationOf(talk: TimedTalk): number | null {
  const s = toMinutes(talk.start_time)
  const e = toMinutes(talk.end_time)
  if (s === null || e === null || e <= s) return null
  return e - s
}

/** Running order: display_order, then start time, then a stable id tiebreak. */
export function inRunningOrder(talks: readonly TimedTalk[]): TimedTalk[] {
  return [...talks].sort((a, b) => {
    const ao = a.display_order ?? 0
    const bo = b.display_order ?? 0
    if (ao !== bo) return ao - bo
    const as = toMinutes(a.start_time)
    const bs = toMinutes(b.start_time)
    if (as !== null && bs !== null && as !== bs) return as - bs
    if (as === null && bs !== null) return 1
    if (as !== null && bs === null) return -1
    return a.id.localeCompare(b.id)
  })
}

// ---------------------------------------------------------------------------
// Fit
// ---------------------------------------------------------------------------

export interface Fit {
  /** Minutes the session itself spans. 0 when it has no times yet. */
  blockMinutes: number
  /** Minutes covered by talks, overlaps counted once. */
  plannedMinutes: number
  /** Unfilled minutes inside the session. */
  freeMinutes: number
  /** Minutes talks run past the session's end. */
  overflowMinutes: number
  /** Talks with no time set at all. */
  untimedCount: number
}

/**
 * How full the session is.
 *
 * Overlapping talks are merged before measuring, so two parallel talks on two
 * screens consume their slot once rather than making the session look
 * over-subscribed.
 */
export function computeFit(block: TimeBlock, talks: readonly TimedTalk[]): Fit {
  const bs = toMinutes(block.start_time)
  const be = toMinutes(block.end_time)
  const blockMinutes = bs !== null && be !== null && be > bs ? be - bs : 0

  const spans = talks
    .map((t) => [toMinutes(t.start_time), toMinutes(t.end_time)] as const)
    .filter((v): v is readonly [number, number] => v[0] !== null && v[1] !== null && v[1] > v[0])
    .sort((a, b) => a[0] - b[0])

  const merged: Array<[number, number]> = []
  for (const [s, e] of spans) {
    const last = merged[merged.length - 1]
    if (last && s <= last[1]) last[1] = Math.max(last[1], e)
    else merged.push([s, e])
  }

  let planned = 0
  let overflow = 0
  for (const [s, e] of merged) {
    planned += e - s
    if (be !== null && e > be) overflow += e - Math.max(s, be)
  }

  const insideCovered = merged.reduce((n, [s, e]) => {
    if (bs === null || be === null) return n
    const from = Math.max(s, bs)
    const to = Math.min(e, be)
    return n + Math.max(0, to - from)
  }, 0)

  return {
    blockMinutes,
    plannedMinutes: planned,
    freeMinutes: Math.max(0, blockMinutes - insideCovered),
    overflowMinutes: overflow,
    untimedCount: talks.filter((t) => durationOf(t) === null).length,
  }
}

/** "6h 45m of 7h · 15m free" — the line under the bar. */
export function describeFit(fit: Fit): string {
  const fmt = (m: number) => {
    const h = Math.floor(m / 60)
    const r = m % 60
    if (h === 0) return `${r}m`
    if (r === 0) return `${h}h`
    return `${h}h ${r}m`
  }
  if (fit.blockMinutes === 0) return fit.plannedMinutes > 0 ? `${fmt(fit.plannedMinutes)} planned` : ""

  const parts = [`${fmt(Math.min(fit.plannedMinutes, fit.blockMinutes))} of ${fmt(fit.blockMinutes)}`]
  if (fit.freeMinutes > 0) parts.push(`${fmt(fit.freeMinutes)} free`)
  if (fit.overflowMinutes > 0) parts.push(`${fmt(fit.overflowMinutes)} over`)
  if (fit.untimedCount > 0) {
    parts.push(`${fit.untimedCount} row${fit.untimedCount === 1 ? "" : "s"} untimed`)
  }
  return parts.join(" · ")
}

// ---------------------------------------------------------------------------
// The bar
// ---------------------------------------------------------------------------

export type SegmentKind = "talk" | "break" | "gap" | "overflow"

export interface TimelineSegment {
  kind: SegmentKind
  /** Present for talk and break segments. */
  id?: string
  label: string
  start: string
  end: string
  minutes: number
  /** Percentages across the session, for rendering without any layout maths in the view. */
  leftPct: number
  widthPct: number
}

/**
 * The session as proportional segments, gaps included.
 *
 * Gaps are first-class segments rather than absences, because an unaccounted
 * quarter of an hour is exactly what a table hides and a bar should show.
 */
export function buildTimeline(
  block: TimeBlock,
  talks: readonly TimedTalk[],
  titleOf: (t: TimedTalk) => string = (t) => t.id
): TimelineSegment[] {
  const bs = toMinutes(block.start_time)
  const be = toMinutes(block.end_time)
  if (bs === null || be === null || be <= bs) return []

  const span = be - bs
  const pct = (m: number) => (m / span) * 100

  const placed = inRunningOrder(talks)
    .map((t) => ({ t, s: toMinutes(t.start_time), e: toMinutes(t.end_time) }))
    .filter((v): v is { t: TimedTalk; s: number; e: number } => v.s !== null && v.e !== null && v.e > v.s)
    .sort((a, b) => a.s - b.s)

  const out: TimelineSegment[] = []
  let cursor = bs

  for (const { t, s, e } of placed) {
    if (s > cursor) {
      out.push({
        kind: "gap",
        label: "Unscheduled",
        start: toClock(cursor),
        end: toClock(s),
        minutes: s - cursor,
        leftPct: pct(cursor - bs),
        widthPct: pct(s - cursor),
      })
    }
    const clampedEnd = Math.min(e, be)
    if (clampedEnd > Math.max(s, bs)) {
      out.push({
        kind: isAnchor(t) ? "break" : "talk",
        id: t.id,
        label: titleOf(t),
        start: toClock(s),
        end: toClock(e),
        minutes: e - s,
        leftPct: pct(Math.max(s, bs) - bs),
        widthPct: pct(clampedEnd - Math.max(s, bs)),
      })
    }
    if (e > be) {
      out.push({
        kind: "overflow",
        id: t.id,
        label: `${titleOf(t)} runs past the end`,
        start: toClock(be),
        end: toClock(e),
        minutes: e - be,
        leftPct: 100,
        widthPct: pct(e - be),
      })
    }
    cursor = Math.max(cursor, e)
  }

  if (cursor < be) {
    out.push({
      kind: "gap",
      label: "Unscheduled",
      start: toClock(cursor),
      end: toClock(be),
      minutes: be - cursor,
      leftPct: pct(cursor - bs),
      widthPct: pct(be - cursor),
    })
  }

  return out
}

// ---------------------------------------------------------------------------
// Ripple
// ---------------------------------------------------------------------------

export interface RetimeResult {
  changes: Retimed[]
  /** Minutes the run overshoots the next anchor or the session end, if any. */
  overflowMinutes: number
  /** The anchor the ripple stopped at, when it did. */
  blockedBy?: string
}

/**
 * Set one talk's duration and flow the rest of its run after it.
 *
 * Ripple stops at the next anchor rather than pushing it: LUNCH does not move
 * to 13:12 because a morning talk grew. The overshoot is reported instead, so
 * the coordinator decides — silently shifting lunch would be the kind of change
 * nobody notices until the day.
 */
export function setDuration(
  block: TimeBlock,
  talks: readonly TimedTalk[],
  talkId: string,
  minutes: number,
  options: { ripple?: boolean } = {}
): RetimeResult {
  const ripple = options.ripple ?? true
  const ordered = inRunningOrder(talks)
  const index = ordered.findIndex((t) => t.id === talkId)
  if (index === -1 || minutes <= 0) return { changes: [], overflowMinutes: 0 }

  const target = ordered[index]
  const start = toMinutes(target.start_time) ?? toMinutes(block.start_time)
  if (start === null) return { changes: [], overflowMinutes: 0 }

  const changes: Retimed[] = [
    { id: target.id, start_time: toClock(start), end_time: toClock(start + minutes) },
  ]

  if (!ripple) return { changes, overflowMinutes: 0 }

  let cursor = start + minutes
  let blockedBy: string | undefined

  for (let i = index + 1; i < ordered.length; i++) {
    const t = ordered[i]

    if (isAnchor(t)) {
      // Ripple stops here. Report how far past the anchor the run now reaches.
      const anchorStart = toMinutes(t.start_time)
      blockedBy = t.id
      return {
        changes,
        overflowMinutes: anchorStart !== null ? Math.max(0, cursor - anchorStart) : 0,
        blockedBy,
      }
    }

    const dur = durationOf(t)
    if (dur === null) continue // untimed rows are left alone rather than invented

    changes.push({ id: t.id, start_time: toClock(cursor), end_time: toClock(cursor + dur) })
    cursor += dur
  }

  const be = toMinutes(block.end_time)
  return {
    changes,
    overflowMinutes: be !== null ? Math.max(0, cursor - be) : 0,
    blockedBy,
  }
}

// ---------------------------------------------------------------------------
// Distribute
// ---------------------------------------------------------------------------

/**
 * Give every talk an equal share of the time between the anchors.
 *
 * A first stroke on an empty session, not a formatter: real programmes have
 * seven different durations, so this is expected to be adjusted afterwards.
 *
 * Anchors partition the session into runs and keep their own times — talks
 * before LUNCH share 09:00-13:00, talks after share 13:45-16:00. Splitting the
 * whole session evenly and letting it walk through lunch would be arithmetically
 * simpler and operationally useless.
 *
 * Remainder minutes go to the earliest talks, so the run ends exactly on its
 * boundary rather than drifting a few minutes short.
 */
export function distributeEvenly(block: TimeBlock, talks: readonly TimedTalk[]): Retimed[] {
  const bs = toMinutes(block.start_time)
  const be = toMinutes(block.end_time)
  if (bs === null || be === null || be <= bs) return []

  const ordered = inRunningOrder(talks)
  if (ordered.length === 0) return []

  const changes: Retimed[] = []

  // Split into runs delimited by anchors.
  let runStart = bs
  let pending: TimedTalk[] = []

  const flush = (runEnd: number) => {
    if (pending.length === 0) return
    const available = Math.max(0, runEnd - runStart)
    const each = Math.floor(available / pending.length)
    let remainder = available - each * pending.length
    let cursor = runStart
    for (const t of pending) {
      const extra = remainder > 0 ? 1 : 0
      remainder -= extra
      const dur = each + extra
      changes.push({ id: t.id, start_time: toClock(cursor), end_time: toClock(cursor + dur) })
      cursor += dur
    }
    pending = []
  }

  for (const t of ordered) {
    if (isAnchor(t)) {
      const aStart = toMinutes(t.start_time)
      const aEnd = toMinutes(t.end_time)
      // An anchor with no time of its own cannot partition anything; treat it
      // as an ordinary row rather than dropping the run.
      if (aStart === null || aEnd === null) {
        pending.push(t)
        continue
      }
      flush(aStart)
      runStart = aEnd
      continue
    }
    pending.push(t)
  }
  flush(be)

  return changes
}
