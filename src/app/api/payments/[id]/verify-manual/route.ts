import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { fetchPayment, getRazorpayForEvent, RazorpayCredentials } from "@/lib/services/razorpay"

// POST /api/payments/[id]/verify-manual - Manually verify a payment with Razorpay
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // Already completed - no need to verify
    if (payment.status === "completed") {
      return NextResponse.json({
        status: "already_completed",
        message: "This payment is already marked as completed",
        payment_id: payment.razorpay_payment_id,
        completed_at: payment.completed_at,
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
