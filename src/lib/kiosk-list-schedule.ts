// Pure, on-device open/closed computation for a shared kiosk station's
// assigned lists. Deliberately separate from src/lib/checkin-time-window.ts
// (that module drives a different, soft-warning-only behavior on
// checkin_lists.starts_at/ends_at, live in production today) -- this one
// hard-gates which menu rows are tappable, so it must never share code or
// data with that system. See docs/superpowers/specs/2026-07-29-kiosk-shared-stations-scheduled-lists-design.md.

export interface ScheduledList {
  kiosk_opens_at: string | null
  kiosk_closes_at: string | null
  kiosk_force_state: "open" | "closed" | null
}

export function computeListState(list: ScheduledList, now: Date = new Date()): "open" | "closed" {
  if (list.kiosk_force_state) return list.kiosk_force_state
  if (list.kiosk_opens_at && now < new Date(list.kiosk_opens_at)) return "closed"
  if (list.kiosk_closes_at && now > new Date(list.kiosk_closes_at)) return "closed"
  return "open"
}

// For the "closes in 5 minutes" banner. null when there's nothing to count
// down to: no closes_at, a force_state override (the schedule doesn't apply
// at all), or already closed.
export function minutesUntilClose(list: ScheduledList, now: Date = new Date()): number | null {
  if (list.kiosk_force_state) return null
  if (!list.kiosk_closes_at) return null
  if (computeListState(list, now) === "closed") return null
  const diffMs = new Date(list.kiosk_closes_at).getTime() - now.getTime()
  return Math.floor(diffMs / 60000)
}
