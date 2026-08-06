import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/server"
import { hashStationToken } from "@/lib/kiosk-station-auth"
import { StationSelfTest } from "@/components/kiosk/StationSelfTest"

// Read-only diagnostics page for the admin setting up a physical tablet
// before it ships (work order §10) -- reachable from the station menu, but
// deliberately never a job a volunteer would pick. Reuses the exact same
// station-token lookup as the main /kiosk-station/[token] route so a bad or
// revoked token fails the same way here as it does for the real kiosk.
export default async function StationSelfTestPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createAdminClient()

  const { data: station, error } = await (supabase as any)
    .from("kiosk_stations")
    .select("id, name, event_id, mode, print_station_id, revoked_at")
    .eq("access_token_hash", hashStationToken(token))
    .maybeSingle()

  if (error) {
    Sentry.captureException(error, { tags: { route: "kiosk-station/[token]/self-test" } })
    return <ErrorScreen message="Could not look up this station. Try reloading." />
  }

  if (!station || station.revoked_at || (station.mode !== "checkin" && station.mode !== "checkin_and_print")) {
    return <ErrorScreen message="This station link isn't valid or has been revoked." />
  }

  let printSettings: any = null
  let printerType: "usb" | "browser" = "usb"

  if (station.mode === "checkin_and_print" && station.print_station_id) {
    const { data: printStation } = await (supabase as any)
      .from("print_stations")
      .select("print_settings")
      .eq("id", station.print_station_id)
      .maybeSingle()
    printSettings = printStation?.print_settings || null
    printerType = printSettings?.printer_type === "browser" ? "browser" : "usb"
  }

  const { data: joinRows } = await (supabase as any)
    .from("kiosk_station_lists")
    .select("checkin_list_id, checkin_lists (id, name)")
    .eq("station_id", station.id)

  const lists = (joinRows || [])
    .map((r: any) => r.checkin_lists)
    .filter((l: unknown): l is { id: string; name: string } => Boolean(l))

  return (
    <StationSelfTest
      stationToken={token}
      stationName={station.name}
      mode={station.mode}
      printerConfigured={Boolean(station.print_station_id)}
      printerType={printerType}
      lists={lists}
    />
  )
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center p-6">
      <p className="text-center text-lg text-muted-foreground max-w-sm">{message}</p>
    </div>
  )
}
