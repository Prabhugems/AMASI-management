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

    // Try to find registration by QR code, registration ID, or registration number (exact match only)
    const { data: registration, error } = await supabase
      .from("registrations")
      .select(`
        *,
        events (
          id,
          name,
          slug
        )
      `)
      .or(`qr_code.eq.${code},id.eq.${code},registration_number.eq.${code}`)
      .maybeSingle()

    if (error || !registration) {
      // Try exact match on registration number (no partial/wildcard matching)
      const { data: exactMatch } = await supabase
        .from("registrations")
        .select(`
          *,
          events (
            id,
            name,
            slug
          )
        `)
        .eq("registration_number", code)
        .maybeSingle()

      if (exactMatch) {
        return NextResponse.json({
          success: true,
          registration: formatRegistration(exactMatch)
        })
      }

      return NextResponse.json(
        { success: false, error: "Registration not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      registration: formatRegistration(registration)
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
    ticketType: reg.ticket_type || reg.registration_type || "Attendee",
    registrationNumber: reg.registration_number,
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
