import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { createOrder, generatePaymentNumber, RazorpayCredentials } from "@/lib/services/razorpay"
import { DEFAULTS } from "@/lib/config"

// Create admin client for server-side operations (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).trim()
)

interface Attendee {
  ticket_type_id: string
  attendee_name: string
  attendee_email: string
  attendee_phone?: string
  attendee_institution?: string
  attendee_designation?: string
  attendee_city?: string
  attendee_state?: string
  attendee_country?: string
  custom_fields?: Record<string, unknown>
  addons?: Array<{ id: string; quantity: number }>
}

interface GroupRegistrationRequest {
  event_id: string
  buyer: {
    name: string
    email: string
    phone?: string
    institution?: string
    form_data?: Record<string, unknown>
  }
  attendees: Attendee[]
  discount_code?: string
  payment_method: "free" | "razorpay" | "cash" | "bank_transfer"
}

// Generate order number
function generateOrderNumber(): string {
  const year = new Date().getFullYear()
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `ORD-${year}-${timestamp}-${random}`
}

export async function POST(request: NextRequest) {
  try {
    const body: GroupRegistrationRequest = await request.json()
    const { event_id, buyer, attendees, discount_code, payment_method = "free" } = body

    // Validate required fields
    if (!event_id || !buyer?.name || !buyer?.email || !attendees?.length) {
      return NextResponse.json(
        { error: "Missing required fields: event_id, buyer info, and at least one attendee" },
        { status: 400 }
      )
    }

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name, slug, razorpay_key_id, razorpay_key_secret, registration_open")
      .eq("id", event_id)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      )
    }

    // Check if registration is open
    if (event.registration_open === false) {
      return NextResponse.json(
        { error: "Registration is closed for this event" },
        { status: 403 }
      )
    }

    // Fetch all ticket types needed
    const ticketIds = [...new Set(attendees.map(a => a.ticket_type_id))]
    const { data: ticketTypes, error: ticketError } = await supabase
      .from("ticket_types")
      .select("id, name, price, tax_percentage, status, quantity_total, quantity_sold, requires_approval")
      .in("id", ticketIds)

    if (ticketError || !ticketTypes) {
      return NextResponse.json(
        { error: "Failed to fetch ticket types" },
        { status: 400 }
      )
    }

    // Create ticket lookup map
    const ticketMap = new Map(ticketTypes.map(t => [t.id, t]))

    // Validate all tickets exist and are active
    for (const attendee of attendees) {
      const ticket = ticketMap.get(attendee.ticket_type_id)
      if (!ticket) {
        return NextResponse.json(
          { error: `Ticket type not found for attendee: ${attendee.attendee_name}` },
          { status: 400 }
        )
      }
      if (ticket.status !== "active") {
        return NextResponse.json(
          { error: `Ticket "${ticket.name}" is not available` },
          { status: 400 }
        )
      }
    }

    // Check ticket availability
    const ticketQuantities = new Map<string, number>()
    for (const attendee of attendees) {
      const current = ticketQuantities.get(attendee.ticket_type_id) || 0
      ticketQuantities.set(attendee.ticket_type_id, current + 1)
    }

    for (const [ticketId, quantity] of ticketQuantities) {
      const ticket = ticketMap.get(ticketId)!
      if (ticket.quantity_total && ticket.quantity_sold + quantity > ticket.quantity_total) {
        return NextResponse.json(
          { error: `Not enough "${ticket.name}" tickets available` },
          { status: 400 }
        )
      }
    }

    // Calculate pricing
    let subtotal = 0
    let totalTax = 0
    const attendeePricing: Array<{
      attendee: Attendee
      ticket: typeof ticketTypes[0]
      unitPrice: number
      taxAmount: number
      totalAmount: number
    }> = []

    for (const attendee of attendees) {
      const ticket = ticketMap.get(attendee.ticket_type_id)!
      const unitPrice = ticket.price
      const taxAmount = (unitPrice * (ticket.tax_percentage || 0)) / 100
      const totalAmount = unitPrice + taxAmount

      subtotal += unitPrice
      totalTax += taxAmount

      attendeePricing.push({
        attendee,
        ticket,
        unitPrice,
        taxAmount,
        totalAmount,
      })
    }

    // Apply discount if provided
    let discountAmount = 0
    let discountCodeId: string | null = null

    if (discount_code) {
      const { data: discountData } = await supabase
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
          discountCodeId = discountData.id

          if (discountData.discount_type === "percentage") {
            discountAmount = (subtotal * discountData.discount_value) / 100
          } else {
            discountAmount = discountData.discount_value
          }

          if (discountData.max_discount_amount && discountAmount > discountData.max_discount_amount) {
            discountAmount = discountData.max_discount_amount
          }
        }
      }
    }

    const totalAmount = subtotal + totalTax - discountAmount

    // SECURITY: Validate payment method for paid orders
    if (totalAmount > 0 && payment_method === "free") {
      return NextResponse.json(
        { error: "Invalid payment method for paid order" },
        { status: 400 }
      )
    }

    // Determine initial status based on payment
    const isFree = totalAmount === 0
    const requiresApproval = attendeePricing.some(p => p.ticket.requires_approval)

    // 1. Create Buyer record
    const { data: buyerRecord, error: buyerError } = await supabase
      .from("buyers")
      .insert({
        event_id,
        name: buyer.name,
        email: buyer.email,
        phone: buyer.phone,
        form_data: {
          institution: buyer.institution,
          ...buyer.form_data,
        },
        total_amount: totalAmount,
        payment_status: isFree ? "completed" : "pending",
      })
      .select()
      .single()

    if (buyerError) {
      console.error("Failed to create buyer:", buyerError)
      return NextResponse.json(
        { error: "Failed to create buyer record" },
        { status: 500 }
      )
    }

    // 2. Create Order record
    const orderNumber = generateOrderNumber()
    const { data: orderRecord, error: orderError } = await supabase
      .from("orders")
      .insert({
        event_id,
        buyer_id: buyerRecord.id,
        order_number: orderNumber,
        subtotal,
        discount: discountAmount,
        tax: totalTax,
        total: totalAmount,
        currency: "INR",
        payment_status: isFree ? "completed" : "pending",
        payment_method: payment_method,
        coupon_code: discount_code || null,
        discount_code_id: discountCodeId,
      })
      .select()
      .single()

    if (orderError) {
      // Cleanup buyer if order fails
      await supabase.from("buyers").delete().eq("id", buyerRecord.id)
      console.error("Failed to create order:", orderError)
      return NextResponse.json(
        { error: "Failed to create order record" },
        { status: 500 }
      )
    }

    // 3. Create Registrations for each attendee
    const registrations: Array<Record<string, unknown>> = []
    const registrationInserts = attendeePricing.map(({ attendee, ticket, unitPrice, taxAmount, totalAmount: attendeeTotal }) => {
      const initialStatus = isFree
        ? (requiresApproval ? "pending" : "confirmed")
        : "pending"

      return {
        event_id,
        ticket_type_id: attendee.ticket_type_id,
        buyer_id: buyerRecord.id,
        order_id: orderRecord.id,
        attendee_name: attendee.attendee_name,
        attendee_email: attendee.attendee_email,
        attendee_phone: attendee.attendee_phone,
        attendee_institution: attendee.attendee_institution,
        attendee_designation: attendee.attendee_designation,
        attendee_city: attendee.attendee_city,
        attendee_state: attendee.attendee_state,
        attendee_country: attendee.attendee_country || DEFAULTS.country,
        quantity: 1,
        unit_price: unitPrice,
        tax_amount: taxAmount,
        discount_amount: 0, // Discount applied at order level
        total_amount: attendeeTotal,
        status: initialStatus,
        payment_status: isFree ? "completed" : "pending",
        confirmed_at: initialStatus === "confirmed" ? new Date().toISOString() : null,
        custom_fields: attendee.custom_fields,
      }
    })

    const { data: createdRegistrations, error: regError } = await supabase
      .from("registrations")
      .insert(registrationInserts)
      .select()

    if (regError) {
      // Cleanup order and buyer if registrations fail
      await supabase.from("orders").delete().eq("id", orderRecord.id)
      await supabase.from("buyers").delete().eq("id", buyerRecord.id)
      console.error("Failed to create registrations:", regError)
      return NextResponse.json(
        { error: "Failed to create registration records" },
        { status: 500 }
      )
    }

    registrations.push(...(createdRegistrations || []))

    // 4. Update ticket quantities for free/confirmed registrations
    if (isFree && !requiresApproval) {
      for (const [ticketId, quantity] of ticketQuantities) {
        const ticket = ticketMap.get(ticketId)!
        await supabase
          .from("ticket_types")
          .update({ quantity_sold: ticket.quantity_sold + quantity })
          .eq("id", ticketId)
      }

      // Update discount code usage
      if (discountCodeId) {
        await supabase
          .from("discount_codes")
          .update({ current_uses: supabase.rpc("increment_discount_uses", { discount_id: discountCodeId }) })
          .eq("id", discountCodeId)
      }
    }

    // 5. If payment required, create Razorpay order
    if (!isFree && payment_method === "razorpay") {
      let credentials: RazorpayCredentials | undefined
      let razorpayKeyId: string | undefined

      const eventData = event as { razorpay_key_id?: string; razorpay_key_secret?: string }
      if (eventData.razorpay_key_id && eventData.razorpay_key_secret) {
        credentials = {
          key_id: eventData.razorpay_key_id,
          key_secret: eventData.razorpay_key_secret,
        }
        razorpayKeyId = eventData.razorpay_key_id
      }

      if (!razorpayKeyId) {
        razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
      }

      const paymentNumber = generatePaymentNumber()

      try {
        const razorpayOrder = await createOrder({
          amount: totalAmount,
          currency: "INR",
          receipt: paymentNumber,
          notes: {
            payment_type: "group_registration",
            event_id,
            order_id: orderRecord.id,
            buyer_id: buyerRecord.id,
            buyer_email: buyer.email,
            attendee_count: String(attendees.length),
          },
          credentials,
        })

        // Create payment record
        const { data: paymentRecord, error: paymentError } = await supabase
          .from("payments")
          .insert({
            payment_number: paymentNumber,
            payment_type: "group_registration",
            payment_method: "razorpay",
            payer_name: buyer.name,
            payer_email: buyer.email,
            payer_phone: buyer.phone,
            amount: totalAmount,
            currency: "INR",
            tax_amount: totalTax,
            discount_amount: discountAmount,
            net_amount: totalAmount,
            razorpay_order_id: razorpayOrder.id,
            status: "pending",
            event_id,
            metadata: {
              order_id: orderRecord.id,
              buyer_id: buyerRecord.id,
              registration_ids: registrations.map((r: Record<string, unknown>) => r.id),
              attendee_count: attendees.length,
            },
          })
          .select()
          .single()

        if (paymentError) {
          console.error("Failed to create payment record:", paymentError)
        }

        // Update order with payment reference
        await supabase
          .from("orders")
          .update({ payment_id: razorpayOrder.id })
          .eq("id", orderRecord.id)

        return NextResponse.json({
          success: true,
          requires_payment: true,
          order: orderRecord,
          buyer: buyerRecord,
          registrations,
          payment: {
            order_id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key: razorpayKeyId,
            payment_id: paymentRecord?.id,
            payment_number: paymentNumber,
          },
        })
      } catch (paymentError) {
        console.error("Failed to create Razorpay order:", paymentError)
        return NextResponse.json(
          { error: "Failed to create payment order" },
          { status: 500 }
        )
      }
    }

    // Return success for free registrations or other payment methods
    return NextResponse.json({
      success: true,
      requires_payment: !isFree && payment_method !== "free",
      order: orderRecord,
      buyer: buyerRecord,
      registrations,
      message: isFree
        ? "Group registration completed successfully"
        : `Order created. Payment method: ${payment_method}`,
    })
  } catch (error) {
    console.error("Group registration error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// GET - Get group registration details by order ID
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get("order_id")
    const buyerId = searchParams.get("buyer_id")

    if (!orderId && !buyerId) {
      return NextResponse.json(
        { error: "order_id or buyer_id is required" },
        { status: 400 }
      )
    }

    if (orderId) {
      // Fetch order with buyer and registrations
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select(`
          *,
          buyer:buyers(*),
          registrations(
            *,
            ticket_type:ticket_types(id, name, price)
          )
        `)
        .eq("id", orderId)
        .single()

      if (orderError) {
        return NextResponse.json(
          { error: "Order not found" },
          { status: 404 }
        )
      }

      return NextResponse.json(order)
    }

    if (buyerId) {
      // Fetch all orders for a buyer
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select(`
          *,
          registrations(
            *,
            ticket_type:ticket_types(id, name, price)
          )
        `)
        .eq("buyer_id", buyerId)
        .order("created_at", { ascending: false })

      if (ordersError) {
        return NextResponse.json(
          { error: "Failed to fetch orders" },
          { status: 500 }
        )
      }

      return NextResponse.json({ orders })
    }
  } catch (error) {
    console.error("Get group registration error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
