// Pure derivation of a discrete kiosk station status category, for the
// admin-page redesign's colored status dot + filtering ("show only Quiet
// stations"). Mirrors the precedence already used inline in
// src/app/events/[eventId]/kiosk-stations/page.tsx's relativeLastSeen() /
// its call site ({station.revoked_at ? "Revoked" : relativeLastSeen(...)}):
// revoked_at always wins regardless of last_seen_at, then never-connected,
// then a time threshold.

export type KioskStationStatus = "online" | "quiet" | "pending" | "revoked"

const QUIET_THRESHOLD_MS = 15 * 60 * 1000 // 15 minutes without a heartbeat

export function computeStationStatus(
  station: { revoked_at: string | null; last_seen_at: string | null },
  now: Date = new Date()
): KioskStationStatus {
  if (station.revoked_at) return "revoked"
  if (!station.last_seen_at) return "pending"
  const elapsed = now.getTime() - new Date(station.last_seen_at).getTime()
  return elapsed > QUIET_THRESHOLD_MS ? "quiet" : "online"
}

export const STATION_STATUS_LABELS: Record<KioskStationStatus, string> = {
  online: "Active",
  quiet: "Quiet",
  pending: "Pending",
  revoked: "Revoked",
}
