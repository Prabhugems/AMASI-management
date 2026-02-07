import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { createRefund, RazorpayCredentials } from "@/lib/services/razorpay"
import { logActivity } from "@/lib/activity-logger"

// POST /api/registrations/[id]/cancel - Cancel registration with optional refund
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      subtract_tax,
      cancellation_fee = 0,
      refund_now,
      refund_method,
      refund_date,
      refund_notes,
    } = body

    const supabase = await createAdminClient()

    // 1. Fetch registration with payment details
    const { data: registration, error: regError } = await (supabase as any)
      .from("registrations")
      .select(`
        id,
        registration_number,
        attendee_name,
        attendee_email,
        status,
        payment_status,
        payment_id,
        total_amount,
        ticket_type_id,
        event_id,
        events (id, name, short_name, razorpay_key_id, razorpay_key_secret)
      `)
      .eq("id", id)
      .single()

    if (regError || !registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }

    if (registration.status === "cancelled" || registration.status === "refunded") {
      return NextResponse.json({
        error: "Already cancelled",
        message: `This registration is already ${registration.status}`,
      }, { status: 400 })
    }

    // 2. Fetch payment if exists
    let payment: any = null
    if (registration.payment_id) {
      const { data: paymentData } = await (supabase as any)
        .from("payments")
        .select("*")
        .eq("id", registration.payment_id)
        .single()
      payment = paymentData
    }

    // 3. Calculate refund amount
    const amountPaid = payment?.net_amount || registration.total_amount || 0
    const taxAmount = payment?.tax_amount || 0
    let refundAmount = amountPaid

    if (subtract_tax && taxAmount > 0) {
      refundAmount -= taxAmount
    }

    if (cancellation_fee > 0) {
      refundAmount -= cancellation_fee
    }

    refundAmount = Math.max(0, Math.round(refundAmount * 100) / 100)

    // 4. Process refund if requested
    let razorpayRefundId: string | null = null
    let refundStatus = "pending"

    if (refund_now && refundAmount > 0 && payment?.razorpay_payment_id) {
      // Online refund via Razorpay
      try {
        let credentials: RazorpayCredentials | undefined
        if (registration.events?.razorpay_key_id && registration.events?.razorpay_key_secret) {
          credentials = {
            key_id: registration.events.razorpay_key_id,
            key_secret: registration.events.razorpay_key_secret,
          }
        }

        const refundResult = await createRefund(
          payment.razorpay_payment_id,
          refundAmount,
          {
            registration_number: registration.registration_number,
            reason: refund_notes || "Cancellation",
          },
          credentials
        )

        razorpayRefundId = refundResult.id
        refundStatus = "processed"
      } catch (refundError: any) {
        console.error("Razorpay refund failed:", refundError)
        return NextResponse.json({
          error: "Refund failed",
          message: refundError.error?.description || refundError.message || "Failed to process refund via Razorpay. Try 'Refund Later' option.",
        }, { status: 500 })
      }
    } else if (!refund_now && refundAmount > 0) {
      refundStatus = "scheduled"
    }

    // 5. Update payment record
    if (payment) {
      const paymentUpdate: any = {
        updated_at: new Date().toISOString(),
      }

      if (refundAmount > 0) {
        paymentUpdate.refund_amount = refundAmount
        paymentUpdate.refund_reason = refund_notes || "Cancellation"
        paymentUpdate.refunded_by = "admin"

        if (refundStatus === "processed") {
          paymentUpdate.status = refundAmount >= amountPaid ? "refunded" : "partially_refunded"
          paymentUpdate.razorpay_refund_id = razorpayRefundId
          paymentUpdate.refunded_at = new Date().toISOString()
        } else {
          // Scheduled/manual refund
          paymentUpdate.status = "refund_pending"
          paymentUpdate.metadata = {
            ...(payment.metadata || {}),
            refund_method: refund_method || "original",
            refund_date: refund_date || null,
            cancellation_fee: cancellation_fee,
            subtract_tax: subtract_tax,
            scheduled_refund: true,
          }
        }
      } else {
        paymentUpdate.status = "cancelled"
      }

      await (supabase as any)
        .from("payments")
        .update(paymentUpdate)
        .eq("id", payment.id)
    }

    // 6. Update registration status
    await (supabase as any)
      .from("registrations")
      .update({
        status: "cancelled",
        payment_status: refundAmount > 0 ? (refundStatus === "processed" ? "refunded" : "refund_pending") : "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    // 7. Restore ticket inventory
    if (registration.ticket_type_id && registration.status === "confirmed") {
      try {
        await (supabase as any).rpc("decrement_ticket_sold", {
          p_ticket_type_id: registration.ticket_type_id,
        })
      } catch {
        // Fallback: manual decrement
        const { data: ticket } = await (supabase as any)
          .from("ticket_types")
          .select("quantity_sold")
          .eq("id", registration.ticket_type_id)
          .single()

        if (ticket && ticket.quantity_sold > 0) {
          await (supabase as any)
            .from("ticket_types")
            .update({ quantity_sold: ticket.quantity_sold - 1 })
            .eq("id", registration.ticket_type_id)
        }
      }
    }

    // 8. Log activity
    logActivity({
      action: "cancel_registration",
      entityType: "registration",
      entityId: id,
      eventId: registration.event_id,
      eventName: registration.events?.name,
      description: `Cancelled registration for ${registration.attendee_name} (${registration.registration_number})${refundAmount > 0 ? `. Refund: ₹${refundAmount} (${refundStatus})` : ""}`,
      metadata: {
        registration_number: registration.registration_number,
        attendee_name: registration.attendee_name,
        refund_amount: refundAmount,
        refund_status: refundStatus,
        refund_method: refund_method,
        cancellation_fee: cancellation_fee,
        subtract_tax: subtract_tax,
        razorpay_refund_id: razorpayRefundId,
      },
    })

    return NextResponse.json({
      success: true,
      registration_id: id,
      registration_number: registration.registration_number,
      attendee_name: registration.attendee_name,
      amount_paid: amountPaid,
      refund_amount: refundAmount,
      cancellation_fee: cancellation_fee,
      tax_subtracted: subtract_tax ? taxAmount : 0,
      refund_status: refundStatus,
      razorpay_refund_id: razorpayRefundId,
      message: refundStatus === "processed"
        ? `Registration cancelled. ₹${refundAmount} refunded via Razorpay.`
        : refundStatus === "scheduled"
        ? `Registration cancelled. ₹${refundAmount} refund scheduled (${refund_method || "manual"}).`
        : "Registration cancelled. No refund applicable.",
    })
  } catch (error: any) {
    console.error("Error cancelling registration:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
