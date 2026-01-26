import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Use service role for public API (no auth required)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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

    let registrationQuery = supabase
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
        total_amount,
        checked_in,
        badge_url,
        certificate_url,
        payment_id,
        ticket_type:ticket_types(id, name, price),
        event:events(id, name, start_date, end_date, venue, city)
      `)

    if (isEmail) {
      registrationQuery = registrationQuery.ilike("attendee_email", query)
    } else {
      registrationQuery = registrationQuery.ilike("registration_number", `%${query}%`)
    }

    const { data: registrations, error } = await registrationQuery.limit(1).single()

    if (error || !registrations) {
      return NextResponse.json({ error: "Registration not found. Please check your email or registration number." }, { status: 404 })
    }

    // Fetch payment details if exists
    let payment = null
    if (registrations.payment_id) {
      const { data: paymentData } = await supabase
        .from("payments")
        .select("id, payment_number, status, net_amount, razorpay_order_id")
        .eq("id", registrations.payment_id)
        .single()

      payment = paymentData
    }

    return NextResponse.json({
      registration: {
        ...registrations,
        payment,
      },
    })
  } catch (error: any) {
    console.error("Registration status lookup error:", error)
    return NextResponse.json({ error: "Failed to lookup registration" }, { status: 500 })
  }
}
