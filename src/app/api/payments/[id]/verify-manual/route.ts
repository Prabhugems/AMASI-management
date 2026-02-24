import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { fetchPayment, getRazorpayForEvent, RazorpayCredentials } from "@/lib/services/razorpay"
import { requireAdmin } from "@/lib/auth/api-auth"

// POST /api/payments/[id]/verify-manual - Manually verify a payment with Razorpay
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require admin authentication
    const { user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { id } = await params
    const body = await request.json()
    const { razorpay_payment_id } = body // Optional: admin can provide Razorpay Payment ID

    const supabase = await createAdminClient()

    // 1. Fetch our payment record
    const { data: payment, error: paymentError } = await (supabase as any)
      .from("payments")
      .select("*")
      .eq("id", id)
      .single()

    if (paymentError || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    // Already completed - check if registration exists
    if (payment.status === "completed") {
      // Check if there's a linked registration
      const { data: existingReg } = await (supabase as any)
        .from("registrations")
        .select("id, registration_number")
        .eq("payment_id", id)
        .maybeSingle()

      if (existingReg) {
        return NextResponse.json({
          status: "already_completed",
          message: "This payment is already marked as completed",
          payment_id: payment.razorpay_payment_id,
          completed_at: payment.completed_at,
          registration_id: existingReg.id,
          registration_number: existingReg.registration_number,
        })
      }

      // Payment completed but NO registration - create one
      console.log(`[VERIFY-MANUAL] Payment ${id} completed but no registration - creating one`)
      const metadata = payment.metadata || {}
      const ticketDetails = metadata.validated_tickets?.[0]

      let ticketTypeId = ticketDetails?.ticket_type_id
      if (!ticketTypeId && payment.event_id) {
        const { data: defaultTicket } = await (supabase as any)
          .from("ticket_types")
          .select("id")
          .eq("event_id", payment.event_id)
          .eq("status", "active")
          .order("sort_order", { ascending: true })
          .limit(1)
          .maybeSingle()
        ticketTypeId = defaultTicket?.id
      }

      if (!ticketTypeId) {
        return NextResponse.json({
          status: "already_completed",
          message: "Payment completed but no registration found and no ticket type available. Please create the registration manually.",
          payment_id: payment.razorpay_payment_id,
          completed_at: payment.completed_at,
        })
      }

      // Generate registration number
      const { data: eventSettings } = await (supabase as any)
        .from("event_settings")
        .select("customize_registration_id, registration_prefix, registration_start_number, registration_suffix, current_registration_number")
        .eq("event_id", payment.event_id)
        .maybeSingle()

      let registrationNumber: string
      if (eventSettings?.customize_registration_id) {
        const prefix = eventSettings.registration_prefix || ""
        const suffix = eventSettings.registration_suffix || ""
        const startNumber = eventSettings.registration_start_number || 1
        const currentNumber = (eventSettings.current_registration_number || 0) + 1
        const regNumber = Math.max(startNumber, currentNumber)
        await (supabase as any)
          .from("event_settings")
          .update({ current_registration_number: regNumber })
          .eq("event_id", payment.event_id)
        registrationNumber = `${prefix}${regNumber}${suffix}`
      } else {
        const date = new Date()
        const dateStr = date.getFullYear().toString() +
          (date.getMonth() + 1).toString().padStart(2, "0") +
          date.getDate().toString().padStart(2, "0")
        const random = Math.floor(1000 + Math.random() * 9000)
        registrationNumber = `REG-${dateStr}-${random}`
      }

      const { data: newReg, error: regError } = await (supabase as any)
        .from("registrations")
        .insert({
          registration_number: registrationNumber,
          event_id: payment.event_id,
          ticket_type_id: ticketTypeId,
          attendee_name: payment.payer_name || "Pending Verification",
          attendee_email: payment.payer_email,
          attendee_phone: payment.payer_phone,
          quantity: ticketDetails?.quantity || 1,
          unit_price: ticketDetails?.price || payment.amount,
          total_amount: payment.amount,
          status: "confirmed",
          payment_status: "completed",
          payment_id: id,
          confirmed_at: new Date().toISOString(),
          custom_fields: {
            auto_created_from_manual_verify: true,
            created_at: new Date().toISOString(),
          },
        })
        .select()
        .single()

      if (regError) {
        console.error("[VERIFY-MANUAL] Failed to create registration:", regError)
        return NextResponse.json({
          status: "already_completed",
          message: `Payment completed but failed to create registration: ${regError.message}`,
          payment_id: payment.razorpay_payment_id,
        })
      }

      // Trigger auto actions (receipt email, badge, etc.)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collegeofmas.org.in"
      try {
        const { data: event } = await (supabase as any)
          .from("events")
          .select("name, start_date, venue_name")
          .eq("id", payment.event_id)
          .single()

        const { data: ticket } = await (supabase as any)
          .from("ticket_types")
          .select("name")
          .eq("id", ticketTypeId)
          .single()

        await fetch(`${baseUrl}/api/email/registration-confirmation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registration_id: newReg.id,
            registration_number: registrationNumber,
            attendee_name: payment.payer_name,
            attendee_email: payment.payer_email,
            event_name: event?.name || "Event",
            event_date: event?.start_date || "",
            event_venue: event?.venue_name || "",
            ticket_name: ticket?.name || "Ticket",
            quantity: ticketDetails?.quantity || 1,
            total_amount: payment.amount,
            payment_method: "razorpay",
            payment_status: "completed",
          }),
        })
        console.log(`[VERIFY-MANUAL] Receipt email sent to ${payment.payer_email}`)
      } catch (emailErr) {
        console.error("[VERIFY-MANUAL] Failed to send receipt:", emailErr)
      }

      return NextResponse.json({
        verified: true,
        status: "registration_created",
        message: `Payment was already completed. Registration ${registrationNumber} has been created and confirmation email sent.`,
        payment_id: payment.razorpay_payment_id,
        completed_at: payment.completed_at,
        registration_id: newReg.id,
        registration_number: registrationNumber,
        registrations_confirmed: 1,
      })
    }

    // 2. Get the Razorpay payment ID to check
    const rpPaymentId = razorpay_payment_id || payment.razorpay_payment_id
    const rpOrderId = payment.razorpay_order_id

    if (!rpPaymentId && !rpOrderId) {
      return NextResponse.json({
        status: "no_reference",
        message: "No Razorpay payment ID or order ID found. Please enter the Razorpay Payment ID manually.",
      })
    }

    // 3. Get event-specific Razorpay credentials
    let credentials: RazorpayCredentials | undefined
    if (payment.event_id) {
      const { data: eventData } = await (supabase as any)
        .from("events")
        .select("razorpay_key_id, razorpay_key_secret")
        .eq("id", payment.event_id)
        .single()

      if (eventData?.razorpay_key_id && eventData?.razorpay_key_secret) {
        credentials = {
          key_id: eventData.razorpay_key_id,
          key_secret: eventData.razorpay_key_secret,
        }
      }
    }

    // 4. Check with Razorpay
    let razorpayResult: any = null
    let verificationMethod = ""

    // Try by payment ID first
    if (rpPaymentId) {
      try {
        razorpayResult = await fetchPayment(rpPaymentId, credentials)
        verificationMethod = "payment_id"
      } catch (e: any) {
        console.error("Failed to fetch by payment ID:", e.message)
      }
    }

    // Try by order ID if payment ID didn't work
    if (!razorpayResult && rpOrderId) {
      try {
        const razorpay = credentials
          ? getRazorpayForEvent(credentials)
          : (await import("@/lib/services/razorpay")).razorpay()

        // Fetch order payments
        const orderPayments = await razorpay.orders.fetchPayments(rpOrderId)
        if (orderPayments?.items?.length > 0) {
          // Find the most recent captured payment
          razorpayResult = orderPayments.items.find(
            (p: any) => p.status === "captured" || p.status === "authorized"
          ) || orderPayments.items[0]
          verificationMethod = "order_id"
        }
      } catch (e: any) {
        console.error("Failed to fetch by order ID:", e.message)
      }
    }

    if (!razorpayResult) {
      return NextResponse.json({
        status: "not_found_on_gateway",
        message: "Payment not found on Razorpay. The payment may not have been initiated or the ID is incorrect.",
        checked: {
          payment_id: rpPaymentId || null,
          order_id: rpOrderId || null,
        },
      })
    }

    // 5. Determine the result
    const razorpayStatus = razorpayResult.status
    const razorpayAmount = (razorpayResult.amount || 0) / 100 // Convert paise to rupees
    const razorpayEmail = razorpayResult.email || razorpayResult.notes?.email
    const razorpayPhone = razorpayResult.contact || razorpayResult.notes?.phone

    const result: any = {
      status: razorpayStatus,
      razorpay_payment_id: razorpayResult.id,
      razorpay_order_id: razorpayResult.order_id,
      amount: razorpayAmount,
      currency: razorpayResult.currency,
      method: razorpayResult.method,
      email: razorpayEmail,
      phone: razorpayPhone,
      created_at: razorpayResult.created_at ? new Date(razorpayResult.created_at * 1000).toISOString() : null,
      our_status: payment.status,
      our_amount: payment.net_amount || payment.amount,
      verification_method: verificationMethod,
    }

    // 6. If payment is captured on Razorpay but failed/pending on our end, fix it
    if (razorpayStatus === "captured" || razorpayStatus === "authorized") {
      if (payment.status !== "completed") {
        // Update payment status
        const { error: updateError } = await (supabase as any)
          .from("payments")
          .update({
            status: "completed",
            razorpay_payment_id: razorpayResult.id,
            razorpay_order_id: razorpayResult.order_id || payment.razorpay_order_id,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            notes: (payment.notes || "") + `\n[Manual Verification] Verified at ${new Date().toISOString()}. Razorpay status: ${razorpayStatus}`,
          })
          .eq("id", id)

        if (updateError) {
          console.error("Failed to update payment:", updateError)
          result.update_error = updateError.message
        } else {
          result.action = "payment_updated_to_completed"

          // Also update any linked registrations
          if (payment.metadata?.registration_id) {
            await (supabase as any)
              .from("registrations")
              .update({
                status: "confirmed",
                payment_status: "completed",
                updated_at: new Date().toISOString(),
              })
              .eq("id", payment.metadata.registration_id)
            result.registration_updated = true
          }

          // Check for registrations linked by payment_id
          const { data: linkedRegs } = await (supabase as any)
            .from("registrations")
            .select("id")
            .eq("payment_id", id)

          if (linkedRegs && linkedRegs.length > 0) {
            await (supabase as any)
              .from("registrations")
              .update({
                status: "confirmed",
                payment_status: "completed",
                updated_at: new Date().toISOString(),
              })
              .eq("payment_id", id)
            result.registrations_confirmed = linkedRegs.length
          }
        }
      }

      result.verified = true
      result.message = "Payment is captured on Razorpay and has been marked as completed."
    } else if (razorpayStatus === "failed") {
      result.verified = false
      result.message = `Payment failed on Razorpay. Status: ${razorpayStatus}. The customer needs to make a new payment.`
    } else {
      result.verified = false
      result.message = `Payment status on Razorpay: ${razorpayStatus}. No action taken.`
    }

    // Amount mismatch warning
    if (razorpayAmount > 0 && payment.net_amount && Math.abs(razorpayAmount - payment.net_amount) > 1) {
      result.amount_mismatch = true
      result.warning = `Amount mismatch: Razorpay has ₹${razorpayAmount}, our record has ₹${payment.net_amount}`
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Error verifying payment:", error)
    return NextResponse.json({ error: "Failed to verify payment" }, { status: 500 })
  }
}
