import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isValidUUID } from "@/lib/validation"
import { checkTimeWindow } from "@/lib/checkin-time-window"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

// POST /api/kiosk/checkin -- public self check-in for the /kiosk/[eventId]/[listId]
// page. The kiosk runs as the anon browser client, but checkin_records has RLS
// enabled with no policy, so a direct browser insert is always denied. This
// route performs the lookup + insert server-side with the admin client (which
// bypasses RLS), mirroring every other check-in path in the app.
//
// Stage 2 (docs/superpowers/specs/2026-07-27-kiosk-stage2-checkin-authority-design.md):
// the client (kiosk-sync-worker.ts) resolves `registration_id` itself from its
// local IndexedDB cache and sends it directly -- this route trusts that
// resolution instead of re-deriving one via fuzzy search, and uses `scan_id`
// to make retries of the same scan deterministic. `search` is kept only for
// error-message/Sentry context, never for matching.
export async function POST(request: NextRequest) {
  // Public, unauthenticated -- rate-limit by IP to blunt enumeration while
  // staying generous enough for a real kiosk queue.
  const clientIp = getClientIp(request)
  const rateLimit = checkRateLimit(`kiosk-checkin:${clientIp}`, "public")
  if (!rateLimit.success) return rateLimitExceededResponse(rateLimit)

  try {
    const body = await request.json().catch(() => ({}))
    const eventId = body.event_id as string | undefined
    const checkinListId = body.checkin_list_id as string | undefined
    const registrationId = body.registration_id as string | undefined
    const scanId = body.scan_id as string | undefined
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept only for a future error-message/Sentry addition, never used for matching
    const searchTerm = (body.search ?? "").toString().trim()

    if (!eventId || !isValidUUID(eventId)) {
      return NextResponse.json({ success: false, message: "Invalid event." }, { status: 400 })
    }
    if (!checkinListId || !isValidUUID(checkinListId)) {
      return NextResponse.json({ success: false, message: "Invalid check-in list." }, { status: 400 })
    }
    if (!registrationId || !isValidUUID(registrationId)) {
      return NextResponse.json({ success: false, message: "Invalid registration." }, { status: 400 })
    }
    if (!scanId || !isValidUUID(scanId)) {
      return NextResponse.json({ success: false, message: "Invalid scan." }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // --- scan_id replay check, first, before anything else -------------
    // A row found here was, by construction, inserted BY this exact scan_id
    // (the "already checked in via a different scan" path below never
    // attaches a scan_id to the pre-existing row it reports on) -- so a hit
    // here always represents an original FRESH insert, and alreadyCheckedIn
    // is always false. The registration_id in this request is not consulted
    // at all on this path -- the original recorded registration always wins.
    const { data: existingByScan } = await (supabase as any)
      .from("checkin_records")
      .select("id, registration_id, checked_in_at")
      .eq("scan_id", scanId)
      .maybeSingle()

    if (existingByScan) {
      const { data: originalRegistration } = await (supabase as any)
        .from("registrations")
        .select(`
          id,
          registration_number,
          attendee_name,
          attendee_email,
          attendee_phone,
          attendee_designation,
          attendee_institution,
          ticket_type:ticket_types(name)
        `)
        .eq("id", existingByScan.registration_id)
        .maybeSingle()

      return NextResponse.json({
        success: true,
        message: "Check-in successful!",
        registration: originalRegistration,
        alreadyCheckedIn: false,
      })
    }

    // --- Fresh resolution path -------------------------------------------
    const { data: registration } = await (supabase as any)
      .from("registrations")
      .select(`
        id,
        event_id,
        ticket_type_id,
        registration_number,
        attendee_name,
        attendee_email,
        attendee_phone,
        attendee_designation,
        attendee_institution,
        ticket_type:ticket_types(name)
      `)
      .eq("id", registrationId)
      .maybeSingle()

    if (!registration || registration.event_id !== eventId) {
      return NextResponse.json({ success: false, message: "Registration not found." }, { status: 404 })
    }

    const { data: list } = await (supabase as any)
      .from("checkin_lists")
      .select("id, event_id, list_purpose, ticket_type_ids, addon_ids, starts_at, ends_at")
      .eq("id", checkinListId)
      .maybeSingle()

    if (!list || list.event_id !== eventId) {
      return NextResponse.json({ success: false, message: "Check-in list not found." }, { status: 404 })
    }

    // --- List eligibility: mirrors src/app/api/checkin/access/[accessToken]/attendees/route.ts:49-84 exactly.
    // Empty/null ticket_type_ids/addon_ids = unrestricted, matching that
    // route's convention. This is the response the client never
    // distinguishes from "doesn't exist" / "wrong event" -- same 404,
    // same message, so a caller can't tell which reason applies.
    if (Array.isArray(list.ticket_type_ids) && list.ticket_type_ids.length > 0) {
      if (!list.ticket_type_ids.includes(registration.ticket_type_id)) {
        return NextResponse.json({ success: false, message: "Registration not found." }, { status: 404 })
      }
    }
    if (Array.isArray(list.addon_ids) && list.addon_ids.length > 0) {
      // Scoped to this ONE registration -- this route only ever needs a
      // single boolean, unlike the roster-building use of this same
      // eligibility pattern in /api/kiosk/delegates and
      // /api/checkin/access/[accessToken]/attendees, which genuinely need
      // the full eligible-ID set. An unscoped `.in("addon_id", ...)` here
      // would fetch every registration_addons row for the addon across the
      // WHOLE event -- past Supabase's ~1000-row cap that silently 404s
      // eligible delegates once an addon has enough registrants.
      const { data: addonRow } = await (supabase as any)
        .from("registration_addons")
        .select("registration_id")
        .eq("registration_id", registration.id)
        .in("addon_id", list.addon_ids)
        .limit(1)
        .maybeSingle()
      if (!addonRow) {
        return NextResponse.json({ success: false, message: "Registration not found." }, { status: 404 })
      }
    }

    // event_id/ticket_type_id were only fetched for the checks above --
    // strip them before this registration goes into any client response,
    // matching the field set the pre-Stage-2 route already returned.
    const { event_id: _regEventId, ticket_type_id: _regTicketTypeId, ...publicRegistration } = registration

    const { warning: timeWindowWarning } = checkTimeWindow(list)

    // The kiosk is unattended -- nobody is standing there to stop a delegate
    // self-serving a second kit/paper/badge. Collection lists (repeat scan
    // means "do not issue again") are staff-scanner-only; the kiosk is
    // entry-only by design, permanently.
    if (list.list_purpose === "collection") {
      return NextResponse.json(
        { success: false, message: "Self check-in isn't available for this list. Please see a staff member." },
        { status: 403 }
      )
    }

    // Already checked in on this list via some other path (e.g. staff
    // scanner, or a race -- see below)? allow_multiple_checkins is
    // intentionally ignored: UNIQUE(checkin_list_id, registration_id) means
    // a second insert always violates the constraint. This row's scan_id is
    // NOT backfilled -- it belongs to whatever originally created it.
    const { data: existing } = await (supabase as any)
      .from("checkin_records")
      .select("id")
      .eq("registration_id", registration.id)
      .eq("checkin_list_id", checkinListId)
      .is("checked_out_at", null)
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        success: true,
        message: "You're already checked in!",
        registration: publicRegistration,
        alreadyCheckedIn: true,
      })
    }

    const now = new Date().toISOString()

    const { error: insertError } = await (supabase as any)
      .from("checkin_records")
      .insert({
        registration_id: registration.id,
        checkin_list_id: checkinListId,
        checked_in_at: now,
        checked_in_by: "Self check-in (kiosk)",
        scan_id: scanId,
      })

    if (insertError) {
      // 23505 = unique_violation on (checkin_list_id, registration_id): a
      // concurrent self-checkin from the same kiosk won the race. That's a
      // successful idempotent check-in, not a failure -- same pattern as
      // /api/verify/[token] and /api/checkin. This request's OWN scan_id is
      // never attached to the winning row (a different request's insert
      // created it) -- accepted, rare gap: that scan can never afterwards
      // be distinguished from a genuine cross-station duplicate by scan_id
      // alone. The check-in itself is correct either way.
      if (insertError.code === "23505") {
        return NextResponse.json({
          success: true,
          message: "You're already checked in!",
          registration: publicRegistration,
          alreadyCheckedIn: true,
        })
      }
      console.error("Kiosk check-in insert failed:", insertError)
      return NextResponse.json(
        { success: false, message: "Failed to check in. Please try again." },
        { status: 500 }
      )
    }

    await (supabase as any)
      .from("registrations")
      .update({ checked_in: true, checked_in_at: now })
      .eq("id", registration.id)

    return NextResponse.json({
      success: true,
      message: "Check-in successful!",
      registration: publicRegistration,
      alreadyCheckedIn: false,
      ...(timeWindowWarning && { warning: timeWindowWarning }),
    })
  } catch (error: any) {
    console.error("Kiosk check-in error:", error)
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
