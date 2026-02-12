import { createServerSupabaseClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { onRegistration } from "@/lib/services/auto-send"
import { validatePagination, sanitizeSearchInput, isValidUUID } from "@/lib/validation"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"
import { DEFAULTS } from "@/lib/config"

type EventSettings = {
  customize_registration_id: boolean
  registration_prefix: string | null
  registration_start_number: number | null
  registration_suffix: string | null
  current_registration_number: number | null
}

// Generate custom registration number based on event settings
async function generateRegistrationNumber(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, eventId: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  // Try to get event settings - use maybeSingle since settings might not exist yet
  const { data: settingsData } = await db
    .from("event_settings")
    .select("customize_registration_id, registration_prefix, registration_start_number, registration_suffix, current_registration_number")
    .eq("event_id", eventId)
    .maybeSingle()

  const settings = settingsData as EventSettings | null

  if (settings?.customize_registration_id) {
    // Use custom format
    const prefix = settings.registration_prefix || ""
    const suffix = settings.registration_suffix || ""
    const startNumber = settings.registration_start_number || 1
    const currentNumber = (settings.current_registration_number || 0) + 1
    const regNumber = Math.max(startNumber, currentNumber)

    // Update the current registration number
    await db
      .from("event_settings")
      .update({ current_registration_number: regNumber })
      .eq("event_id", eventId)

    // Format: PREFIX + NUMBER + SUFFIX
    return `${prefix}${regNumber}${suffix}`
  }

  // Default format: REG-YYYYMMDD-XXXX
  const date = new Date()
  const dateStr = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, "0") +
    date.getDate().toString().padStart(2, "0")
  const random = Math.floor(1000 + Math.random() * 9000)
  return `REG-${dateStr}-${random}`
}

// GET - List registrations (with optional filters)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Authentication check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    const eventId = searchParams.get("event_id")
    const status = searchParams.get("status")
    const search = searchParams.get("search")

    // Validate event_id if provided
    if (eventId && !isValidUUID(eventId)) {
      return NextResponse.json({ error: "Invalid event_id format" }, { status: 400 })
    }

    // Authorization check - verify user has access to this event
    if (eventId) {
      const { data: event } = await (supabase as any)
        .from("events")
        .select("id, created_by")
        .eq("id", eventId)
        .single()

      if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 })
      }

      // Check if user is the creator or a team member
      const isCreator = event.created_by === user.id

      if (!isCreator) {
        // Check if user is a team member with access
        const { data: teamMember } = await (supabase as any)
          .from("team_members")
          .select("id, event_ids, permissions")
          .eq("email", user.email?.toLowerCase())
          .eq("is_active", true)
          .single()

        const hasEventAccess = teamMember && (
          !teamMember.event_ids || // No event restriction = all events
          teamMember.event_ids.length === 0 ||
          teamMember.event_ids.includes(eventId)
        )

        if (!hasEventAccess) {
          return NextResponse.json({ error: "You don't have access to this event" }, { status: 403 })
        }
      }
    }

    // Validate and clamp pagination
    const { limit, offset } = validatePagination(
      searchParams.get("page"),
      searchParams.get("limit") || "100",
      500 // Max limit
    )

    let query = (supabase as any)
      .from("registrations")
      .select(`
        *,
        ticket_type:ticket_types(id, name, price)
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (eventId) {
      query = query.eq("event_id", eventId)
    }

    // Validate status values
    const validStatuses = ["pending", "confirmed", "cancelled", "refunded", "waitlisted"]
    if (status && status !== "all") {
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 })
      }
      query = query.eq("status", status)
    }

    if (search) {
      // Sanitize search input
      const sanitizedSearch = sanitizeSearchInput(search)
      query = query.or(`attendee_name.ilike.%${sanitizedSearch}%,attendee_email.ilike.%${sanitizedSearch}%,registration_number.ilike.%${sanitizedSearch}%`)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: "Failed to fetch registrations" }, { status: 500 })
    }

    return NextResponse.json({
      data,
      count,
      limit,
      offset,
    })
  } catch (_error: any) {
    return NextResponse.json({ error: "Failed to fetch registrations" }, { status: 500 })
  }
}

// Generate payment number
function generatePaymentNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `PAY-${timestamp}-${random}`
}

// POST - Create new registration
export async function POST(request: NextRequest) {
  // Rate limit: public tier for registration creation
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "public")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  try {
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const {
      event_id,
      ticket_type_id,
      attendee_name,
      attendee_email,
      attendee_phone,
      attendee_institution,
      attendee_designation,
      attendee_city,
      attendee_state,
      attendee_country,
      quantity = 1,
      discount_code,
      payment_method = "free", // free, cash, bank_transfer, razorpay
      payment_id, // Existing payment ID (for razorpay)
      custom_fields,
      addons, // Array of selected addons: { addonId, variantId?, quantity, unitPrice, totalPrice }
    } = body

    // Validate required fields
    if (!event_id || !ticket_type_id || !attendee_name || !attendee_email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Check if registration is open for this event
    const { data: eventData } = await (supabase as any)
      .from("events")
      .select("registration_open")
      .eq("id", event_id)
      .single()

    if (eventData?.registration_open === false) {
      return NextResponse.json(
        { error: "Registration is closed for this event" },
        { status: 403 }
      )
    }

    // Get ticket type details
    const { data: ticket, error: ticketError } = await (supabase as any)
      .from("ticket_types")
      .select("*")
      .eq("id", ticket_type_id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: "Ticket type not found" },
        { status: 404 }
      )
    }

    // Check availability
    if (ticket.quantity_total && ticket.quantity_sold + quantity > ticket.quantity_total) {
      return NextResponse.json(
        { error: "Not enough tickets available" },
        { status: 400 }
      )
    }

    // Check ticket status
    if (ticket.status !== "active") {
      return NextResponse.json(
        { error: "Ticket is not available for purchase" },
        { status: 400 }
      )
    }

    // SECURITY: Validate payment method for paid tickets
    if (ticket.price > 0 && payment_method === "free") {
      return NextResponse.json(
        { error: "Invalid payment method for paid ticket" },
        { status: 400 }
      )
    }

    // Calculate pricing
    const unit_price = ticket.price
    let tax_amount = 0
    let discount_amount = 0
    let discount_code_id = null

    // Apply tax
    if (ticket.tax_percentage > 0) {
      tax_amount = (unit_price * quantity * ticket.tax_percentage) / 100
    }

    // Validate and apply discount code
    if (discount_code) {
      const { data: discountData } = await (supabase as any)
        .from("discount_codes")
        .select("*")
        .eq("event_id", event_id)
        .eq("code", discount_code.toUpperCase())
        .eq("is_active", true)
        .single()

      if (discountData) {
        const now = new Date()
        const validFrom = discountData.valid_from ? new Date(discountData.valid_from) : null
        const validUntil = discountData.valid_until ? new Date(discountData.valid_until) : null

        const isValidPeriod = (!validFrom || now >= validFrom) && (!validUntil || now <= validUntil)
        const hasUsesLeft = !discountData.max_uses || discountData.current_uses < discountData.max_uses

        if (isValidPeriod && hasUsesLeft) {
          discount_code_id = discountData.id

          if (discountData.discount_type === "percentage") {
            discount_amount = (unit_price * quantity * discountData.discount_value) / 100
          } else {
            discount_amount = discountData.discount_value
          }

          // Cap discount if max is set
          if (discountData.max_discount_amount && discount_amount > discountData.max_discount_amount) {
            discount_amount = discountData.max_discount_amount
          }
        }
      }
    }

    const total_amount = (unit_price * quantity) + tax_amount - discount_amount

    // Determine initial status based on payment method and price
    let initialStatus = "pending"
    let paymentStatus = "pending"
    let paymentRecordStatus = "pending"

    if (ticket.price === 0 || payment_method === "free") {
      initialStatus = ticket.requires_approval ? "pending" : "confirmed"
      paymentStatus = "completed"
      paymentRecordStatus = "completed"
    } else if (payment_method === "cash") {
      initialStatus = "pending"
      paymentStatus = "pending"
      paymentRecordStatus = "pending"
    } else if (payment_method === "bank_transfer") {
      initialStatus = "pending"
      paymentStatus = "pending"
      paymentRecordStatus = "pending"
    }

    // For Razorpay, payment is already created - use existing payment_id
    // For other methods, create a new payment record
    let payment: any = null
    let finalPaymentId = payment_id || null

    // Variable to hold addons - might come from request or payment metadata
    let addonsToSave = addons

    if (payment_id) {
      // Razorpay: Use existing payment
      const { data: existingPayment } = await (supabase as any)
        .from("payments")
        .select("*")
        .eq("id", payment_id)
        .single()
      payment = existingPayment
      finalPaymentId = payment_id

      // If addons not provided in request, try to get from payment metadata
      if ((!addonsToSave || addonsToSave.length === 0) && existingPayment?.metadata?.addons_selection) {
        addonsToSave = existingPayment.metadata.addons_selection
        console.log("Retrieved addons from payment metadata:", addonsToSave)
      }
    } else {
      // Create new payment record for free/cash/bank_transfer
      const paymentNumber = generatePaymentNumber()
      const { data: newPayment, error: paymentError } = await (supabase as any)
        .from("payments")
        .insert({
          payment_number: paymentNumber,
          payment_type: "registration",
          payment_method: payment_method,
          payer_name: attendee_name,
          payer_email: attendee_email,
          payer_phone: attendee_phone,
          amount: total_amount,
          currency: "INR",
          tax_amount: tax_amount,
          discount_amount: discount_amount,
          net_amount: total_amount,
          status: paymentRecordStatus,
          event_id: event_id,
          completed_at: paymentRecordStatus === "completed" ? new Date().toISOString() : null,
          metadata: {
            ticket_type_id,
            ticket_name: ticket.name,
            quantity,
            unit_price,
            discount_code: discount_code || null,
            custom_fields,
          },
        })
        .select()
        .single()

      if (paymentError) {
        console.error("Failed to create payment:", paymentError)
        // Continue anyway - we'll create registration without payment link
      } else {
        payment = newPayment
        finalPaymentId = newPayment?.id
      }
    }

    // Generate custom registration number
    const registrationNumber = await generateRegistrationNumber(supabase, event_id)

    // Create registration linked to payment
    const { data: registration, error: regError } = await (supabase as any)
      .from("registrations")
      .insert({
        event_id,
        ticket_type_id,
        registration_number: registrationNumber,
        attendee_name,
        attendee_email,
        attendee_phone,
        attendee_institution,
        attendee_designation,
        attendee_city,
        attendee_state,
        attendee_country: attendee_country || DEFAULTS.country,
        quantity,
        unit_price,
        tax_amount,
        discount_amount,
        total_amount,
        discount_code_id,
        status: initialStatus,
        payment_status: paymentStatus,
        payment_id: finalPaymentId,
        confirmed_at: initialStatus === "confirmed" ? new Date().toISOString() : null,
        custom_fields,
      })
      .select()
      .single()

    if (regError) {
      // If registration fails but payment was created, try to delete payment
      if (payment?.id) {
        await (supabase as any).from("payments").delete().eq("id", payment.id)
      }
      return NextResponse.json({ error: "Failed to create registration" }, { status: 500 })
    }

    // NOTE: Ticket quantity_sold is updated when payment is verified (not here)
    // This prevents counting unconfirmed/failed payments against inventory
    // See: /api/payments/razorpay/verify for the actual increment

    // For free tickets or completed payments, update count immediately
    if (initialStatus === "confirmed" && ticket.quantity_total) {
      await (supabase as any)
        .from("ticket_types")
        .update({ quantity_sold: ticket.quantity_sold + quantity })
        .eq("id", ticket_type_id)
    }

    // Save selected addons to registration_addons table
    let _addonsSaveStatus: 'success' | 'failed' | 'none' = 'none'
    if (addonsToSave && Array.isArray(addonsToSave) && addonsToSave.length > 0) {
      const addonRecords = addonsToSave.map((addon: {
        addonId: string
        variantId?: string
        quantity: number
        unitPrice: number
        totalPrice: number
      }) => ({
        registration_id: registration.id,
        addon_id: addon.addonId,
        quantity: addon.quantity,
        price: addon.totalPrice, // Use totalPrice as the price column
      }))

      const { error: addonsError } = await (supabase as any)
        .from("registration_addons")
        .insert(addonRecords)

      if (addonsError) {
        console.error("Failed to save registration addons:", addonsError)
        _addonsSaveStatus = 'failed'
        // Store addon data in custom_fields as backup for recovery
        await (supabase as any)
          .from("registrations")
          .update({
            custom_fields: {
              ...(registration.custom_fields || {}),
              addons_backup: addonsToSave,
              addons_save_error: addonsError.message,
              addons_save_status: 'failed',
            }
          })
          .eq("id", registration.id)
      } else {
        _addonsSaveStatus = 'success'
      }
    }

    // Get event details for confirmation email
    const { data: event } = await (supabase as any)
      .from("events")
      .select("name, start_date, venue_name")
      .eq("id", event_id)
      .single()

    // Send registration confirmation email asynchronously but track failures
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const _emailPromise = fetch(`${baseUrl}/api/email/registration-confirmation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registration_id: registration.id,
        registration_number: registrationNumber,
        attendee_name,
        attendee_email,
        event_name: event?.name || "Event",
        event_date: event?.start_date || "",
        event_venue: event?.venue_name || "",
        ticket_name: ticket.name,
        quantity,
        total_amount,
        payment_method,
        payment_status: paymentStatus,
      }),
    }).then(async (res) => {
      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error')
        console.error(`Email API returned ${res.status}: ${errorText}`)
        // Update registration to mark email as failed
        await (supabase as any)
          .from("registrations")
          .update({
            custom_fields: {
              ...(registration.custom_fields || {}),
              email_status: 'failed',
              email_error: `API returned ${res.status}`
            }
          })
          .eq("id", registration.id)
      }
    }).catch(async (err) => {
      console.error("Failed to send confirmation email:", err)
      // Update registration to mark email as failed
      await (supabase as any)
        .from("registrations")
        .update({
          custom_fields: {
            ...(registration.custom_fields || {}),
            email_status: 'failed',
            email_error: err.message
          }
        })
        .eq("id", registration.id)
    })

    // Don't await - let it run in background, but we've added proper error tracking

    // Trigger auto-send templates for registration
    onRegistration({
      event_id,
      registration_id: registration.id,
      recipient_email: attendee_email,
      recipient_phone: attendee_phone,
      recipient_name: attendee_name,
      registration_number: registrationNumber,
      ticket_type: ticket.name,
      event_name: event?.name || "Event",
      event_date: event?.start_date ? new Date(event.start_date).toLocaleDateString("en-IN", { dateStyle: "long" }) : "",
      venue: event?.venue_name || "",
    }).catch(err => {
      console.error("Auto-send failed:", err)
    })

    return NextResponse.json({
      success: true,
      data: registration,
      payment: payment,
      requires_payment: ticket.price > 0 && payment_method !== "free",
    })
  } catch (_error: any) {
    return NextResponse.json({ error: "Failed to process registration" }, { status: 500 })
  }
}
