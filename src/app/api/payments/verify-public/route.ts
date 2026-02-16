import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { fetchPayment, getRazorpayForEvent, RazorpayCredentials } from "@/lib/services/razorpay"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

// POST /api/payments/verify-public - Public payment verification for delegates
// Security: requires matching email + payment belongs to that email
export async function POST(request: NextRequest) {
  // Rate limit: strict for payment verification (5 per minute)
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "strict")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  try {
    const body = await request.json()
    const { payment_id, razorpay_payment_id, email } = body

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    if (!razorpay_payment_id && !payment_id) {
      return NextResponse.json({ error: "Payment ID is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // 1. Find the payment - must match the email for security
    let payment: any = null

    if (payment_id) {
      // Search by our payment ID
      const { data } = await (supabase as any)
        .from("payments")
        .select("*")
        .eq("id", payment_id)
        .eq("payer_email", email.toLowerCase().trim())
        .maybeSingle()
      payment = data
    }

    if (!payment && razorpay_payment_id) {
      // Search by Razorpay Payment ID
      const { data } = await (supabase as any)
        .from("payments")
        .select("*")
        .eq("razorpay_payment_id", razorpay_payment_id.trim())
        .eq("payer_email", email.toLowerCase().trim())
        .maybeSingle()
      payment = data
    }

    if (!payment) {
      // Try finding by Razorpay Order ID in pending payments for this email
      const { data: pendingPayments } = await (supabase as any)
        .from("payments")
        .select("*")
        .eq("payer_email", email.toLowerCase().trim())
        .in("status", ["pending", "failed"])
        .order("created_at", { ascending: false })
        .limit(5)

      if (pendingPayments && pendingPayments.length > 0) {
        // Try to verify the first pending/failed payment
        payment = pendingPayments[0]
      }
    }

    if (!payment) {
      return NextResponse.json({
        status: "not_found",
        message: "No payment found for this email. Please check the email address.",
      })
    }

    // Already completed
    if (payment.status === "completed") {
      return NextResponse.json({
        status: "already_completed",
        message: "Your payment has been received and your registration is confirmed.",
        payment_number: payment.payment_number,
      })
    }

    // 2. Get Razorpay credentials for this event
    let credentials: RazorpayCredentials | undefined
    if (payment.event_id) {
      const { data: eventData } = await (supabase as any)
        .from("events")
        .select("razorpay_key_id, razorpay_key_secret, name")
        .eq("id", payment.event_id)
        .maybeSingle()

      if (eventData?.razorpay_key_id && eventData?.razorpay_key_secret) {
        credentials = {
          key_id: eventData.razorpay_key_id,
          key_secret: eventData.razorpay_key_secret,
        }
      }
    }

    // 3. Check with Razorpay
    let razorpayResult: any = null

    // Try by provided Razorpay Payment ID
    const rpPaymentIdToCheck = razorpay_payment_id?.trim() || payment.razorpay_payment_id
    if (rpPaymentIdToCheck) {
      try {
        razorpayResult = await fetchPayment(rpPaymentIdToCheck, credentials)
      } catch (e: any) {
        console.error("Public verify - fetch by payment ID failed:", e.message)
      }
    }

    // Try by order ID
    if (!razorpayResult && payment.razorpay_order_id) {
      try {
        const razorpay = credentials
          ? getRazorpayForEvent(credentials)
          : (await import("@/lib/services/razorpay")).razorpay()

        const orderPayments = await razorpay.orders.fetchPayments(payment.razorpay_order_id)
        if (orderPayments?.items?.length > 0) {
          razorpayResult = orderPayments.items.find(
            (p: any) => p.status === "captured" || p.status === "authorized"
          ) || orderPayments.items[0]
        }
      } catch (e: any) {
        console.error("Public verify - fetch by order ID failed:", e.message)
      }
    }

    if (!razorpayResult) {
      return NextResponse.json({
        status: "not_found_on_gateway",
        message: "Payment not found on the payment gateway. If money was deducted, it will be refunded within 5-7 business days by your bank.",
      })
    }

    // 4. Check Razorpay status
    if (razorpayResult.status === "captured" || razorpayResult.status === "authorized") {
      // Payment captured! Fix our database
      const { error: updateError } = await (supabase as any)
        .from("payments")
        .update({
          status: "completed",
          razorpay_payment_id: razorpayResult.id,
          razorpay_order_id: razorpayResult.order_id || payment.razorpay_order_id,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          notes: (payment.notes || "") + `\n[Self-Verification] Verified by delegate at ${new Date().toISOString()}`,
        })
        .eq("id", payment.id)

      if (!updateError) {
        // Confirm linked registrations
        const { data: linkedRegs } = await (supabase as any)
          .from("registrations")
          .select("id")
          .eq("payment_id", payment.id)

        if (linkedRegs && linkedRegs.length > 0) {
          await (supabase as any)
            .from("registrations")
            .update({
              status: "confirmed",
              payment_status: "completed",
              updated_at: new Date().toISOString(),
            })
            .eq("payment_id", payment.id)
        }

        // Also check metadata for registration_id
        if (payment.metadata?.registration_id) {
          await (supabase as any)
            .from("registrations")
            .update({
              status: "confirmed",
              payment_status: "completed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", payment.metadata.registration_id)
        }

        // Create admin notification/alert
        try {
          await (supabase as any)
            .from("payment_alerts")
            .insert({
              event_id: payment.event_id,
              payment_id: payment.id,
              alert_type: "self_verified",
              severity: "info",
              message: `Payment ${payment.payment_number} (₹${payment.net_amount || payment.amount}) was self-verified by ${payment.payer_name} (${payment.payer_email}). Razorpay status: ${razorpayResult.status}. Registration confirmed.`,
              razorpay_payment_id: razorpayResult.id,
              metadata: {
                payer_name: payment.payer_name,
                payer_email: payment.payer_email,
                amount: payment.net_amount || payment.amount,
                razorpay_status: razorpayResult.status,
                razorpay_method: razorpayResult.method,
                verified_at: new Date().toISOString(),
              },
            })
        } catch (alertErr) {
          // Don't fail if alert creation fails (table may not exist)
          console.error("Failed to create payment alert:", alertErr)
        }
      }

      return NextResponse.json({
        status: "verified",
        message: "Payment verified successfully! Your registration has been confirmed. You can now search again to view your registration details.",
        payment_number: payment.payment_number,
      })
    } else if (razorpayResult.status === "failed") {
      return NextResponse.json({
        status: "failed",
        message: "Payment failed on the payment gateway. Please try registering again with a new payment.",
      })
    } else {
      return NextResponse.json({
        status: "pending",
        message: `Payment is still processing (Status: ${razorpayResult.status}). Please wait a few minutes and try again.`,
      })
    }
  } catch (error: any) {
    console.error("Error in public payment verification:", error)
    return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 500 })
  }
}
