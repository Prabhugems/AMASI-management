import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createTechnosurgAdminClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

type Tenant = "amasi" | "technosurg"

const REGISTRATION_SELECT = `
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
  convocation_number,
  convocation_address,
  exam_result,
  exam_marks,
  checkin_token,
  custom_fields,
  ticket_type_id,
  event_id,
  created_at,
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
    banner_url,
    settings
  ),
  payments (
    id,
    payment_number,
    amount,
    status,
    razorpay_payment_id,
    completed_at
  )
`

async function fetchTenantData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tenant: Tenant,
  query: string,
  isEmail: boolean,
  isPhone: boolean,
  cleanedPhone: string,
) {
  let registrationQuery = supabase.from("registrations").select(REGISTRATION_SELECT)

  if (isEmail) {
    registrationQuery = registrationQuery.ilike("attendee_email", query)
  } else if (isPhone) {
    const searchPhone = cleanedPhone.slice(-10)
    registrationQuery = registrationQuery.ilike("attendee_phone", `%${searchPhone}`)
  } else if (/^REG[-_]/i.test(query)) {
    registrationQuery = registrationQuery.ilike("registration_number", query)
  } else {
    registrationQuery = registrationQuery.ilike("attendee_name", `%${query}%`)
  }

  registrationQuery = registrationQuery.order("created_at", { ascending: false })

  const { data: registrations, error } = await registrationQuery
  if (error || !registrations || registrations.length === 0) {
    return { registrations: [], pendingPayments: [] as any[] }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const registrationIds = registrations.map((r: any) => r.id)

  const { data: activeCheckins } = await supabase
    .from("checkin_records")
    .select("registration_id, checked_in_at")
    .in("registration_id", registrationIds)
    .is("checked_out_at", null)

  const checkinMap: Record<string, string> = {}
  if (activeCheckins) {
    for (const rec of activeCheckins) {
      if (!checkinMap[rec.registration_id] || rec.checked_in_at < checkinMap[rec.registration_id]) {
        checkinMap[rec.registration_id] = rec.checked_in_at
      }
    }
  }

  const { data: allAddons } = await supabase
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatted = registrations.map((registration: any) => ({
    id: `${tenant}:${registration.id}`,
    _tenant: tenant,
    _source_id: registration.id,
    registration_number: registration.registration_number,
    attendee_name: registration.attendee_name,
    attendee_email: registration.attendee_email,
    attendee_phone: registration.attendee_phone,
    attendee_designation: registration.attendee_designation,
    attendee_institution: registration.attendee_institution,
    status: registration.status,
    payment_status: registration.payment_status,
    total_amount: registration.total_amount,
    checked_in: !!checkinMap[registration.id] || registration.checked_in,
    checked_in_at: checkinMap[registration.id] || registration.checked_in_at,
    badge_generated_at: registration.badge_generated_at,
    badge_url: registration.badge_url,
    certificate_generated_at: registration.certificate_generated_at,
    certificate_url: registration.certificate_url,
    convocation_number: registration.convocation_number || null,
    convocation_address: registration.convocation_address || null,
    exam_result: registration.exam_result || null,
    exam_marks: registration.exam_marks || null,
    checkin_token: registration.checkin_token || null,
    custom_fields: registration.custom_fields || {},
    ticket_type: registration.ticket_types,
    event: registration.events,
    payment: registration.payments?.[0] || null,
    addons: addonsByRegistration[registration.id] || [],
    created_at: registration.created_at,
  }))

  let pendingPayments: any[] = []
  if (isEmail) {
    const { data: payments } = await supabase
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

    pendingPayments = (payments || []).map((p: any) => ({ ...p, _tenant: tenant }))
  }

  return { registrations: formatted, pendingPayments }
}

// GET /api/my?q=email_or_phone_or_regnum_or_name
// Searches AMASI + TechnoSurg (when configured) in parallel and merges results.
export async function GET(request: NextRequest) {
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
        { error: "Please enter your name, email, phone, or registration number" },
        { status: 400 }
      )
    }

    const isEmail = query.includes("@")
    const cleanedPhone = query.replace(/[\s\-\+\(\)]/g, "")
    const isPhone = /^\d{10,15}$/.test(cleanedPhone) && !isEmail

    const amasi = await createAdminClient()
    const technosurg = createTechnosurgAdminClient()

    const tasks: Promise<{ registrations: any[]; pendingPayments: any[]; tenant: Tenant; ok: boolean }>[] = [
      fetchTenantData(amasi, "amasi", query, isEmail, isPhone, cleanedPhone)
        .then((r) => ({ ...r, tenant: "amasi" as const, ok: true }))
        .catch((e) => {
          console.error("AMASI lookup failed:", e)
          return { registrations: [], pendingPayments: [], tenant: "amasi" as const, ok: false }
        }),
    ]

    if (technosurg) {
      tasks.push(
        fetchTenantData(technosurg, "technosurg", query, isEmail, isPhone, cleanedPhone)
          .then((r) => ({ ...r, tenant: "technosurg" as const, ok: true }))
          .catch((e) => {
            console.error("TechnoSurg lookup failed:", e)
            return { registrations: [], pendingPayments: [], tenant: "technosurg" as const, ok: false }
          })
      )
    }

    const results = await Promise.all(tasks)
    const mergedRegistrations = results.flatMap((r) => r.registrations)
    const mergedPendingPayments = results.flatMap((r) => r.pendingPayments)

    if (mergedRegistrations.length === 0) {
      return NextResponse.json(
        { error: "Registration not found. Please check your name, email, phone, or registration number." },
        { status: 404 }
      )
    }

    // Most recent first across both tenants
    mergedRegistrations.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))

    return NextResponse.json({
      registrations: mergedRegistrations,
      pending_payments: mergedPendingPayments,
    })
  } catch (error: any) {
    console.error("Delegate lookup error:", error)
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
