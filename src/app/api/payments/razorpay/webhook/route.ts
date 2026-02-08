import { NextRequest, NextResponse } from "next/server"
import { verifyWebhookSignature } from "@/lib/services/razorpay"
import { createClient, SupabaseClient } from "@supabase/supabase-js"

// Create admin client for server-side operations
// IMPORTANT: Webhook handler requires service role key for proper database access
function getSupabaseAdmin(): SupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for webhook processing")
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    serviceRoleKey
  )
}

// Lazy initialization to allow error handling in route handler
let supabase: SupabaseClient

// Razorpay webhook events we handle
type WebhookEvent =
  | "payment.captured"
  | "payment.failed"
  | "refund.created"
  | "refund.processed"
  | "refund.failed"

interface WebhookPayload {
  event: WebhookEvent
  payload: {
    payment?: {
      entity: {
        id: string
        order_id: string
        amount: number
        currency: string
        status: string
        method: string
        email: string
        contact: string
        notes: Record<string, string>
        error_code?: string
        error_description?: string
      }
    }
    refund?: {
      entity: {
        id: string
        payment_id: string
        amount: number
        status: string
        notes: Record<string, string>
      }
    }
  }
}

/**
 * Get event-specific webhook secret or fall back to default
 */
async function getWebhookSecret(orderId: string): Promise<string | null> {
  const { data: payment } = await supabase
    .from("payments")
    .select("event_id")
    .eq("razorpay_order_id", orderId)
    .single()

  const paymentData = payment as any
  if (paymentData?.event_id) {
    const { data: event } = await supabase
      .from("events")
      .select("razorpay_webhook_secret")
      .eq("id", paymentData.event_id)
      .single()

    const eventData = event as any
    if (eventData?.razorpay_webhook_secret) {
      return eventData.razorpay_webhook_secret
    }
  }

  return process.env.RAZORPAY_WEBHOOK_SECRET || null
}

/**
 * Get order_id from payment_id (for refund webhooks)
 */
async function getOrderIdFromPaymentId(paymentId: string): Promise<string | null> {
  const { data: payment } = await supabase
    .from("payments")
    .select("razorpay_order_id")
    .eq("razorpay_payment_id", paymentId)
    .single()

  const paymentData = payment as any
  return paymentData?.razorpay_order_id || null
}

// Generate registration number
function generateRegistrationNumber(): string {
  const date = new Date()
  const dateStr = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, "0") +
    date.getDate().toString().padStart(2, "0")
  const random = Math.floor(1000 + Math.random() * 9000)
  return `REG-${dateStr}-${random}`
}

// Get custom registration number from event settings
async function getNextRegistrationNumber(eventId: string): Promise<string> {
  const { data: settings } = await supabase
    .from("event_settings")
    .select("customize_registration_id, registration_prefix, registration_start_number, registration_suffix, current_registration_number")
    .eq("event_id", eventId)
    .maybeSingle()

  if (settings?.customize_registration_id) {
    const prefix = settings.registration_prefix || ""
    const suffix = settings.registration_suffix || ""
    const startNumber = settings.registration_start_number || 1
    const currentNumber = (settings.current_registration_number || 0) + 1
    const regNumber = Math.max(startNumber, currentNumber)

    await supabase
      .from("event_settings")
      .update({ current_registration_number: regNumber })
      .eq("event_id", eventId)

    return `${prefix}${regNumber}${suffix}`
  }

  return generateRegistrationNumber()
}

export async function POST(request: NextRequest) {
  try {
    // Initialize supabase admin client (requires service role key)
    try {
      supabase = getSupabaseAdmin()
    } catch (error) {
      console.error("[WEBHOOK] Supabase initialization failed:", error)
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get("x-razorpay-signature")

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 })
    }

    // Parse payload first to get order_id for finding the right webhook secret
    const payload: WebhookPayload = JSON.parse(rawBody)
    const { event } = payload

    // Get the order_id to look up event-specific webhook secret
    const orderId = payload.payload.payment?.entity?.order_id
      || (payload.payload.refund?.entity?.payment_id
        ? await getOrderIdFromPaymentId(payload.payload.refund.entity.payment_id)
        : null)

    // Get the appropriate webhook secret
    const webhookSecret = orderId ? await getWebhookSecret(orderId) : process.env.RAZORPAY_WEBHOOK_SECRET

    if (!webhookSecret) {
      console.error("[WEBHOOK] No webhook secret configured")
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
    }

    // Verify webhook signature
    const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret)
    if (!isValid) {
      // Try with default secret as fallback
      const defaultValid = process.env.RAZORPAY_WEBHOOK_SECRET
        ? verifyWebhookSignature(rawBody, signature, process.env.RAZORPAY_WEBHOOK_SECRET)
        : false

      if (!defaultValid) {
        console.error("[WEBHOOK] Invalid signature")
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
      }
    }

    switch (event) {
      case "payment.captured": {
        const payment = payload.payload.payment?.entity
        if (!payment) break

        console.log(`[WEBHOOK] Payment captured: ${payment.id}, Order: ${payment.order_id}`)
        await handlePaymentCaptured(payment)
        break
      }

      case "payment.failed": {
        const payment = payload.payload.payment?.entity
        if (!payment) break

        await handlePaymentFailed(payment)
        break
      }

      case "refund.processed": {
        const refund = payload.payload.refund?.entity
        if (!refund) break

        await handleRefundProcessed(refund)
        break
      }

      case "refund.failed": {
        const refund = payload.payload.refund?.entity
        if (!refund) break
        console.error(`[WEBHOOK] Refund failed: ${refund.id}`)
        break
      }

      default:
        console.log(`[WEBHOOK] Unhandled event: ${event}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("[WEBHOOK] Processing error:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}

// ============================================================
// HANDLER: Payment Captured
// ============================================================
async function handlePaymentCaptured(razorpayPayment: any) {
  // Find existing payment record
  const { data: paymentRecord, error: paymentFetchError } = await supabase
    .from("payments")
    .select("*")
    .eq("razorpay_order_id", razorpayPayment.order_id)
    .single()

  const paymentData = paymentRecord as any

  if (paymentFetchError || !paymentData) {
    // ORPHAN PAYMENT: Received from Razorpay but not in our database
    console.log(`[WEBHOOK] ORPHAN PAYMENT: ${razorpayPayment.order_id} not found in database`)
    await createOrphanPaymentRecord(razorpayPayment)
    await logPaymentAlert(null, "orphan_webhook", `Received payment ${razorpayPayment.id} not found in database`)
    return
  }

  // ============================================================
  // IDEMPOTENCY CHECK - Already completed?
  // ============================================================
  if (paymentData.status === "completed") {
    console.log(`[WEBHOOK] Payment already completed via verify API: ${razorpayPayment.order_id}`)

    // Still check if registration exists
    const { data: existingReg } = await supabase
      .from("registrations")
      .select("id")
      .eq("payment_id", paymentData.id)
      .single()

    if (!existingReg) {
      // Payment completed but no registration - create one!
      console.log(`[WEBHOOK] Payment completed but no registration - creating one`)
      await createRegistrationFromPayment(paymentData, paymentData.metadata || {})
    }

    return
  }

  // ============================================================
  // Update payment status (PRESERVE existing metadata!)
  // ============================================================
  const existingMetadata = paymentData.metadata || {}

  const { error: updateError } = await supabase
    .from("payments")
    .update({
      status: "completed",
      razorpay_payment_id: razorpayPayment.id,
      completed_at: new Date().toISOString(),
      metadata: {
        ...existingMetadata,
        webhook_event: "payment.captured",
        webhook_captured_at: new Date().toISOString(),
        razorpay_response: razorpayPayment,
      },
    } as any)
    .eq("razorpay_order_id", razorpayPayment.order_id)
    .eq("status", "pending") // Only update if still pending

  if (updateError) {
    // Might have been updated by verify API already - that's OK
    console.log(`[WEBHOOK] Payment update skipped (probably already processed): ${razorpayPayment.order_id}`)
  }

  // ============================================================
  // Handle Group Registration
  // ============================================================
  if (existingMetadata.order_id) {
    await handleGroupRegistrationWebhook(paymentData, existingMetadata)
    return
  }

  // ============================================================
  // Check if registration exists for this payment
  // ============================================================
  const { data: registrations } = await supabase
    .from("registrations")
    .select("id, status, ticket_type_id, quantity")
    .eq("payment_id", paymentData.id)

  if (!registrations || registrations.length === 0) {
    // NO REGISTRATION - Create from payment metadata!
    console.log(`[WEBHOOK] No registration found - creating from payment metadata`)
    const newReg = await createRegistrationFromPayment(paymentData, existingMetadata)

    if (newReg) {
      await incrementTicketSold(newReg.ticket_type_id, newReg.quantity || 1, paymentData.id)

      // Create addons if any
      if (existingMetadata.addons_selection?.length > 0) {
        await createRegistrationAddons(newReg.id, existingMetadata.addons_selection)
      }

      // Trigger auto actions
      if (paymentData.event_id) {
        triggerAutoActions(newReg.id, paymentData.event_id).catch(console.error)
      }
    }

    await logPaymentAlert(paymentData.id, "orphan_payment",
      `Payment ${razorpayPayment.id} completed but no registration found. Auto-registration created.`)
    return
  }

  // Registration exists - update if not confirmed
  for (const reg of registrations) {
    if (reg.status !== "confirmed") {
      await supabase
        .from("registrations")
        .update({
          status: "confirmed",
          payment_status: "completed",
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", reg.id)

      // Increment ticket count
      await incrementTicketSold(reg.ticket_type_id, reg.quantity || 1, paymentData.id)

      console.log(`[WEBHOOK] Auto-confirmed registration ${reg.id}`)

      // Trigger auto actions
      if (paymentData.event_id) {
        triggerAutoActions(reg.id, paymentData.event_id).catch(console.error)
      }
    }
  }

  console.log(`[WEBHOOK] Payment captured: ${razorpayPayment.id}`)
}

// ============================================================
// HANDLER: Payment Failed
// ============================================================
async function handlePaymentFailed(razorpayPayment: any) {
  // Fetch existing payment to preserve metadata
  const { data: existingPayment } = await supabase
    .from("payments")
    .select("metadata")
    .eq("razorpay_order_id", razorpayPayment.order_id)
    .single()

  const existingMetadata = (existingPayment as any)?.metadata || {}

  await supabase
    .from("payments")
    .update({
      status: "failed",
      razorpay_payment_id: razorpayPayment.id,
      failed_at: new Date().toISOString(),
      metadata: {
        ...existingMetadata, // PRESERVE existing metadata
        webhook_event: "payment.failed",
        error_code: razorpayPayment.error_code,
        error_description: razorpayPayment.error_description,
        razorpay_response: razorpayPayment,
      },
    } as any)
    .eq("razorpay_order_id", razorpayPayment.order_id)

  console.log(`[WEBHOOK] Payment failed: ${razorpayPayment.id}`)
}

// ============================================================
// HANDLER: Refund Processed
// ============================================================
async function handleRefundProcessed(refund: any) {
  // Update payment with refund details
  const { data: paymentRecord } = await supabase
    .from("payments")
    .select("id, metadata")
    .eq("razorpay_payment_id", refund.payment_id)
    .single()

  const paymentData = paymentRecord as any

  await supabase
    .from("payments")
    .update({
      status: "refunded",
      refund_amount: refund.amount / 100,
      razorpay_refund_id: refund.id,
      refunded_at: new Date().toISOString(),
      metadata: {
        ...paymentData?.metadata,
        webhook_event: "refund.processed",
        refund_response: refund,
      },
    } as any)
    .eq("razorpay_payment_id", refund.payment_id)

  // Update related registration
  if (paymentData?.id) {
    await supabase
      .from("registrations")
      .update({
        status: "refunded",
        refunded_at: new Date().toISOString(),
      })
      .eq("payment_id", paymentData.id)
  }

  console.log(`[WEBHOOK] Refund processed: ${refund.id}`)
}

// ============================================================
// HANDLER: Group Registration via Webhook
// ============================================================
async function handleGroupRegistrationWebhook(paymentData: any, metadata: any) {
  const orderId = metadata.order_id
  const buyerId = metadata.buyer_id

  // Update order
  await supabase
    .from("orders")
    .update({
      payment_status: "completed",
      payment_id: paymentData.razorpay_payment_id,
    })
    .eq("id", orderId)

  // Update buyer
  if (buyerId) {
    await supabase
      .from("buyers")
      .update({ payment_status: "completed" })
      .eq("id", buyerId)
  }

  // Fetch and update registrations
  const { data: registrations } = await supabase
    .from("registrations")
    .select("id, ticket_type_id, quantity, status")
    .eq("order_id", orderId)

  if (registrations) {
    for (const reg of registrations) {
      if (reg.status !== "confirmed") {
        await supabase
          .from("registrations")
          .update({
            status: "confirmed",
            payment_status: "completed",
            payment_id: paymentData.id,
            confirmed_at: new Date().toISOString(),
          })
          .eq("id", reg.id)

        await incrementTicketSold(reg.ticket_type_id, reg.quantity || 1, paymentData.id)

        if (paymentData.event_id) {
          triggerAutoActions(reg.id, paymentData.event_id).catch(console.error)
        }
      }
    }
  }

  console.log(`[WEBHOOK] Group registration completed for order: ${orderId}`)
}

// ============================================================
// HELPER: Create orphan payment record
// ============================================================
async function createOrphanPaymentRecord(razorpayPayment: any) {
  const paymentNumber = `ORPHAN-${Date.now().toString(36).toUpperCase()}`

  const { error } = await supabase.from("payments").insert({
    payment_number: paymentNumber,
    payment_type: "registration",
    payment_method: "razorpay",
    payer_name: razorpayPayment.notes?.payer_name || "Unknown",
    payer_email: razorpayPayment.email || razorpayPayment.notes?.payer_email || "unknown@unknown.com",
    payer_phone: razorpayPayment.contact,
    amount: razorpayPayment.amount / 100,
    currency: razorpayPayment.currency,
    net_amount: razorpayPayment.amount / 100,
    razorpay_order_id: razorpayPayment.order_id,
    razorpay_payment_id: razorpayPayment.id,
    status: "completed",
    completed_at: new Date().toISOString(),
    event_id: razorpayPayment.notes?.event_id || null,
    metadata: {
      is_orphan: true,
      needs_reconciliation: true,
      created_from_webhook: true,
      razorpay_response: razorpayPayment,
    },
  } as any)

  if (error) {
    console.error("[WEBHOOK] Failed to create orphan payment:", error)
  } else {
    console.log(`[WEBHOOK] Created orphan payment record: ${paymentNumber}`)
  }
}

// ============================================================
// HELPER: Create registration from payment metadata
// ============================================================
async function createRegistrationFromPayment(paymentData: any, metadata: any) {
  const ticketDetails = metadata.validated_tickets?.[0]

  if (!ticketDetails && !paymentData.event_id) {
    console.error("[WEBHOOK] Cannot create registration - no ticket details or event_id")
    return null
  }

  let ticketTypeId = ticketDetails?.ticket_type_id
  if (!ticketTypeId && paymentData.event_id) {
    const { data: defaultTicket } = await supabase
      .from("ticket_types")
      .select("id")
      .eq("event_id", paymentData.event_id)
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .limit(1)
      .single()

    ticketTypeId = defaultTicket?.id
  }

  const registrationNumber = await getNextRegistrationNumber(paymentData.event_id)

  const registrationData = {
    registration_number: registrationNumber,
    event_id: paymentData.event_id,
    ticket_type_id: ticketTypeId,
    attendee_name: paymentData.payer_name || "Pending Verification",
    attendee_email: paymentData.payer_email,
    attendee_phone: paymentData.payer_phone,
    quantity: ticketDetails?.quantity || 1,
    unit_price: ticketDetails?.price || paymentData.amount,
    total_amount: paymentData.amount,
    status: "confirmed",
    payment_status: "completed",
    payment_id: paymentData.id,
    payment_method: "razorpay",
    confirmed_at: new Date().toISOString(),
    custom_fields: {
      auto_created_from_webhook: true,
      needs_admin_review: true,
      created_at: new Date().toISOString(),
    },
  }

  const { data: registration, error } = await supabase
    .from("registrations")
    .insert(registrationData as any)
    .select()
    .single()

  if (error) {
    console.error("[WEBHOOK] Failed to create registration from payment:", error)
    return null
  }

  console.log(`[WEBHOOK] Auto-created registration: ${registrationNumber} for payment ${paymentData.id}`)
  return registration
}

// ============================================================
// HELPER: Increment ticket quantity_sold (ATOMIC with RPC)
// ============================================================
async function incrementTicketSold(ticketTypeId: string, quantity: number, paymentId: string) {
  if (!ticketTypeId) return

  try {
    // Use atomic RPC function to prevent race conditions
    const { data, error } = await supabase.rpc('increment_ticket_sold_atomic', {
      p_ticket_type_id: ticketTypeId,
      p_payment_id: paymentId,
      p_quantity: quantity,
    })

    if (error) {
      // Fallback to non-atomic update if RPC doesn't exist yet
      console.log(`[WEBHOOK] RPC not available, using fallback: ${error.message}`)
      await incrementTicketSoldFallback(ticketTypeId, quantity, paymentId)
      return
    }

    const result = data as any
    if (result?.success) {
      console.log(`[WEBHOOK] Atomically incremented ticket ${ticketTypeId} by ${quantity}`)
    } else if (result?.reason === 'already_processed') {
      console.log(`[WEBHOOK] Ticket increment already processed for payment: ${paymentId}`)
    } else {
      console.log(`[WEBHOOK] Ticket increment failed: ${result?.reason}`)
    }
  } catch (err) {
    console.error(`[WEBHOOK] Error in atomic increment:`, err)
    // Fallback
    await incrementTicketSoldFallback(ticketTypeId, quantity, paymentId)
  }
}

// Fallback for when RPC is not yet deployed
async function incrementTicketSoldFallback(ticketTypeId: string, quantity: number, paymentId: string) {
  const { data: ticket } = await supabase
    .from("ticket_types")
    .select("quantity_sold, metadata")
    .eq("id", ticketTypeId)
    .single()

  if (!ticket) return

  const ticketData = ticket as any
  const processedPayments = ticketData.metadata?.processed_payments || []

  if (processedPayments.includes(paymentId)) {
    console.log(`[WEBHOOK] Fallback: Already processed for payment: ${paymentId}`)
    return
  }

  await supabase
    .from("ticket_types")
    .update({
      quantity_sold: (ticketData.quantity_sold || 0) + quantity,
      metadata: {
        ...ticketData.metadata,
        processed_payments: [...processedPayments, paymentId].slice(-100),
      },
    })
    .eq("id", ticketTypeId)

  console.log(`[WEBHOOK] Fallback incremented ticket ${ticketTypeId} by ${quantity}`)
}

// ============================================================
// HELPER: Create registration addons
// ============================================================
async function createRegistrationAddons(registrationId: string, addonsSelection: any[]) {
  if (!addonsSelection || addonsSelection.length === 0) return

  const { data: existing } = await supabase
    .from("registration_addons")
    .select("id")
    .eq("registration_id", registrationId)
    .limit(1)

  if (existing && existing.length > 0) {
    console.log(`[WEBHOOK] Addons already exist for registration: ${registrationId}`)
    return
  }

  const addonRecords = addonsSelection.map((addon: any) => ({
    registration_id: registrationId,
    addon_id: addon.addonId,
    addon_variant_id: addon.variantId || null,
    quantity: addon.quantity || 1,
    unit_price: addon.unitPrice || 0,
    total_price: addon.totalPrice || 0,
  }))

  const { error } = await supabase
    .from("registration_addons")
    .insert(addonRecords)

  if (error) {
    console.error("[WEBHOOK] Failed to create registration addons:", error)
  } else {
    console.log(`[WEBHOOK] Created ${addonRecords.length} addons for registration: ${registrationId}`)
  }
}

// ============================================================
// HELPER: Log payment alert
// ============================================================
async function logPaymentAlert(paymentId: string | null, alertType: string, message: string) {
  console.log(`[PAYMENT ALERT] ${alertType}: ${message}`)

  try {
    await supabase.from("payment_alerts").insert({
      payment_id: paymentId,
      alert_type: alertType,
      message: message,
      severity: alertType.includes("orphan") ? "high" : "medium",
      status: "pending",
      created_at: new Date().toISOString(),
    } as any)
  } catch (e) {
    // Table might not exist, just log to console
  }
}

// ============================================================
// HELPER: Trigger auto actions
// ============================================================
async function triggerAutoActions(registrationId: string, eventId: string) {
  try {
    const { data: eventSettings } = await supabase
      .from("event_settings")
      .select("auto_send_receipt, auto_generate_badge, auto_email_badge, auto_generate_certificate, auto_email_certificate")
      .eq("event_id", eventId)
      .single()

    const { data: registration } = await supabase
      .from("registrations")
      .select(`
        id, registration_number, attendee_name, attendee_email, quantity, total_amount,
        payment_status, event_id,
        events!inner(name, start_date, venue_name),
        ticket_types!inner(name)
      `)
      .eq("id", registrationId)
      .single()

    if (!registration) {
      console.error(`[AUTO] Registration ${registrationId} not found`)
      return
    }

    const regData = registration as any
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")

    // Auto-send receipt
    if (eventSettings?.auto_send_receipt !== false) {
      try {
        const receiptResult = await fetch(`${baseUrl}/api/email/registration-confirmation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registration_id: regData.id,
            registration_number: regData.registration_number,
            attendee_name: regData.attendee_name,
            attendee_email: regData.attendee_email,
            event_name: regData.events?.name || "Event",
            event_date: regData.events?.start_date || "",
            event_venue: regData.events?.venue_name || "",
            ticket_name: regData.ticket_types?.name || "Ticket",
            quantity: regData.quantity || 1,
            total_amount: regData.total_amount || 0,
            payment_method: "razorpay",
            payment_status: "completed",
          }),
        })
        if (receiptResult.ok) {
          console.log(`[AUTO] Receipt sent for ${regData.registration_number}`)
        } else {
          console.error(`[AUTO] Failed to send receipt for ${regData.registration_number}: ${receiptResult.status}`)
        }
      } catch (emailError) {
        console.error(`[AUTO] Failed to send receipt:`, emailError)
      }
    }

    // Auto-generate badge
    if (eventSettings?.auto_generate_badge) {
      try {
        const { data: template } = await supabase
          .from("badge_templates")
          .select("id")
          .eq("event_id", eventId)
          .eq("is_default", true)
          .single()

        if (template) {
          const badgeResult = await fetch(`${baseUrl}/api/badges/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event_id: eventId,
              template_id: (template as any).id,
              single_registration_id: registrationId,
              store_badges: true,
            }),
          })

          if (badgeResult.ok && eventSettings?.auto_email_badge) {
            const badgeEmailResult = await fetch(`${baseUrl}/api/badges/email`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ registration_id: registrationId }),
            })
            if (!badgeEmailResult.ok) {
              console.error(`[AUTO] Failed to email badge for registration ${registrationId}: ${badgeEmailResult.status}`)
            }
          }
        }
      } catch (badgeError) {
        console.error(`[AUTO] Failed to generate badge:`, badgeError)
      }
    }

    // Auto-generate certificate
    if (eventSettings?.auto_generate_certificate) {
      try {
        const { data: certTemplate } = await supabase
          .from("certificate_templates")
          .select("id")
          .eq("event_id", eventId)
          .eq("is_default", true)
          .single()

        if (certTemplate) {
          const certResult = await fetch(`${baseUrl}/api/certificates/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event_id: eventId,
              template_id: (certTemplate as any).id,
              registration_ids: [registrationId],
              store_certificates: true,
            }),
          })

          if (certResult.ok) {
            const certData = await certResult.json()
            if (certData.certificate_url) {
              await supabase
                .from("registrations")
                .update({
                  certificate_url: certData.certificate_url,
                  certificate_generated_at: new Date().toISOString(),
                  certificate_template_id: (certTemplate as any).id,
                })
                .eq("id", registrationId)
            }

            if (eventSettings?.auto_email_certificate && regData.attendee_email) {
              const certEmailResult = await fetch(`${baseUrl}/api/certificates/email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  registration_id: registrationId,
                  email: regData.attendee_email,
                  attendee_name: regData.attendee_name,
                  event_name: regData.events?.name,
                }),
              })
              if (!certEmailResult.ok) {
                console.error(`[AUTO] Failed to email certificate for registration ${registrationId}: ${certEmailResult.status}`)
              }
            }
          }
        }
      } catch (certError) {
        console.error(`[AUTO] Failed to generate certificate:`, certError)
      }
    }
  } catch (error) {
    console.error(`[AUTO] Error in auto actions:`, error)
  }
}

// GET endpoint to check webhook status/health
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/payments/razorpay/webhook",
    supported_events: ["payment.captured", "payment.failed", "refund.processed", "refund.failed"],
    features: [
      "Idempotent processing",
      "Orphan payment detection",
      "Auto-registration creation",
      "Ticket inventory updates (idempotent)",
      "Registration addons creation",
      "Admin alerts",
      "Auto receipt email",
      "Auto badge generation",
      "Coordination with verify API"
    ],
    message: "Configure this URL in Razorpay Dashboard > Webhooks",
  })
}
