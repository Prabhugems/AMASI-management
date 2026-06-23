import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

// GET /api/verify/[token] - Verify a registration token and return attendee info
// This is what gets called when a QR code is scanned
// Accepts either a checkin_token (long secure token) or registration_number (like 121A001)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // Rate limit public lookups
  const clientIp = getClientIp(request)
  const rateLimit = checkRateLimit(`verify:${clientIp}`, "public")
  if (!rateLimit.success) return rateLimitExceededResponse(rateLimit)

  // Public verification accepts ONLY the 32-char secure checkin_token.
  // registration_number is an identifier, never a credential — no public lookup by it.
  if (!token || token.length < 32) {
    return NextResponse.json(
      { valid: false, error: "Invalid token" },
      { status: 400 }
    )
  }

  const supabase = await createAdminClient()

  // Look up registration by secure checkin_token only. No PII columns are
  // selected — the public response returns name + check-in status, not contact data.
  const { data: registration, error } = await (supabase as any)
    .from("registrations")
    .select(`
      id,
      registration_number,
      attendee_name,
      status,
      checked_in,
      checked_in_at,
      event_id,
      ticket_type_id,
      ticket_types (
        id,
        name
      ),
      events (
        id,
        name,
        start_date,
        end_date
      )
    `)
    .eq("checkin_token", token)
    .maybeSingle()

  if (error || !registration) {
    return NextResponse.json(
      { valid: false, error: "Registration not found" },
      { status: 404 }
    )
  }

  // Check if registration is confirmed
  if (registration.status !== "confirmed") {
    return NextResponse.json({
      valid: false,
      error: `Registration is ${registration.status}`,
      registration_number: registration.registration_number,
    }, { status: 400 })
  }

  // Check if a certificate template exists for this registration. Match by
  // ticket type so the verification page shows the right template name (e.g.
  // a delegate isn't told they hold a "Faculty Certificate"); fall back to a
  // catch-all template and then, only when a single active template exists, to
  // that one. Mirrors the selection in /api/certificate/[regNumber]/download.
  let certificateTemplate: { id: string; name: string } | null = null
  try {
    const { data: activeTemplatesRaw } = await (supabase as any)
      .from("certificate_templates")
      .select("id, name, ticket_type_ids")
      .eq("event_id", registration.event_id)
      .eq("is_active", true)

    const activeTemplates = (activeTemplatesRaw || []) as any[]
    const ticketTypeId = registration.ticket_type_id
    const matchesTicket = (t: any) =>
      Array.isArray(t.ticket_type_ids) && ticketTypeId && t.ticket_type_ids.includes(ticketTypeId)
    const isCatchAll = (t: any) => !t.ticket_type_ids || t.ticket_type_ids.length === 0

    const match =
      activeTemplates.find(matchesTicket) ||
      activeTemplates.find(isCatchAll) ||
      (activeTemplates.length === 1 ? activeTemplates[0] : null)
    if (match) {
      certificateTemplate = { id: match.id, name: match.name }
    }
  } catch {
    // No certificate template found - that's fine
  }

  // Public response: name + check-in status only. No email/phone/designation/institution.
  return NextResponse.json({
    valid: true,
    registration: {
      id: registration.id,
      registration_number: registration.registration_number,
      attendee_name: registration.attendee_name,
      checked_in: registration.checked_in,
      checked_in_at: registration.checked_in_at,
      ticket_type: registration.ticket_types,
      event: registration.events,
    },
    certificate: certificateTemplate ? {
      available: true,
      template_id: certificateTemplate.id,
      template_name: certificateTemplate.name,
    } : { available: false },
  })
}

// POST /api/verify/[token] - Check-in using token
// Called by check-in app after scanning QR
// Accepts either a checkin_token (long secure token) or registration_number (like 121A001)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token || token.length < 3) {
    return NextResponse.json(
      { success: false, error: "Invalid token format" },
      { status: 400 }
    )
  }

  // Rate limit
  const clientIp = getClientIp(request)
  const rateLimit = checkRateLimit(`verify-post:${clientIp}`, "public")
  if (!rateLimit.success) return rateLimitExceededResponse(rateLimit)

  const body = await request.json()
  const {
    checkin_list_id,
    access_token,  // Staff access token for authorization
    action = "check_in",
    performed_by,
    device_info
  } = body

  const supabase = await createAdminClient()

  // Require either a valid access_token or checkin_list_id for check-in operations
  if (!access_token) {
    return NextResponse.json(
      { success: false, error: "Staff access token is required" },
      { status: 401 }
    )
  }

  // Verify staff access token and extract the authorized checkin_list_id + event
  let verified_checkin_list_id: string
  let verified_event_id: string
  {
    const { data: checkinList, error: listError } = await (supabase as any)
      .from("checkin_lists")
      .select("id, event_id, name, access_token_expires_at")
      .eq("access_token", access_token)
      .single()

    if (listError || !checkinList) {
      return NextResponse.json(
        { success: false, error: "Invalid staff access token" },
        { status: 401 }
      )
    }

    // Check if access token has expired
    if (checkinList.access_token_expires_at &&
        new Date(checkinList.access_token_expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: "Staff access token has expired" },
        { status: 401 }
      )
    }

    // Use the checkin_list_id from the validated token, not the user-supplied one
    verified_checkin_list_id = checkinList.id
    verified_event_id = checkinList.event_id
  }

  // Determine if this is a checkin_token (long) or registration_number (short).
  // Use >= 32 because reg numbers run up to 20 chars (e.g. "REG-20260605-Q7ILBX2")
  // and the shortest checkin_token is 32. A 20-char threshold misclassifies the
  // older REG-YYYYMMDD-XXXXXXX reg numbers as secure tokens and looks them up in
  // the wrong column, surfacing as "Invalid or expired QR code".
  const isSecureToken = token.length >= 32

  // Look up registration by checkin_token or registration_number
  let query2 = (supabase as any)
    .from("registrations")
    .select(`
      id,
      registration_number,
      attendee_name,
      attendee_email,
      status,
      checked_in,
      event_id,
      ticket_type_id,
      ticket_types (
        id,
        name
      )
    `)

  if (isSecureToken) {
    query2 = query2.eq("checkin_token", token)
  } else {
    // Reg-number lookup is permitted here ONLY because the staff access_token
    // authorizes it, and it is scoped to that token's event so a number can't
    // resolve to a registration in a different event.
    query2 = query2.ilike("registration_number", token).eq("event_id", verified_event_id)
  }

  const { data: registration, error: regError } = await query2.maybeSingle()

  if (regError || !registration) {
    // Log failed attempt
    await logAudit(supabase, {
      checkin_list_id: verified_checkin_list_id,
      action,
      performed_by,
      performed_via: "qr_scan",
      device_info,
      token_used: token,
      success: false,
      error_message: "Invalid token"
    })

    return NextResponse.json(
      { success: false, error: "Invalid or expired QR code" },
      { status: 404 }
    )
  }

  // Check if registration is confirmed
  if (registration.status !== "confirmed") {
    await logAudit(supabase, {
      event_id: registration.event_id,
      checkin_list_id: verified_checkin_list_id,
      registration_id: registration.id,
      action,
      performed_by,
      performed_via: "qr_scan",
      device_info,
      token_used: token,
      success: false,
      error_message: `Registration is ${registration.status}`
    })

    const friendlyError = registration.status === "pending"
      ? `PAYMENT NOT CONFIRMED — ${registration.attendee_name || registration.registration_number}. Please escalate to registration desk; do NOT mark as invalid.`
      : registration.status === "cancelled"
        ? `REGISTRATION CANCELLED — ${registration.attendee_name || registration.registration_number}. Cannot check in.`
        : `Registration is ${registration.status}. Cannot check in.`

    return NextResponse.json({
      success: false,
      error: friendlyError,
      error_code: `registration_${registration.status}`,
      registration_number: registration.registration_number,
      registration: {
        id: registration.id,
        attendee_name: registration.attendee_name,
        attendee_email: registration.attendee_email,
        registration_number: registration.registration_number,
        status: registration.status,
      },
    }, { status: 400 })
  }

  // Perform check-in or check-out
  const isCheckIn = action === "check_in"

  // Check if already checked in for this specific list (prevent duplicate food/meals)
  if (isCheckIn) {
    // Get checkin list settings
    const { data: listSettings } = await (supabase as any)
      .from("checkin_lists")
      .select("allow_multiple_checkins, name")
      .eq("id", verified_checkin_list_id)
      .single()

    // Check for existing check-in record
    const { data: existingRecord } = await (supabase as any)
      .from("checkin_records")
      .select("id, checked_in_at")
      .eq("checkin_list_id", verified_checkin_list_id)
      .eq("registration_id", registration.id)
      .is("checked_out_at", null)
      .maybeSingle()

    if (existingRecord && listSettings?.allow_multiple_checkins !== true) {
      const checkedInTime = new Date(existingRecord.checked_in_at).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit"
      })

      await logAudit(supabase, {
        event_id: registration.event_id,
        checkin_list_id: verified_checkin_list_id,
        registration_id: registration.id,
        action,
        performed_by,
        performed_via: "qr_scan",
        device_info,
        token_used: token,
        success: false,
        error_message: "Already checked in"
      })

      return NextResponse.json({
        success: false,
        error: `Already checked in at ${checkedInTime}`,
        alreadyCheckedIn: true,
        registration: {
          id: registration.id,
          registration_number: registration.registration_number,
          attendee_name: registration.attendee_name,
          ticket_type: registration.ticket_types,
        }
      }, { status: 400 })
    }
  }

  // Update registration's general checked_in status
  const { error: updateError } = await (supabase as any)
    .from("registrations")
    .update({
      checked_in: isCheckIn,
      checked_in_at: isCheckIn ? new Date().toISOString() : null,
    })
    .eq("id", registration.id)

  if (updateError) {
    return NextResponse.json(
      { success: false, error: "Failed to update check-in status" },
      { status: 500 }
    )
  }

  // Create check-in record
  if (isCheckIn) {
    // Race condition guard: re-check for existing record right before insert
    // to prevent duplicates from concurrent scans
    const { data: existingBeforeInsert } = await (supabase as any)
      .from("checkin_records")
      .select("id, checked_in_at")
      .eq("checkin_list_id", verified_checkin_list_id)
      .eq("registration_id", registration.id)
      .is("checked_out_at", null)
      .maybeSingle()

    if (!existingBeforeInsert) {
      const { error: insertErr } = await (supabase as any).from("checkin_records").insert({
        checkin_list_id: verified_checkin_list_id,
        registration_id: registration.id,
        checked_in_at: new Date().toISOString(),
        checked_in_by: performed_by,
      })
      // 23505 = unique_violation: a concurrent scan won the race against the
      // UNIQUE(checkin_list_id, registration_id) constraint. That's a successful
      // idempotent check-in, so fall through. Any OTHER error was being silently
      // swallowed (the scan appeared to succeed while nothing was recorded) —
      // surface it instead.
      if (insertErr && insertErr.code !== "23505") {
        console.error("[verify] check-in insert failed:", insertErr)
        await logAudit(supabase, {
          event_id: registration.event_id,
          checkin_list_id: verified_checkin_list_id,
          registration_id: registration.id,
          action,
          performed_by,
          performed_via: "qr_scan",
          device_info,
          token_used: token,
          success: false,
          error_message: "Failed to record check-in",
        })
        return NextResponse.json(
          { success: false, error: "Failed to record check-in. Please try again." },
          { status: 500 }
        )
      }
    }
  } else {
    // Check-out: update the record with checkout time
    await (supabase as any)
      .from("checkin_records")
      .update({ checked_out_at: new Date().toISOString() })
      .eq("checkin_list_id", verified_checkin_list_id)
      .eq("registration_id", registration.id)
      .is("checked_out_at", null)
  }

  // Log successful action
  await logAudit(supabase, {
    event_id: registration.event_id,
    checkin_list_id: verified_checkin_list_id,
    registration_id: registration.id,
    action,
    performed_by,
    performed_via: "qr_scan",
    device_info,
    token_used: token,
    success: true,
  })

  return NextResponse.json({
    success: true,
    action,
    registration: {
      id: registration.id,
      registration_number: registration.registration_number,
      attendee_name: registration.attendee_name,
      checked_in: isCheckIn,
      ticket_type: registration.ticket_types,
    }
  })
}

// Helper function to log audit entries
async function logAudit(supabase: any, data: {
  event_id?: string,
  checkin_list_id?: string,
  registration_id?: string,
  action: string,
  performed_by?: string,
  performed_via?: string,
  device_info?: any,
  token_used?: string,
  success: boolean,
  error_message?: string,
}) {
  try {
    await supabase.from("checkin_audit_log").insert(data)
  } catch (e) {
    console.error("Failed to log audit:", e)
  }
}
