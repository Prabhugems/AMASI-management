// Shared station/membership lookup for /api/kiosk/delegates and
// /api/kiosk/checkin -- the QUERY only, never the authorization decision. A
// membership miss means "hard reject" to /delegates (see its module comment)
// but "fall through to an unattributed check-in" to /checkin (which was
// never token-gated) -- each route makes that call itself, on purpose, so
// one route's semantics can never leak into the other on a future edit.
import { hashStationToken } from "@/lib/kiosk-station-auth"

export interface KioskStationRow {
  id: string
  event_id: string
  mode: string
  revoked_at: string | null
  name: string
  print_station_id: string | null
  auto_print_badge: boolean
  attended: boolean
}

export async function resolveStationByToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  stationToken: string
): Promise<{ station: KioskStationRow | null; error: unknown }> {
  const { data, error } = await supabase
    .from("kiosk_stations")
    .select("id, event_id, mode, revoked_at, name, print_station_id, auto_print_badge, attended")
    .eq("access_token_hash", hashStationToken(stationToken))
    .maybeSingle()
  return { station: (data as KioskStationRow | null) ?? null, error }
}

export async function stationServesList(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  stationId: string,
  checkinListId: string
): Promise<{ isMember: boolean; error: unknown }> {
  const { data, error } = await supabase
    .from("kiosk_station_lists")
    .select("station_id")
    .eq("station_id", stationId)
    .eq("checkin_list_id", checkinListId)
    .maybeSingle()
  return { isMember: !!data, error }
}
