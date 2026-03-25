import { NextRequest, NextResponse } from "next/server"
import { createOrder, generatePaymentNumber, RazorpayCredentials } from "@/lib/services/razorpay"
import { createAdminClient } from "@/lib/supabase/server"
import crypto from "crypto"

// Generate idempotency key from payment details
function generateIdempotencyKey(email: string, amount: number, ticketIds: string[]): string {
  const data = `${email.toLowerCase()}-${amount}-${ticketIds.sort().join(",")}`
  return crypto.createHash("sha256").update(data).digest("hex").substring(0, 32)
}

// Duplicate detection window in milliseconds (5 minutes)
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const supabaseClient = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = supabaseClient as any
    const body = await request.json()
    const {
      amount: clientAmount, // Don't trust this - will validate
      currency = "INR",
      payment_type,
      event_id,
      registration_data,
      payer_name,
      payer_email,
      payer_phone,
      // New fields for server-side calculation
      tickets, // Array of {ticket_type_id, quantity}
      addons, // Array of {addonId, variantId?, quantity, unitPrice, totalPrice}
      discount_code,
      idempotency_key: clientIdempotencyKey, // Optional client-provided key
      metadata: clientMetadata, // Client-provided metadata (for addon purchases)
    } = body

    if (!payer_name || !payer_email) {
      return NextResponse.json(
        { error: "Payer name and email are required" },
        { status: 400 }
      )
    }

    // Validate email format
    const trimmedEmail = payer_email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json(
        { error: "Invalid email address format" },
        { status: 400 }
      )
    }

    // SECURITY: Calculate amount server-side - never trust client amount
    let calculatedAmount = 0
    const ticketDetails: any[] = []
    let taxPercentage = 18 // Default GST rate

    // For addon-only purchases, skip ticket requirement
    const isAddonPurchase = payment_type === "addon_purchase"

    // Require tickets for registration payments, but not for addon-only purchases
    if (!isAddonPurchase && (!tickets || !Array.isArray(tickets) || tickets.length === 0)) {
      return NextResponse.json(
        { error: "Tickets are required for payment" },
        { status: 400 }
      )
    }

    if (tickets && Array.isArray(tickets) && tickets.length > 0) {
      // Fetch ticket prices from database
      const ticketIds = tickets.map((t: any) => t.id || t.ticket_type_id)
      const { data: ticketTypes, error: ticketError } = await supabase
        .from("ticket_types")
        .select("id, price, tax_percentage, name, status, quantity_total, quantity_sold")
        .in("id", ticketIds)

      if (ticketError || !ticketTypes) {
        return NextResponse.json(
          { error: "Failed to fetch ticket details" },
          { status: 400 }
        )
      }

      // Calculate total from server-side data
      let subtotal = 0
      let totalTax = 0

      for (const ticketSelection of tickets) {
        const ticketId = ticketSelection.id || ticketSelection.ticket_type_id
        const quantity = ticketSelection.quantity || 1
        const ticket = ticketTypes.find((t: any) => t.id === ticketId)

        if (!ticket) {
          return NextResponse.json(
            { error: `Ticket type not found: ${ticketId}` },
            { status: 400 }
          )
        }

        // Check ticket is active
        if (ticket.status !== "active") {
          return NextResponse.json(
            { error: `Ticket "${ticket.name}" is not available` },
            { status: 400 }
          )
        }

        // Check availability
        if (ticket.quantity_total && ticket.quantity_sold + quantity > ticket.quantity_total) {
          return NextResponse.json(
            { error: `Not enough "${ticket.name}" tickets available` },
            { status: 400 }
          )
        }

        const ticketSubtotal = ticket.price * quantity
        const ticketTax = (ticketSubtotal * (ticket.tax_percentage || 0)) / 100

        subtotal += ticketSubtotal
        totalTax += ticketTax

        ticketDetails.push({
          ticket_type_id: ticket.id,
          name: ticket.name,
          price: ticket.price,
          quantity,
          subtotal: ticketSubtotal,
          tax: ticketTax,
        })
      }

      // Calculate addons amount (if provided)
      let addonsSubtotal = 0
      let addonsTax = 0
      // Use ticket tax rate if available
      if (ticketDetails.length > 0) {
        taxPercentage = ticketTypes.find((t: any) => t.id === ticketDetails[0].ticket_type_id)?.tax_percentage || 18
      }

      if (addons && Array.isArray(addons) && addons.length > 0) {
        // Fetch addon prices from database to validate (include variants for variant-specific pricing)
        const addonIds = addons.map((a: any) => a.addonId)
        const { data: addonData } = await supabase
          .from("addons")
          .select("id, price, name, is_active")
          .in("id", addonIds)

        // Fetch variants if any addon selections have a variantId
        const variantIds = addons.filter((a: any) => a.variantId).map((a: any) => a.variantId)
        let variantData: any[] = []
        if (variantIds.length > 0) {
          const { data: variants } = await supabase
            .from("addon_variants")
            .select("id, addon_id, price")
            .in("id", variantIds)
          variantData = variants || []
        }

        if (addonData) {
          for (const addonSelection of addons) {
            const addon = addonData.find((a: any) => a.id === addonSelection.addonId)
            if (addon && addon.is_active) {
              // Use variant price if a variant is selected, otherwise use base addon price
              let unitPrice = addon.price
              if (addonSelection.variantId) {
                const variant = variantData.find((v: any) => v.id === addonSelection.variantId && v.addon_id === addon.id)
                if (variant) {
                  unitPrice = variant.price
                }
              }
              const addonPrice = unitPrice * (addonSelection.quantity || 1)
              addonsSubtotal += addonPrice
            }
          }
          // Apply same tax rate to addons
          addonsTax = (addonsSubtotal * taxPercentage) / 100
        }
      }

      subtotal += addonsSubtotal
      totalTax += addonsTax

      // Apply discount if provided (simplified - full validation in registration)
      let discountAmount = 0
      if (discount_code && event_id) {
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
            if (discountData.discount_type === "percentage") {
              discountAmount = (subtotal * discountData.discount_value) / 100
            } else {
              discountAmount = discountData.discount_value
            }
            if (discountData.max_discount_amount && discountAmount > discountData.max_discount_amount) {
              discountAmount = discountData.max_discount_amount
            }

            // Increment current_uses to reserve the discount code immediately
            if (discountAmount > 0) {
              await supabase
                .from("discount_codes")
                .update({ current_uses: (discountData.current_uses || 0) + 1 })
                .eq("id", discountData.id)
            }
          }
        }
      }

      calculatedAmount = subtotal + totalTax - discountAmount
    }

    // Handle addon-only purchases (no tickets)
    if (isAddonPurchase && addons && Array.isArray(addons) && addons.length > 0) {
      // Fetch addon prices from database to validate
      const addonIds = addons.map((a: any) => a.addonId)
      const { data: addonData } = await supabase
        .from("addons")
        .select("id, price, name, is_active")
        .in("id", addonIds)

      // Fetch variants if any addon selections have a variantId
      const addonVariantIds = addons.filter((a: any) => a.variantId).map((a: any) => a.variantId)
      let addonVariantData: any[] = []
      if (addonVariantIds.length > 0) {
        const { data: variants } = await supabase
          .from("addon_variants")
          .select("id, addon_id, price")
          .in("id", addonVariantIds)
        addonVariantData = variants || []
      }

      if (addonData) {
        let addonsSubtotal = 0
        for (const addonSelection of addons) {
          const addon = addonData.find((a: any) => a.id === addonSelection.addonId)
          if (addon && addon.is_active) {
            // Use variant price if selected, otherwise base addon price
            let unitPrice = addon.price
            if (addonSelection.variantId) {
              const variant = addonVariantData.find((v: any) => v.id === addonSelection.variantId && v.addon_id === addon.id)
              if (variant) {
                unitPrice = variant.price
              }
            }
            const addonPrice = unitPrice * (addonSelection.quantity || 1)
            addonsSubtotal += addonPrice
          }
        }
        const addonsTax = Math.round((addonsSubtotal * taxPercentage) / 100)
        calculatedAmount = addonsSubtotal + addonsTax
      }
    }

    // Validate amount is positive
    if (!calculatedAmount || calculatedAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      )
    }

    // Use server-calculated amount
    const amount = calculatedAmount

    // DUPLICATE PAYMENT PREVENTION
    // Generate idempotency key from email + amount + tickets
    const ticketIds = tickets?.map((t: any) => t.id || t.ticket_type_id) || []
    const idempotencyKey = clientIdempotencyKey || generateIdempotencyKey(trimmedEmail, amount, ticketIds)

    // Check for existing pending payment within duplicate window (5 minutes)
    const duplicateWindowStart = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString()

    const duplicateQuery = supabase
      .from("payments")
      .select("id, razorpay_order_id, payment_number, status, created_at, amount")
      .eq("payer_email", trimmedEmail)
      .eq("amount", amount)
      .eq("status", "pending")
      .gte("created_at", duplicateWindowStart)

    if (event_id) {
      duplicateQuery.eq("event_id", event_id)
    }

    const { data: existingPayments } = await duplicateQuery
      .order("created_at", { ascending: false })
      .limit(1)

    if (existingPayments && existingPayments.length > 0) {
      const existingPayment = existingPayments[0]
      console.log(`[DUPLICATE PREVENTION] Returning existing order for ${payer_email}: ${existingPayment.razorpay_order_id}`)

      // Return existing order instead of creating duplicate
      // Fetch the Razorpay key for this event
      let razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
      if (event_id) {
        const { data: eventData } = await supabase
          .from("events")
          .select("razorpay_key_id")
          .eq("id", event_id)
          .single()
        if (eventData?.razorpay_key_id) {
          razorpayKeyId = eventData.razorpay_key_id
        }
      }

      return NextResponse.json({
        success: true,
        order_id: existingPayment.razorpay_order_id,
        amount: existingPayment.amount * 100, // Razorpay expects paise
        currency: "INR",
        key: razorpayKeyId,
        payment_id: existingPayment.id,
        payment_number: existingPayment.payment_number,
        is_duplicate: true, // Flag for client awareness
        message: "Returning existing pending payment",
      })
    }

    // Fetch event-specific Razorpay credentials if event_id is provided
    let credentials: RazorpayCredentials | undefined
    let razorpayKeyId: string | undefined

    if (event_id) {
      const { data: event } = await supabase
        .from("events")
        .select("razorpay_key_id, razorpay_key_secret, registration_open")
        .eq("id", event_id)
        .single()

      const eventData = event as any

      // Check if registration is open (skip for addon purchases - they're already registered)
      if (eventData?.registration_open === false && !isAddonPurchase) {
        return NextResponse.json(
          { error: "Registration is closed for this event" },
          { status: 403 }
        )
      }

      if (eventData?.razorpay_key_id && eventData?.razorpay_key_secret) {
        credentials = {
          key_id: eventData.razorpay_key_id,
          key_secret: eventData.razorpay_key_secret,
        }
        razorpayKeyId = eventData.razorpay_key_id
      }
    }

    // Use default key if event doesn't have specific credentials
    if (!razorpayKeyId) {
      razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    }

    // Generate payment number
    const paymentNumber = generatePaymentNumber()

    // Create Razorpay order with event-specific credentials
    const order = await createOrder({
      amount,
      currency,
      receipt: paymentNumber,
      notes: {
        payment_type: payment_type || "registration",
        event_id: event_id || "",
        payer_email: trimmedEmail,
      },
      credentials,
    })

    // Store pending payment in database
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        payment_number: paymentNumber,
        payment_type: payment_type || "registration",
        payment_method: "razorpay",
        payer_name: payer_name.trim(),
        payer_email: trimmedEmail,
        payer_phone,
        amount,
        currency,
        tax_amount: registration_data?.tax_amount || 0,
        discount_amount: registration_data?.discount_amount || 0,
        net_amount: amount,
        razorpay_order_id: order.id,
        status: "pending",
        event_id: event_id || null,
        metadata: {
          registration_data,
          razorpay_order: order,
          uses_event_credentials: !!credentials,
          // Store discount code used (for tracking/reversal on failure)
          discount_code: discount_code ? discount_code.toUpperCase() : null,
          // Store server-validated ticket details for verification
          validated_tickets: ticketDetails.length > 0 ? ticketDetails : null,
          validated_amount: amount,
          // Idempotency key for duplicate detection
          idempotency_key: idempotencyKey,
          // Store addons selection for registration creation
          addons_selection: addons && Array.isArray(addons) && addons.length > 0 ? addons : null,
          // For addon-only purchases: store existing registration ID
          registration_id: clientMetadata?.registration_id || null,
          registration_number: clientMetadata?.registration_number || null,
        },
      } as any)
      .select()
      .single()

    if (paymentError) {
      console.error("Failed to create payment record:", paymentError)
      // This is a critical error - we cannot proceed without a payment record
      // as we won't be able to track or verify the payment later
      return NextResponse.json(
        { error: "Failed to initialize payment. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key: razorpayKeyId,
      payment_id: payment?.id,
      payment_number: paymentNumber,
    })
  } catch (error: any) {
    console.error("Create order error:", error?.message || error)
    return NextResponse.json(
      { error: error?.message || "Failed to create order" },
      { status: 500 }
    )
  }
}
