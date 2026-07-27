import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/server"
import { isValidUUID } from "@/lib/validation"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

// GET /api/kiosk/delegates?event_id=&token= -- bulk delegate roster for
// the self-check-in kiosk's local delegate cache (Stage 1 of the
// offline-first kiosk redesign, see
// docs/superpowers/plans/2026-07-27-kiosk-offline-first-stage1.md).
//
// This is the largest single PII export in the app (~2,000 full records
// in one response), so unlike /api/kiosk/checkin's bare "unguessable UUID
// pair" trust model, this route requires the list's own access_token --
// the same credential /checkin/access/[token] and /print/[token] already
// use, auto-generated on every list by a DB trigger (never null). An
// admin session does not substitute for it.
//
// Matching scope deliberately mirrors /api/kiosk/checkin's existing
// per-scan search exactly: event_id only, no ticket_type_ids/addon_ids
// filtering. The local cache and the server's live search must never
// disagree about who is eligible to self-check-in.
export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request)
  const rateLimit = checkRateLimit(`kiosk-delegates:${clientIp}`, "public")
  if (!rateLimit.success) return rateLimitExceededResponse(rateLimit)

  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("event_id")
  const token = searchParams.get("token")

  if (!eventId || !isValidUUID(eventId)) {
    return NextResponse.json({ error: "Invalid event." }, { status: 400 })
  }
  if (!token) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 })
  }

  try {
    const supabase = await createAdminClient()

    const { data: list } = await (supabase as any)
      .from("checkin_lists")
      .select("id, event_id, list_purpose, access_token, access_token_expires_at")
      .eq("access_token", token)
      .maybeSingle()

    if (!list) {
      return NextResponse.json({ error: "Invalid access token." }, { status: 401 })
    }
    if (list.access_token_expires_at && new Date(list.access_token_expires_at) < new Date()) {
      return NextResponse.json({ error: "This link has expired." }, { status: 401 })
    }
    if (list.event_id !== eventId) {
      return NextResponse.json({ error: "Check-in list not found." }, { status: 404 })
    }

    // Self check-in is entry-only, permanently (see /api/kiosk/checkin) --
    // nothing worth caching for a list the kiosk will never accept a scan
    // against.
    if (list.list_purpose === "collection") {
      return NextResponse.json({ delegates: [] })
    }

    const { data: registrations, error } = await (supabase as any)
      .from("registrations")
      .select(`
        id,
        registration_number,
        attendee_name,
        attendee_email,
        attendee_phone,
        attendee_designation,
        attendee_institution
      `)
      .eq("event_id", eventId)

    if (error) {
      Sentry.captureException(error, { tags: { route: "kiosk/delegates" }, extra: { eventId, listId: list.id } })
      return NextResponse.json({ error: "Failed to load delegate roster." }, { status: 500 })
    }

    const delegates = (registrations || []).map((r: any) => ({
      id: r.id,
      registration_number: r.registration_number,
      attendee_name: r.attendee_name,
      attendee_email: r.attendee_email,
      attendee_phone: r.attendee_phone,
      attendee_designation: r.attendee_designation,
      attendee_institution: r.attendee_institution,
    }))

    return NextResponse.json({ delegates })
  } catch (error) {
    Sentry.captureException(error, { tags: { route: "kiosk/delegates" }, extra: { eventId } })
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 })
  }
}
