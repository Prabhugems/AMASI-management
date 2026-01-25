import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// GET /api/my?q=email_or_phone_or_regnum - Look up delegate by email, phone, or registration number
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")?.trim()

    if (!query || query.length < 3) {
      return NextResponse.json(
        { error: "Please enter your email, phone, or registration number" },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    // Determine search type
    const isEmail = query.includes("@")
    const isPhone = /^\d{10}$/.test(query.replace(/[\s\-\+]/g, "").slice(-10))

    let registrationQuery = (supabase as any)
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
        payment_status,
        total_amount,
        checked_in,
        checked_in_at,
        badge_generated_at,
        badge_url,
        certificate_generated_at,
        certificate_url,
        ticket_type_id,
        event_id,
        ticket_types (
          id,
          name,
          price
        ),
        events (
          id,
          name,
          short_name,
          start_date,
          end_date,
          venue_name,
          city,
          logo_url,
          banner_url
        ),
        payments (
          id,
          amount,
          status,
          completed_at
        )
      `)

    // Search by email, phone, or registration number
    if (isEmail) {
      registrationQuery = registrationQuery.ilike("attendee_email", query)
    } else if (isPhone) {
      // Clean phone number and search
      const cleanPhone = query.replace(/[\s\-\+]/g, "").slice(-10)
      registrationQuery = registrationQuery.ilike("attendee_phone", `%${cleanPhone}`)
    } else {
      // Search by registration number
      registrationQuery = registrationQuery.ilike("registration_number", query)
    }

    // Order by event date (most recent first)
    registrationQuery = registrationQuery.order("created_at", { ascending: false })

    const { data: registrations, error } = await registrationQuery

    if (error || !registrations || registrations.length === 0) {
      return NextResponse.json(
        { error: "Registration not found. Please check your email, phone, or registration number." },
        { status: 404 }
      )
    }

    // Fetch addons for all registrations
    const registrationIds = registrations.map((r: any) => r.id)
    const { data: allAddons } = await (supabase as any)
      .from("registration_addons")
      .select(`
        id,
        registration_id,
        quantity,
        price,
        addon:addons(id, name, is_course, price)
      `)
      .in("registration_id", registrationIds)

    // Group addons by registration_id
    const addonsByRegistration: Record<string, any[]> = {}
    if (allAddons) {
      for (const addon of allAddons) {
        if (!addonsByRegistration[addon.registration_id]) {
          addonsByRegistration[addon.registration_id] = []
        }
        // Map price to unit_price/total_price for UI compatibility
        const qty = addon.quantity || 1
        const totalPrice = addon.price || 0
        addonsByRegistration[addon.registration_id].push({
          ...addon,
          unit_price: qty > 0 ? totalPrice / qty : (addon.addon?.price || 0),
          total_price: totalPrice,
        })
      }
    }

    // Format response - return all registrations
    const formattedRegistrations = registrations.map((registration: any) => ({
      id: registration.id,
      registration_number: registration.registration_number,
      attendee_name: registration.attendee_name,
      attendee_email: registration.attendee_email,
      attendee_phone: registration.attendee_phone,
      attendee_designation: registration.attendee_designation,
      attendee_institution: registration.attendee_institution,
      status: registration.status,
      payment_status: registration.payment_status,
      total_amount: registration.total_amount,
      checked_in: registration.checked_in,
      checked_in_at: registration.checked_in_at,
      badge_generated_at: registration.badge_generated_at,
      badge_url: registration.badge_url,
      certificate_generated_at: registration.certificate_generated_at,
      certificate_url: registration.certificate_url,
      ticket_type: registration.ticket_types,
      event: registration.events,
      payment: registration.payments?.[0] || null,
      addons: addonsByRegistration[registration.id] || [],
    }))

    // Also check for pending payments by email (payments without completed registration)
    let pendingPayments: any[] = []
    if (isEmail) {
      const { data: payments } = await (supabase as any)
        .from("payments")
        .select(`
          id,
          payer_name,
          amount,
          status,
          payment_method,
          created_at,
          event_id,
          events (name, short_name)
        `)
        .ilike("payer_email", query)
        .eq("status", "pending")
        .order("created_at", { ascending: false })

      pendingPayments = payments || []
    }

    return NextResponse.json({
      registrations: formattedRegistrations,
      pending_payments: pendingPayments,
    })
  } catch (error: any) {
    console.error("Delegate lookup error:", error)
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
