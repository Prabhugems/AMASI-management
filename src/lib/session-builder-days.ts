// Which days a Session Builder shows, and where a block belongs among them.
//
// FIXES A REPORTED BUG. Days used to be derived from the dates blocks already
// carried:
//
//   const days = [...new Set(blocks.map(b => b.session_date))].sort()
//
// Three things went wrong from that, all observed live:
//   1. A brand-new event had no day tabs and no default date, so the first
//      block had to be dated from memory — and a block was created on 27 Aug
//      for an event running 6-7 Aug.
//   2. Nothing noticed the date was outside the event at all.
//   3. Worst: the stray date became its own tab, the first tab won by default,
//      and the block looked like it had vanished.
//
// The calendar belongs to the EVENT. Day 1 is the event's first day whether or
// not anything is scheduled on it, and a block outside that range is surfaced
// rather than hidden behind a phantom tab.

export interface EventWindow {
  start_date: string | null
  end_date: string | null
}

export interface DatedBlock {
  id: string
  session_date: string | null
}

export interface BuilderDay {
  /** ISO date, or null for the "not scheduled yet" bucket. */
  date: string | null
  /** "Day 1", or "Unscheduled" / "Outside the event". */
  label: string
  /** True when this day is part of the event's own range. */
  withinEvent: boolean
  blockCount: number
}

const DAY_MS = 86_400_000

/** Every date from start to end inclusive. Empty if the window is unusable. */
export function eventDays(window: EventWindow): string[] {
  if (!window.start_date || !window.end_date) return []
  const start = Date.parse(window.start_date)
  const end = Date.parse(window.end_date)
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return []

  // Guard against an absurd range producing thousands of tabs.
  const span = Math.round((end - start) / DAY_MS)
  if (span > 60) return []

  return Array.from({ length: span + 1 }, (_, i) =>
    new Date(start + i * DAY_MS).toISOString().slice(0, 10)
  )
}

/**
 * The tab strip.
 *
 * Always the event's own days first, in order, present even when empty — the
 * coordinator needs somewhere to put the first block. Then, only if blocks
 * exist there, a tab per out-of-range date and one for undated blocks. Nothing
 * is ever unreachable.
 */
export function buildDays(window: EventWindow, blocks: readonly DatedBlock[]): BuilderDay[] {
  const counts = new Map<string | null, number>()
  for (const b of blocks) {
    const key = b.session_date ?? null
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const within = eventDays(window)
  const days: BuilderDay[] = within.map((date, i) => ({
    date,
    label: `Day ${i + 1}`,
    withinEvent: true,
    blockCount: counts.get(date) ?? 0,
  }))

  const strays = [...counts.keys()]
    .filter((d): d is string => d !== null && !within.includes(d))
    .sort()

  for (const date of strays) {
    days.push({
      date,
      label: "Outside the event",
      withinEvent: false,
      blockCount: counts.get(date) ?? 0,
    })
  }

  if ((counts.get(null) ?? 0) > 0) {
    days.push({
      date: null,
      label: "Unscheduled",
      withinEvent: false,
      blockCount: counts.get(null) ?? 0,
    })
  }

  return days
}

/**
 * Which tab to open on.
 *
 * The event's first day, so a new event lands somewhere sensible. Not "the
 * earliest date any block happens to have" — that is what hid a block behind a
 * later tab.
 */
export function defaultDay(days: readonly BuilderDay[]): string | null {
  return days.find((d) => d.withinEvent)?.date ?? days[0]?.date ?? null
}

/** Warning text when a block sits outside the event, or "" when it does not. */
export function describeOutOfRange(window: EventWindow, date: string | null): string {
  if (!date || !window.start_date || !window.end_date) return ""
  if (date >= window.start_date && date <= window.end_date) return ""
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  return `This is outside the event, which runs ${fmt(window.start_date)} – ${fmt(window.end_date)}.`
}
