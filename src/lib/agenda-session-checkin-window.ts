// Pure computation of a session's check-in window (opens_at/closes_at) for
// auto-provisioning its checkin_lists row. See docs/superpowers/specs/
// 2026-07-30-agenda-builder-data-model-design.md, section 5.
//
// events.timezone is an IANA zone string (e.g. "Asia/Kolkata"), but
// sessions.session_date/start_time/end_time are naive local wall-clock
// values with no offset of their own. This resolves the IANA zone's UTC
// offset at the session's own instant using only the built-in Intl API --
// no new date-library dependency -- so it correctly handles any zone this
// system already stores, DST-observing or not.

export interface CheckinWindowSession {
  session_date: string // "YYYY-MM-DD"
  start_time: string // "HH:MM"
  end_time: string // "HH:MM"
}

function getTimezoneOffsetMinutes(timeZone: string, utcGuess: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const parts = Object.fromEntries(dtf.formatToParts(utcGuess).map((p) => [p.type, p.value]))
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  )
  return (asIfUtc - utcGuess.getTime()) / 60000
}

function localWallClockToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number)
  const [hour, minute] = timeStr.split(":").map(Number)
  // First guess: treat the wall-clock values as if they were already UTC.
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
  const offsetMinutes = getTimezoneOffsetMinutes(timeZone, utcGuess)
  return new Date(utcGuess.getTime() - offsetMinutes * 60000)
}

export function computeSessionCheckinWindow(
  session: CheckinWindowSession,
  timezone: string,
  graceMinutes = 15
): { opensAt: string; closesAt: string } {
  const start = localWallClockToUtc(session.session_date, session.start_time, timezone)
  const end = localWallClockToUtc(session.session_date, session.end_time, timezone)
  const opensAt = new Date(start.getTime() - graceMinutes * 60000)
  const closesAt = new Date(end.getTime() + graceMinutes * 60000)
  return { opensAt: opensAt.toISOString(), closesAt: closesAt.toISOString() }
}
