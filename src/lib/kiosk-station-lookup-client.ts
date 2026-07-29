import type { CachedStationName } from "./kiosk-offline-store"

// Resolves a station id to its cached display name for the "where this was
// collected" display on a repeat scan. Never returns a blank string or a
// bare placeholder like "Unknown" -- a null/unresolvable station_id (the
// item was collected before this attribution existed, or via the plain
// staff scanner, which doesn't set station_id at all) must read as
// "collected earlier" rather than looking broken or empty.
export function resolveStationName(stationId: string | null, cachedStations: CachedStationName[]): string {
  if (!stationId) return "collected earlier"
  const match = cachedStations.find((s) => s.id === stationId)
  return match ? match.name : "collected earlier"
}
