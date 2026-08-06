import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isValidUUID } from "@/lib/validation"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

// POST /api/kiosk/print-sync -- opportunistic, best-effort sync of a badge
// print that already happened locally (WebUSB, offline-capable -- see
// KioskCheckinScreen's printBadge) into print_jobs, so the standalone Print
// Station admin view's audit trail includes kiosk-triggered prints. This
// never gates or blocks the print itself, which has already completed by
// the time this is called -- same bare "unguessable UUID pair" trust model
// as /api/kiosk/checkin (this route is not the authorization boundary; the
// print already happened offline, possibly minutes or hours earlier).
export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request)
  const rateLimit = checkRateLimit(`kiosk-print-sync:${clientIp}`, "public")
  if (!rateLimit.success) return rateLimitExceededResponse(rateLimit)

  const body = await request.json().catch(() => ({}))
  const printStationId = body.print_station_id as string | undefined
  const registrationId = body.registration_id as string | undefined
  const printedAt = body.printed_at as number | undefined
  const status = body.status as string | undefined

  if (!printStationId || !isValidUUID(printStationId)) {
    return NextResponse.json({ error: "Invalid print station." }, { status: 400 })
  }
  if (!registrationId || !isValidUUID(registrationId)) {
    return NextResponse.json({ error: "Invalid registration." }, { status: 400 })
  }
  // Only a successful local print is ever synced here -- the caller
  // (KioskCheckinScreen's syncPrintLog) never sends a "failed" local print
  // to this endpoint at all, so any other value (including "failed" or the
  // pre-fix "success") is rejected outright rather than silently accepted.
  // "completed" matches the vocabulary every other print_jobs writer in
  // this codebase uses (see src/app/api/print-stations/print/route.ts) --
  // a trigger_update_print_station_stats DB trigger fires on every INSERT
  // regardless of status, and allow_reprint/max_reprints enforcement
  // elsewhere filters on status = "completed", so any other value here
  // would inflate stats and be invisible to reprint limits.
  if (!printedAt || status !== "completed") {
    return NextResponse.json({ error: "Invalid print outcome." }, { status: 400 })
  }

  const supabase = await createAdminClient()
  const { error } = await (supabase as any).from("print_jobs").insert({
    print_station_id: printStationId,
    registration_id: registrationId,
    status: "completed",
    printed_at: new Date(printedAt).toISOString(),
    device_info: { source: "kiosk" },
  })

  if (error) {
    return NextResponse.json({ error: "Failed to sync print job." }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
