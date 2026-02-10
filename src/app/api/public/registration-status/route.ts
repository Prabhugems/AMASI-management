import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).trim()
)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get("q")?.trim()

    if (!query) {
      return NextResponse.json({ error: "Please provide email or registration number" }, { status: 400 })
    }

    // Search by email or registration number
    const isEmail = query.includes("@")

    let registration = null

    if (isEmail) {
      // Search by email
      const { data, error } = await supabase
        .from("registrations")
        .select("*")
        .ilike("attendee_email", query)
        .order("created_at", { ascending: false })
        .limit(1)

      if (data && data.length > 0) {
        registration = data[0]
      }
    } else {
      // Search by registration number - try exact match first
      const { data, error } = await supabase
        .from("registrations")
        .select("*")
        .eq("registration_number", query)
        .limit(1)

      if (data && data.length > 0) {
        registration = data[0]
      } else {
        // Try partial match
        const { data: partialData } = await supabase
          .from("registrations")
          .select("*")
          .ilike("registration_number", `%${query}%`)
          .limit(1)

        if (partialData && partialData.length > 0) {
          registration = partialData[0]
        }
      }
    }

    if (!registration) {
      return NextResponse.json({ error: "Registration not found. Please check your email or registration number." }, { status: 404 })
    }

    // Fetch ticket type details
    let ticket_type = null
    if (registration.ticket_type_id) {
      const { data: ticketData } = await supabase
        .from("ticket_types")
        .select("id, name, price")
        .eq("id", registration.ticket_type_id)
        .maybeSingle()

      ticket_type = ticketData
    }

    // Fetch event details
    let event = null
    if (registration.event_id) {
      const { data: eventData } = await supabase
        .from("events")
        .select("id, name, start_date, end_date, venue_name, city")
        .eq("id", registration.event_id)
        .maybeSingle()

      event = eventData
    }

    // Fetch payment details if exists
    let payment = null
    if (registration.payment_id) {
      const { data: paymentData } = await supabase
        .from("payments")
        .select("id, payment_number, status, net_amount, razorpay_order_id")
        .eq("id", registration.payment_id)
        .maybeSingle()

      payment = paymentData
    }

    return NextResponse.json({
      registration: {
        id: registration.id,
        registration_number: registration.registration_number,
        attendee_name: registration.attendee_name,
        attendee_email: registration.attendee_email,
        attendee_phone: registration.attendee_phone,
        attendee_designation: registration.attendee_designation,
        attendee_institution: registration.attendee_institution,
        status: registration.status,
        total_amount: registration.total_amount,
        checked_in: registration.checked_in,
        badge_url: registration.badge_url,
        certificate_url: registration.certificate_url,
        ticket_type,
        event,
        payment,
      },
    })
  } catch (error: any) {
    console.error("Registration status lookup error:", error)
    return NextResponse.json({ error: "Failed to lookup registration" }, { status: 500 })
  }
}
