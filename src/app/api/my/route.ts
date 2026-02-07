import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

// GET /api/my?q=email_or_phone_or_regnum - Look up delegate by email, phone, or registration number
export async function GET(request: NextRequest) {
  // Rate limit to prevent enumeration attacks
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "strict")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

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
    // Support international formats: +91XXXXXXXXXX, 91XXXXXXXXXX, or just 10 digits
    const cleanedPhone = query.replace(/[\s\-\+\(\)]/g, "")
    const isPhone = /^\d{10,15}$/.test(cleanedPhone) && !isEmail

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
      // Use last 10 digits for search (handles +91, 91 prefixes)
      const searchPhone = cleanedPhone.slice(-10)
      registrationQuery = registrationQuery.ilike("attendee_phone", `%${searchPhone}`)
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
        unit_price,
        total_price,
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
        const qty = addon.quantity || 1
        const addonPrice = addon.addon?.price || 0
        addonsByRegistration[addon.registration_id].push({
          ...addon,
          unit_price: addon.unit_price || addonPrice,
          total_price: addon.total_price || (addonPrice * qty),
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
          payment_number,
          payer_name,
          payer_email,
          amount,
          net_amount,
          status,
          payment_method,
          razorpay_order_id,
          razorpay_payment_id,
          created_at,
          event_id,
          metadata,
          events (name, short_name)
        `)
        .ilike("payer_email", query)
        .in("status", ["pending", "failed"])
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
