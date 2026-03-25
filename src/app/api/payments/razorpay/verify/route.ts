import { NextRequest, NextResponse } from "next/server"
import { verifyPaymentSignature, fetchPayment, RazorpayCredentials } from "@/lib/services/razorpay"
import { createAdminClient } from "@/lib/supabase/server"
import { getNextRegistrationNumber } from "@/lib/services/registration-number"
import { isGallaboxEnabled, sendGallaboxTemplate } from "@/lib/gallabox"
import { isQikchatEnabled, sendQikchatText } from "@/lib/qikchat"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createAdminClient() as any
    const body = await request.json()
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      registration_id, // Optional - if frontend already created registration
    } = body

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing payment verification fields" },
        { status: 400 }
      )
    }

    // ============================================================
    // STEP 1: Fetch payment record with ALL data
    // ============================================================
    const { data: pendingPayment, error: fetchError } = await supabase
      .from("payments")
      .select("*")
      .eq("razorpay_order_id", razorpay_order_id)
      .maybeSingle()

    let paymentData: any = pendingPayment

    if (fetchError || !pendingPayment) {
      // Payment record not in DB — create-order may have failed during deployment.
      // Recover by fetching payment details from Razorpay and creating the record.
      console.warn(`[VERIFY] Payment not found for order: ${razorpay_order_id}. Attempting recovery...`)

      try {
        const rpPayment = await fetchPayment(razorpay_payment_id)
        const eventId = rpPayment?.notes?.event_id || null
        const payerEmail = rpPayment?.email || rpPayment?.notes?.payer_email || body.payer_email || "unknown@unknown.com"
        const payerName = rpPayment?.notes?.payer_name || body.payer_name || "Unknown"
        const payerPhone = String(rpPayment?.contact || "").replace("+", "") || body.payer_phone || null
        const amount = (Number(rpPayment?.amount) || 0) / 100

        // Try to get event-specific credentials for signature verification
        let recoveryKeySecret: string | undefined
        if (eventId) {
          const { data: evt } = await supabase
            .from("events")
            .select("razorpay_key_secret")
            .eq("id", eventId)
            .maybeSingle()
          if (evt?.razorpay_key_secret) recoveryKeySecret = evt.razorpay_key_secret
        }

        // Verify signature before creating record
        const sigValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, recoveryKeySecret)
        if (!sigValid) {
          return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 })
        }

        // Determine ticket info from Razorpay notes or body
        const ticketInfo = body.tickets || body.metadata?.tickets || null

        const paymentNumber = `RCV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`
        const { data: newPayment, error: insertError } = await supabase
          .from("payments")
          .insert({
            payment_number: paymentNumber,
            payment_type: "registration",
            payment_method: "razorpay",
            payer_name: payerName,
            payer_email: payerEmail,
            payer_phone: payerPhone,
            amount,
            currency: rpPayment?.currency || "INR",
            net_amount: amount,
            razorpay_order_id,
            razorpay_payment_id,
            status: "pending", // Set to pending so it flows through normal STEP 6 verification
            event_id: eventId,
            metadata: {
              recovered_from_verify: true,
              original_create_order_failed: true,
              razorpay_notes: rpPayment?.notes || {},
              ticket_info: ticketInfo,
              registration_data: body.registration_data || null,
            },
          } as any)
          .select()
          .single()

        if (insertError || !newPayment) {
          console.error(`[VERIFY] Failed to recover payment record:`, insertError)
          return NextResponse.json({ error: "Payment recovery failed" }, { status: 500 })
        }

        console.log(`[VERIFY] Recovered payment record: ${paymentNumber} for ${payerEmail}`)
        paymentData = newPayment as any
      } catch (recoveryError) {
        console.error(`[VERIFY] Recovery failed:`, recoveryError)
        return NextResponse.json({ error: "Payment record not found and recovery failed" }, { status: 404 })
      }
    }

    // ============================================================
    // STEP 2: IDEMPOTENCY CHECK - Already completed?
    // ============================================================
    if (paymentData.status === "completed") {
      console.log(`[VERIFY] Payment already completed: ${razorpay_order_id}`)

      // Find the registration for this payment
      const { data: existingReg } = await supabase
        .from("registrations")
        .select("id, registration_number")
        .eq("payment_id", paymentData.id)
        .maybeSingle()

      return NextResponse.json({
        success: true,
        payment_id: paymentData.id,
        payment_number: paymentData.payment_number,
        registration_id: existingReg?.id,
        registration_number: existingReg?.registration_number,
        status: "completed",
        message: "Payment already verified",
        is_duplicate: true,
      })
    }

    // ============================================================
    // STEP 3: Fetch event credentials for signature verification
    // ============================================================
    let credentials: RazorpayCredentials | undefined
    let keySecret: string | undefined

    if (paymentData.event_id) {
      const { data: event } = await supabase
        .from("events")
        .select("razorpay_key_id, razorpay_key_secret")
        .eq("id", paymentData.event_id)
        .maybeSingle()

      const eventData = event as any
      if (eventData?.razorpay_key_id && eventData?.razorpay_key_secret) {
        credentials = {
          key_id: eventData.razorpay_key_id,
          key_secret: eventData.razorpay_key_secret,
        }
        keySecret = eventData.razorpay_key_secret
      }
    }

    // ============================================================
    // STEP 4: Verify payment signature
    // ============================================================
    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      keySecret
    )

    if (!isValid) {
      console.error(`[VERIFY] Invalid signature for order: ${razorpay_order_id}`)
      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400 }
      )
    }

    // ============================================================
    // STEP 5: Fetch payment details from Razorpay (double-check)
    // ============================================================
    let razorpayPayment: any = null
    try {
      razorpayPayment = await fetchPayment(razorpay_payment_id, credentials)

      // Verify payment status from Razorpay (only if we got a response)
      if (razorpayPayment && razorpayPayment.status !== "captured" && razorpayPayment.status !== "authorized") {
        console.error(`[VERIFY] Payment not captured. Status: ${razorpayPayment.status}`)
        return NextResponse.json(
          { error: `Payment not captured. Status: ${razorpayPayment.status}` },
          { status: 400 }
        )
      }
    } catch (rpError) {
      console.error(`[VERIFY] Failed to fetch from Razorpay:`, rpError)
      // Continue anyway - signature is valid, so payment is legitimate
    }

    // ============================================================
    // STEP 6: Update payment record (PRESERVE existing metadata!)
    // ============================================================
    const existingMetadata = paymentData.metadata || {}

    const { error: paymentUpdateError } = await supabase
      .from("payments")
      .update({
        razorpay_payment_id,
        razorpay_signature,
        status: "completed",
        completed_at: new Date().toISOString(),
        metadata: {
          ...existingMetadata, // PRESERVE existing metadata!
          razorpay_payment: razorpayPayment,
          verified_at: new Date().toISOString(),
          verified_via: "verify_api",
        },
      } as any)
      .eq("id", paymentData.id)
      .eq("status", "pending") // Only update if still pending (idempotency)

    if (paymentUpdateError) {
      console.error(`[VERIFY] Failed to update payment:`, paymentUpdateError)
      // Don't fail - payment is valid, we need to continue
    }

    // ============================================================
    // STEP 7: Handle GROUP registration (has order_id in metadata)
    // ============================================================
    if (existingMetadata.order_id) {
      return await handleGroupRegistration(
        supabase,
        paymentData,
        existingMetadata,
        razorpay_payment_id
      )
    }

    // ============================================================
    // STEP 7.5: Handle ADDON-ONLY purchases (existing registration)
    // ============================================================
    if (paymentData.payment_type === "addon_purchase" && existingMetadata.registration_id) {
      console.log(`[VERIFY] Processing addon-only purchase for registration: ${existingMetadata.registration_id}`)

      // Add addons to the existing registration
      if (existingMetadata.addons_selection?.length > 0) {
        await createRegistrationAddons(
          supabase,
          existingMetadata.registration_id,
          existingMetadata.addons_selection
        )
      }

      // Get registration details for response
      const { data: existingReg } = await supabase
        .from("registrations")
        .select("id, registration_number")
        .eq("id", existingMetadata.registration_id)
        .single()

      return NextResponse.json({
        success: true,
        payment_id: paymentData.id,
        payment_number: paymentData.payment_number,
        registration_id: existingReg?.id || existingMetadata.registration_id,
        registration_number: existingReg?.registration_number || existingMetadata.registration_number,
        status: "completed",
        message: "Addon purchase verified successfully",
      })
    }

    // ============================================================
    // STEP 8: Handle INDIVIDUAL registration
    // ============================================================

    // Check if registration already exists for this payment
    const { data: existingRegistration } = await supabase
      .from("registrations")
      .select("id, registration_number, status")
      .eq("payment_id", paymentData.id)
      .single()

    let finalRegistration: any = existingRegistration

    if (existingRegistration) {
      // Registration exists - just update status if needed
      if (existingRegistration.status !== "confirmed") {
        await supabase
          .from("registrations")
          .update({
            status: "confirmed",
            payment_status: "completed",
            confirmed_at: new Date().toISOString(),
          })
          .eq("id", existingRegistration.id)
      }
      console.log(`[VERIFY] Updated existing registration: ${existingRegistration.registration_number}`)
    } else if (registration_id) {
      // Frontend passed registration_id - update it
      const { data: regData, error: regError } = await supabase
        .from("registrations")
        .update({
          status: "confirmed",
          payment_status: "completed",
          payment_id: paymentData.id,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", registration_id)
        .select()
        .single()

      if (regError) {
        console.error(`[VERIFY] Failed to update registration ${registration_id}:`, regError)
      } else {
        finalRegistration = regData
        console.log(`[VERIFY] Updated registration from frontend: ${regData?.registration_number}`)
      }
    } else {
      // NO REGISTRATION EXISTS YET - create it server-side from payment metadata
      // This is the primary registration creation path. The frontend sends
      // registration_data in the verify request, and create-order also stores
      // it in payment metadata as a fallback.
      console.log(`[VERIFY] No registration yet - creating from payment metadata`)

      // Merge registration data: prefer fresh data from verify request body,
      // fall back to what was stored in payment metadata by create-order
      const mergedMetadata = {
        ...existingMetadata,
        registration_data: body.registration_data || existingMetadata.registration_data,
      }

      // Update payer info on payment record if provided fresh in body
      if (body.payer_name || body.payer_email || body.payer_phone) {
        const patchFields: any = {}
        if (body.payer_name) patchFields.payer_name = body.payer_name
        if (body.payer_email) patchFields.payer_email = body.payer_email
        if (body.payer_phone) patchFields.payer_phone = body.payer_phone
        await supabase.from("payments").update(patchFields).eq("id", paymentData.id)
        // Also update local reference
        if (body.payer_name) paymentData.payer_name = body.payer_name
        if (body.payer_email) paymentData.payer_email = body.payer_email
        if (body.payer_phone) paymentData.payer_phone = body.payer_phone
      }

      const created = await createRegistrationFromPayment(supabase, paymentData, mergedMetadata)
      if (created) {
        finalRegistration = created
        console.log(`[VERIFY] Created registration: ${created.registration_number}`)
      } else {
        console.error(`[VERIFY] Failed to create registration from payment metadata`)
      }
    }

    // ============================================================
    // STEP 9: Update ticket quantity_sold (skip if already done in createRegistrationFromPayment)
    // ============================================================
    if (finalRegistration) {
      // Only increment if registration was NOT auto-created (auto-created ones handle it internally)
      if (!finalRegistration.custom_fields?.auto_created_from_payment) {
        await incrementTicketSold(
          supabase,
          finalRegistration.ticket_type_id,
          finalRegistration.quantity || 1,
          paymentData.id
        )
      }

      // Create registration_addons if addons were purchased
      if (existingMetadata.addons_selection?.length > 0) {
        await createRegistrationAddons(
          supabase,
          finalRegistration.id,
          existingMetadata.addons_selection
        )
      }

      // Trigger auto actions (receipt, badge, certificate)
      if (paymentData.event_id) {
        triggerAutoActions(supabase, finalRegistration.id, paymentData.event_id).catch(console.error)
      }

      // Send WhatsApp confirmation (non-blocking)
      if ((isGallaboxEnabled() || isQikchatEnabled()) && finalRegistration.attendee_phone) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || ""
        const portalUrl = `${baseUrl}/my`
        const attendeeName = finalRegistration.attendee_name || "Delegate"
        const eventName = existingMetadata.event_name || "Event"

        if (isQikchatEnabled()) {
          const message = `Hello ${attendeeName}! 🎉\n\nYour payment for *${eventName}* is confirmed!\n\n📋 Registration: ${finalRegistration.registration_number}\n\nManage your registration: ${portalUrl}\n\n- Team TechnoSurg`
          sendQikchatText(finalRegistration.attendee_phone, message).then(waResult => {
            if (waResult.success) {
              console.log(`[WhatsApp/Qikchat] Confirmation sent to ${finalRegistration.attendee_phone} - ID: ${waResult.messageId}`)
            } else {
              console.warn(`[WhatsApp/Qikchat] Failed for ${finalRegistration.attendee_phone}: ${waResult.error}`)
            }
          }).catch(err => {
            console.warn("[WhatsApp/Qikchat] error:", err.message)
          })
        } else {
          sendGallaboxTemplate(
            finalRegistration.attendee_phone,
            attendeeName,
            "delegate_login",
            { "1": attendeeName, "2": eventName, "3": portalUrl }
          ).then(waResult => {
            if (waResult.success) {
              console.log(`[WhatsApp/Gallabox] delegate_login sent to ${finalRegistration.attendee_phone} - ID: ${waResult.messageId}`)
            } else {
              console.warn(`[WhatsApp/Gallabox] delegate_login failed for ${finalRegistration.attendee_phone}: ${waResult.error}`)
            }
          }).catch(err => {
            console.warn("[WhatsApp/Gallabox] delegate_login error:", err.message)
          })
        }
      }
    }

    // ============================================================
    // STEP 10: Return success response
    // ============================================================
    return NextResponse.json({
      success: true,
      payment_id: paymentData.id,
      payment_number: paymentData.payment_number,
      registration_id: finalRegistration?.id,
      registration_number: finalRegistration?.registration_number,
      status: "completed",
      message: "Payment verified successfully",
    })

  } catch (error) {
    console.error("[VERIFY] Payment verification error:", error)
    return NextResponse.json(
      { error: "Payment verification failed" },
      { status: 500 }
    )
  }
}

// ============================================================
// HELPER: Handle group registration
// ============================================================
async function handleGroupRegistration(
  supabase: any,
  paymentData: any,
  metadata: any,
  razorpayPaymentId: string
) {
  const orderId = metadata.order_id
  const buyerId = metadata.buyer_id

  // Update order payment status
  await supabase
    .from("orders")
    .update({
      payment_status: "completed",
      payment_id: razorpayPaymentId,
    })
    .eq("id", orderId)

  // Update buyer payment status
  if (buyerId) {
    await supabase
      .from("buyers")
      .update({ payment_status: "completed" })
      .eq("id", buyerId)
  }

  // Fetch registrations linked to this order
  const { data: registrations } = await supabase
    .from("registrations")
    .select("id, ticket_type_id, quantity, status")
    .eq("order_id", orderId)

  // Update all registrations to confirmed
  const { error: regUpdateError } = await supabase
    .from("registrations")
    .update({
      status: "confirmed",
      payment_status: "completed",
      payment_id: paymentData.id,
      confirmed_at: new Date().toISOString(),
    })
    .eq("order_id", orderId)
    .neq("status", "confirmed") // Only update non-confirmed (idempotency)

  if (regUpdateError) {
    console.error("[VERIFY] Failed to update group registrations:", regUpdateError)
  }

  // Update ticket quantities (with idempotency)
  if (registrations && registrations.length > 0) {
    const ticketCounts = new Map<string, number>()
    for (const reg of registrations) {
      if (reg.status !== "confirmed") { // Only count newly confirmed
        const current = ticketCounts.get(reg.ticket_type_id) || 0
        ticketCounts.set(reg.ticket_type_id, current + (reg.quantity || 1))
      }
    }

    for (const [ticketId, count] of ticketCounts) {
      await incrementTicketSold(supabase, ticketId, count, paymentData.id)
    }

    // Trigger auto actions for each registration
    if (paymentData.event_id) {
      for (const reg of registrations) {
        triggerAutoActions(supabase, reg.id, paymentData.event_id).catch(console.error)
      }
    }
  }

  return NextResponse.json({
    success: true,
    payment_id: paymentData.id,
    payment_number: paymentData.payment_number,
    order_id: orderId,
    registration_count: registrations?.length || 0,
    status: "completed",
    message: "Group payment verified successfully",
  })
}

// ============================================================
// HELPER: Create registration from payment metadata (SAFETY NET)
// ============================================================
async function createRegistrationFromPayment(supabase: any, paymentData: any, metadata: any) {
  const validatedTickets = metadata.validated_tickets || []
  const firstTicket = validatedTickets[0]

  if (!firstTicket && !paymentData.event_id) {
    console.error("[VERIFY] Cannot create registration - no ticket details or event_id")
    return null
  }

  // Use registration_data from metadata for attendee details (set by verify body or create-order)
  const regData = metadata.registration_data || {}

  // If there are multiple tickets, create a registration for each
  const ticketsToProcess = validatedTickets.length > 0
    ? validatedTickets
    : [null] // null sentinel means "use defaults"

  let firstRegistration: any = null

  for (const ticketDetails of ticketsToProcess) {
    // Get ticket type if not in metadata
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

    // Generate registration number
    const registrationNumber = await getNextRegistrationNumber(supabase, paymentData.event_id)

    const registrationData = {
      registration_number: registrationNumber,
      event_id: paymentData.event_id,
      ticket_type_id: ticketTypeId,
      attendee_name: ticketDetails?.attendee_name || regData.attendee_name || paymentData.payer_name || "Pending Verification",
      attendee_email: ticketDetails?.attendee_email || regData.attendee_email || paymentData.payer_email,
      attendee_phone: ticketDetails?.attendee_phone || regData.attendee_phone || paymentData.payer_phone,
      quantity: ticketDetails?.quantity || 1,
      unit_price: ticketDetails?.price || paymentData.amount,
      total_amount: ticketDetails?.total_price || paymentData.amount,
      status: "confirmed",
      payment_status: "completed",
      payment_id: paymentData.id,
      confirmed_at: new Date().toISOString(),
      custom_fields: {
        ...(regData.custom_fields || {}),
        auto_created_from_payment: true,
        created_at: new Date().toISOString(),
      },
    }

    const { data: registration, error } = await supabase
      .from("registrations")
      .insert(registrationData as any)
      .select()
      .single()

    if (error) {
      console.error("[VERIFY] Failed to create registration from payment:", error)
      continue
    }

    console.log(`[VERIFY] Auto-created registration: ${registrationNumber} for payment ${paymentData.id}`)

    // Increment ticket sold count for this ticket type
    if (ticketTypeId) {
      await incrementTicketSold(supabase, ticketTypeId, ticketDetails?.quantity || 1, paymentData.id)
    }

    if (!firstRegistration) firstRegistration = registration
  }

  return firstRegistration
}

// ============================================================
// HELPER: Increment ticket quantity_sold (ATOMIC with RPC)
// ============================================================
async function incrementTicketSold(supabase: any, ticketTypeId: string, quantity: number, paymentId: string) {
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
      console.log(`[VERIFY] RPC not available, using fallback: ${error.message}`)
      await incrementTicketSoldFallback(supabase, ticketTypeId, quantity, paymentId)
      return
    }

    const result = data as any
    if (result?.success) {
      console.log(`[VERIFY] Atomically incremented ticket ${ticketTypeId} by ${quantity}`)
    } else if (result?.reason === 'already_processed') {
      console.log(`[VERIFY] Ticket increment already processed for payment: ${paymentId}`)
    } else {
      console.log(`[VERIFY] Ticket increment failed: ${result?.reason}`)
    }
  } catch (err) {
    console.error(`[VERIFY] Error in atomic increment:`, err)
    // Fallback
    await incrementTicketSoldFallback(supabase, ticketTypeId, quantity, paymentId)
  }
}

// Fallback for when RPC is not yet deployed
async function incrementTicketSoldFallback(supabase: any, ticketTypeId: string, quantity: number, paymentId: string) {
  const { data: ticket } = await supabase
    .from("ticket_types")
    .select("quantity_sold, metadata")
    .eq("id", ticketTypeId)
    .single()

  if (!ticket) return

  const ticketData = ticket as any
  const processedPayments = ticketData.metadata?.processed_payments || []

  if (processedPayments.includes(paymentId)) {
    console.log(`[VERIFY] Fallback: Already processed for payment: ${paymentId}`)
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

  console.log(`[VERIFY] Fallback incremented ticket ${ticketTypeId} by ${quantity}`)
}

// ============================================================
// HELPER: Create registration addons
// ============================================================
async function createRegistrationAddons(supabase: any, registrationId: string, addonsSelection: any[]) {
  if (!addonsSelection || addonsSelection.length === 0) return

  // Get existing addons to avoid duplicates
  const { data: existingAddons } = await supabase
    .from("registration_addons")
    .select("addon_id, addon_variant_id")
    .eq("registration_id", registrationId)

  const existingKeys = new Set(
    (existingAddons || []).map((a: any) => `${a.addon_id}-${a.addon_variant_id || 'null'}`)
  )

  // Filter out addons that already exist
  const newAddons = addonsSelection.filter((addon: any) => {
    const key = `${addon.addonId}-${addon.variantId || 'null'}`
    return !existingKeys.has(key)
  })

  if (newAddons.length === 0) {
    console.log(`[VERIFY] All addons already exist for registration: ${registrationId}`)
    return
  }

  const addonRecords = newAddons.map((addon: any) => ({
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
    console.error("[VERIFY] Failed to create registration addons:", error)
  } else {
    console.log(`[VERIFY] Created ${addonRecords.length} addons for registration: ${registrationId}`)
  }
}

// ============================================================
// HELPER: Trigger auto actions (receipt, badge, certificate)
// ============================================================
async function triggerAutoActions(supabase: any, registrationId: string, eventId: string) {
  try {
    // Fetch event settings
    const { data: eventSettings } = await supabase
      .from("event_settings")
      .select("auto_send_receipt, auto_generate_badge, auto_email_badge, auto_generate_certificate, auto_email_certificate")
      .eq("event_id", eventId)
      .single()

    // Fetch registration details for email
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
    const internalHeaders = {
      "Content-Type": "application/json",
      "x-internal-secret": process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "",
    }

    // Auto-send receipt (default true)
    if (eventSettings?.auto_send_receipt !== false) {
      try {
        console.log(`[AUTO] Sending receipt for registration ${regData.registration_number}`)
        const receiptResult = await fetch(`${baseUrl}/api/email/registration-confirmation`, {
          method: "POST",
          headers: internalHeaders,
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
          console.log(`[AUTO] Generating badge for registration ${regData.registration_number}`)
          const badgeResult = await fetch(`${baseUrl}/api/badges/generate`, {
            method: "POST",
            headers: internalHeaders,
            body: JSON.stringify({
              event_id: eventId,
              template_id: (template as any).id,
              single_registration_id: registrationId,
              store_badges: true,
            }),
          })

          if (badgeResult.ok) {
            console.log(`[AUTO] Badge generated for ${regData.registration_number}`)

            if (eventSettings?.auto_email_badge) {
              const badgeEmailResult = await fetch(`${baseUrl}/api/badges/email`, {
                method: "POST",
                headers: internalHeaders,
                body: JSON.stringify({ registration_id: registrationId }),
              })
              if (badgeEmailResult.ok) {
                console.log(`[AUTO] Badge email sent for ${regData.registration_number}`)
              } else {
                console.error(`[AUTO] Failed to send badge email for ${regData.registration_number}: ${badgeEmailResult.status}`)
              }
            }
          } else {
            console.error(`[AUTO] Badge generation failed:`, await badgeResult.text())
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
          console.log(`[AUTO] Generating certificate for registration ${regData.registration_number}`)
          const certResult = await fetch(`${baseUrl}/api/certificates/generate`, {
            method: "POST",
            headers: internalHeaders,
            body: JSON.stringify({
              event_id: eventId,
              template_id: (certTemplate as any).id,
              registration_ids: [registrationId],
              store_certificates: true,
            }),
          })

          if (certResult.ok) {
            const certData = await certResult.json()
            console.log(`[AUTO] Certificate generated for ${regData.registration_number}`)

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
                headers: internalHeaders,
                body: JSON.stringify({
                  registration_id: registrationId,
                  email: regData.attendee_email,
                  attendee_name: regData.attendee_name,
                  event_name: regData.events?.name,
                }),
              })
              if (certEmailResult.ok) {
                console.log(`[AUTO] Certificate email sent for ${regData.registration_number}`)
              } else {
                console.error(`[AUTO] Failed to send certificate email for ${regData.registration_number}: ${certEmailResult.status}`)
              }
            }
          } else {
            console.error(`[AUTO] Certificate generation failed:`, await certResult.text())
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
