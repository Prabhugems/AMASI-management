// Non-blocking check-in time-window check. Extends the "Tito model" fail-safe
// bias already used elsewhere in check-in (repeat scans always succeed rather
// than erroring): an early/late scan gets a warning attached to an otherwise
// successful response, never a rejection. A false rejection would strand a
// real, paid attendee with no recourse at a live event desk.
export interface TimeWindowResult {
  withinWindow: boolean
  warning: string | null
}

export function checkTimeWindow(
  list: { starts_at?: string | null; ends_at?: string | null },
  now: Date = new Date()
): TimeWindowResult {
  if (list.starts_at) {
    const startsAt = new Date(list.starts_at)
    if (!isNaN(startsAt.getTime()) && now < startsAt) {
      return { withinWindow: false, warning: `Early check-in — this list opens at ${formatWindowTime(startsAt)}` }
    }
  }
  if (list.ends_at) {
    const endsAt = new Date(list.ends_at)
    if (!isNaN(endsAt.getTime()) && now > endsAt) {
      return { withinWindow: false, warning: `Late check-in — this list closed at ${formatWindowTime(endsAt)}` }
    }
  }
  return { withinWindow: true, warning: null }
}

function formatWindowTime(d: Date): string {
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}
