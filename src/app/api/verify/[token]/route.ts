import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// GET /api/verify/[token] - Verify a registration token and return attendee info
// This is what gets called when a QR code is scanned
// Accepts either a checkin_token (long secure token) or registration_number (like 121A001)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token || token.length < 3) {
    return NextResponse.json(
      { valid: false, error: "Invalid token format" },
      { status: 400 }
    )
  }

  const supabase = await createAdminClient()

  // Determine if this is a checkin_token (long) or registration_number (short)
  const isSecureToken = token.length >= 20

  // Look up registration by checkin_token or registration_number
  let query = (supabase as any)
    .from("registrations")
    .select(`
      id,
      registration_number,
      attendee_name,
      attendee_email,
      attendee_phone,
      attendee_designation,
      attendee_institution,
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

  if (isSecureToken) {
    query = query.eq("checkin_token", token)
  } else {
    // Look up by registration number (case insensitive)
    query = query.ilike("registration_number", token)
  }

  const { data: registration, error } = await query.single()

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

  // Check if certificate templates exist for this event
  let certificateTemplate: { id: string; name: string } | null = null
  try {
    const { data: certTemplate } = await (supabase as any)
      .from("certificate_templates")
      .select("id, name")
      .eq("event_id", registration.event_id)
      .neq("is_active", false)
      .limit(1)
      .single()
    if (certTemplate) {
      certificateTemplate = certTemplate
    }
  } catch {
    // No certificate template found - that's fine
  }

  // Return attendee info (without sensitive data like token)
  return NextResponse.json({
    valid: true,
    registration: {
      id: registration.id,
      registration_number: registration.registration_number,
      attendee_name: registration.attendee_name,
      attendee_email: registration.attendee_email,
      attendee_phone: registration.attendee_phone,
      attendee_designation: registration.attendee_designation,
      attendee_institution: registration.attendee_institution,
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

  const body = await request.json()
  const {
    checkin_list_id,
    access_token,  // Staff access token for authorization
    action = "check_in",
    performed_by,
    device_info
  } = body

  const supabase = await createAdminClient()

  // Verify staff access token if provided
  if (access_token) {
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
  }

  // Determine if this is a checkin_token (long) or registration_number (short)
  const isSecureToken = token.length >= 20

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
    // Look up by registration number (case insensitive)
    query2 = query2.ilike("registration_number", token)
  }

  const { data: registration, error: regError } = await query2.single()

  if (regError || !registration) {
    // Log failed attempt
    await logAudit(supabase, {
      checkin_list_id,
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
      checkin_list_id,
      registration_id: registration.id,
      action,
      performed_by,
      performed_via: "qr_scan",
      device_info,
      token_used: token,
      success: false,
      error_message: `Registration is ${registration.status}`
    })

    return NextResponse.json({
      success: false,
      error: `Registration is ${registration.status}. Cannot check in.`,
      registration_number: registration.registration_number,
    }, { status: 400 })
  }

  // Perform check-in or check-out
  const isCheckIn = action === "check_in"

  // Check if already checked in for this specific list (prevent duplicate food/meals)
  if (isCheckIn && checkin_list_id) {
    // Get checkin list settings
    const { data: listSettings } = await (supabase as any)
      .from("checkin_lists")
      .select("allow_multiple_checkins, name")
      .eq("id", checkin_list_id)
      .single()

    // Check for existing check-in record
    const { data: existingRecord } = await (supabase as any)
      .from("checkin_records")
      .select("id, checked_in_at")
      .eq("checkin_list_id", checkin_list_id)
      .eq("registration_id", registration.id)
      .is("checked_out_at", null)
      .single()

    if (existingRecord && !listSettings?.allow_multiple_checkins) {
      const checkedInTime = new Date(existingRecord.checked_in_at).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit"
      })

      await logAudit(supabase, {
        event_id: registration.event_id,
        checkin_list_id,
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

  // Create check-in record if checkin_list_id provided
  if (checkin_list_id) {
    if (isCheckIn) {
      await (supabase as any).from("checkin_records").insert({
        checkin_list_id,
        registration_id: registration.id,
        checked_in_at: new Date().toISOString(),
        checked_in_by: performed_by,
      })
    } else {
      // Check-out: update the record with checkout time
      await (supabase as any)
        .from("checkin_records")
        .update({ checked_out_at: new Date().toISOString() })
        .eq("checkin_list_id", checkin_list_id)
        .eq("registration_id", registration.id)
        .is("checked_out_at", null)
    }
  }

  // Log successful action
  await logAudit(supabase, {
    event_id: registration.event_id,
    checkin_list_id,
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
