import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).trim()
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")

    if (!code) {
      return NextResponse.json(
        { success: false, error: "Missing code parameter" },
        { status: 400 }
      )
    }

    // Try to find registration by QR code, registration ID, or registration number
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
      .single()

    if (error || !registration) {
      // Try partial match on registration number
      const { data: partialMatch } = await supabase
        .from("registrations")
        .select(`
          *,
          events (
            id,
            name,
            slug
          )
        `)
        .ilike("registration_number", `%${code}%`)
        .limit(1)
        .single()

      if (partialMatch) {
        return NextResponse.json({
          success: true,
          registration: formatRegistration(partialMatch)
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
    email: reg.attendee_email || reg.email,
    phone: reg.attendee_phone || reg.phone,
    organization: reg.attendee_institution || reg.organization || reg.company || reg.institution,
    ticketType: reg.ticket_type || reg.registration_type || "Attendee",
    registrationNumber: reg.registration_number,
    checkedIn: reg.checked_in,
    badgePrinted: reg.badge_printed,
    eventName: reg.events?.name,
    eventId: reg.events?.id || reg.event_id
  }
}
