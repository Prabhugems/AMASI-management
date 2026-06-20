import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createAdminClient()
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")

    if (!code) {
      return NextResponse.json(
        { success: false, error: "Missing code parameter" },
        { status: 400 }
      )
    }

    // Require minimum code length to prevent broad enumeration
    if (code.length < 4) {
      return NextResponse.json(
        { success: false, error: "Code must be at least 4 characters" },
        { status: 400 }
      )
    }

    // Sanitize code to prevent injection via .or() / .ilike() filter
    const sanitizedCode = code.replace(/[^a-zA-Z0-9\-_]/g, "")

    // Short codes (4-6 chars) — suffix match on registration_number so AMASI
    // print station can scan just the trailing sequence (e.g. "1043" → "127A1043").
    // Optional event_id scopes the suffix search to one event for uniqueness.
    // Longer codes — exact match on qr_code / id / registration_number.
    const eventId = searchParams.get("event_id")
    const isShort = sanitizedCode.length <= 6

    const select = `
      *,
      events (id, name, slug),
      ticket_types (id, name)
    `

    // UUIDs only on the id column — Postgres errors if we feed it a non-UUID
    const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sanitizedCode)

    let query
    if (isShort) {
      query = supabase
        .from("registrations")
        .select(select)
        .ilike("registration_number", `%${sanitizedCode}`)
      if (eventId) query = query.eq("event_id", eventId)
    } else if (looksLikeUuid) {
      // qr_code column doesn't exist on registrations — match against id and
      // registration_number only.
      query = supabase
        .from("registrations")
        .select(select)
        .or(`id.eq.${sanitizedCode},registration_number.eq.${sanitizedCode}`)
    } else {
      query = supabase
        .from("registrations")
        .select(select)
        .eq("registration_number", sanitizedCode)
    }

    const { data: matches, error } = await query.limit(5)

    if (error) {
      console.error("Print lookup query error:", error)
      return NextResponse.json(
        { success: false, error: "Server error" },
        { status: 500 }
      )
    }

    if (!matches || matches.length === 0) {
      return NextResponse.json(
        { success: false, error: "Registration not found" },
        { status: 404 }
      )
    }

    if (matches.length > 1) {
      return NextResponse.json({
        success: false,
        multiple_results: true,
        error: `Multiple registrations match "${code}". Enter more digits.`,
        results: matches.map(formatRegistration),
      }, { status: 409 })
    }

    return NextResponse.json({
      success: true,
      registration: formatRegistration(matches[0]),
    })
  } catch (error) {
    console.error("Print lookup error:", error)
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 }
    )
  }
}

function formatRegistration(reg: any) {
  return {
    id: reg.id,
    name: reg.attendee_name || reg.name || `${reg.first_name || ""} ${reg.last_name || ""}`.trim(),
    // Only return masked email/phone to reduce PII exposure
    email: maskEmail(reg.attendee_email || reg.email),
    phone: maskPhone(reg.attendee_phone || reg.phone),
    organization: reg.attendee_institution || reg.organization || reg.company || reg.institution,
    ticketType: reg.ticket_types?.name || reg.ticket_type || reg.registration_type || "Attendee",
    registrationNumber: reg.registration_number,
    status: reg.status,
    paymentStatus: reg.payment_status,
    checkedIn: reg.checked_in,
    badgePrinted: reg.badge_printed,
    eventName: reg.events?.name,
    eventId: reg.events?.id || reg.event_id
  }
}

function maskEmail(email: string | null | undefined): string {
  if (!email) return ""
  const [local, domain] = email.split("@")
  if (!domain) return email
  const maskedLocal = local.length <= 2 ? local : local[0] + "***" + local[local.length - 1]
  return `${maskedLocal}@${domain}`
}

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return ""
  if (phone.length <= 4) return phone
  return phone.slice(0, 2) + "****" + phone.slice(-2)
}
