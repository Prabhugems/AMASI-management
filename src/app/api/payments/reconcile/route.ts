import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import crypto from "crypto"

// Generate registration number using cryptographically secure random
function generateRegistrationNumber(): string {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "")
  const random = crypto.randomBytes(3).toString("hex").toUpperCase()
  return `REG-${dateStr}-${random}`
}

interface ReconciliationResult {
  orphaned_payments: number
  auto_registrations_created: number
  duplicate_payments_flagged: number
  stale_pending_payments: number
  errors: string[]
  details: any[]
}

/**
 * POST /api/payments/reconcile
 * Run payment reconciliation to find and fix issues
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const { user, error: authError } = await requireAdmin()
    if (authError) return authError

    const supabase = await createAdminClient() as any
    const body = await request.json().catch(() => ({}))
    const {
      fix = false, // If true, auto-fix issues. If false, just report
      hours = 24,  // Look back period in hours
    } = body

    const result: ReconciliationResult = {
      orphaned_payments: 0,
      auto_registrations_created: 0,
      duplicate_payments_flagged: 0,
      stale_pending_payments: 0,
      errors: [],
      details: [],
    }

    const lookbackDate = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    // 1. Find completed payments without registrations (ORPHANED)
    console.log("[RECONCILE] Checking for orphaned payments...")
    const { data: completedPayments, error: paymentsError } = await supabase
      .from("payments")
      .select("id, payment_number, payer_email, payer_name, payer_phone, amount, event_id, metadata, created_at")
      .eq("status", "completed")
      .gte("created_at", lookbackDate)
      .order("created_at", { ascending: false })

    if (paymentsError) {
      result.errors.push(`Failed to fetch payments: ${paymentsError.message}`)
    } else if (completedPayments) {
      for (const payment of completedPayments) {
        // Check if registration exists
        const { data: registrations } = await supabase
          .from("registrations")
          .select("id")
          .eq("payment_id", payment.id)

        if (!registrations || registrations.length === 0) {
          result.orphaned_payments++
          result.details.push({
            type: "orphaned_payment",
            payment_id: payment.id,
            payment_number: payment.payment_number,
            email: payment.payer_email,
            amount: payment.amount,
            created_at: payment.created_at,
          })

          // Auto-fix if requested
          if (fix) {
            const registration = await createAutoRegistration(supabase, payment)
            if (registration) {
              result.auto_registrations_created++
            }
          }
        }
      }
    }

    // 2. Find duplicate payments (same email + amount within 5 minutes)
    console.log("[RECONCILE] Checking for duplicate payments...")
    const { data: allPayments } = await supabase
      .from("payments")
      .select("id, payment_number, payer_email, amount, status, created_at")
      .in("status", ["completed", "pending"])
      .gte("created_at", lookbackDate)
      .order("created_at", { ascending: true })

    if (allPayments) {
      const emailAmountMap = new Map<string, any[]>()

      for (const payment of allPayments) {
        const key = `${payment.payer_email?.toLowerCase()}-${payment.amount}`
        if (!emailAmountMap.has(key)) {
          emailAmountMap.set(key, [])
        }
        emailAmountMap.get(key)!.push(payment)
      }

      for (const [key, payments] of emailAmountMap) {
        if (payments.length > 1) {
          // Check if they're within 5 minutes of each other
          for (let i = 1; i < payments.length; i++) {
            const prev = new Date(payments[i - 1].created_at).getTime()
            const curr = new Date(payments[i].created_at).getTime()
            if (curr - prev < 5 * 60 * 1000) {
              result.duplicate_payments_flagged++
              result.details.push({
                type: "potential_duplicate",
                payment_1: payments[i - 1].payment_number,
                payment_2: payments[i].payment_number,
                email: payments[i].payer_email,
                amount: payments[i].amount,
                time_diff_seconds: Math.round((curr - prev) / 1000),
              })
            }
          }
        }
      }
    }

    // 3. Find stale pending payments (pending for more than 30 minutes)
    console.log("[RECONCILE] Checking for stale pending payments...")
    const staleCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { data: stalePending } = await supabase
      .from("payments")
      .select("id, payment_number, payer_email, amount, created_at")
      .eq("status", "pending")
      .lt("created_at", staleCutoff)
      .gte("created_at", lookbackDate)

    if (stalePending) {
      result.stale_pending_payments = stalePending.length
      for (const payment of stalePending) {
        result.details.push({
          type: "stale_pending",
          payment_id: payment.id,
          payment_number: payment.payment_number,
          email: payment.payer_email,
          amount: payment.amount,
          created_at: payment.created_at,
          age_minutes: Math.round((Date.now() - new Date(payment.created_at).getTime()) / 60000),
        })
      }
    }

    console.log("[RECONCILE] Completed:", result)

    return NextResponse.json({
      success: true,
      lookback_hours: hours,
      fix_mode: fix,
      summary: {
        orphaned_payments: result.orphaned_payments,
        auto_registrations_created: result.auto_registrations_created,
        duplicate_payments_flagged: result.duplicate_payments_flagged,
        stale_pending_payments: result.stale_pending_payments,
      },
      details: result.details,
      errors: result.errors,
    })
  } catch (error: any) {
    console.error("[RECONCILE] Error:", error)
    return NextResponse.json(
      { error: "Reconciliation failed" },
      { status: 500 }
    )
  }
}

// Auto-create registration for orphan payment
async function createAutoRegistration(supabase: any, payment: any) {
  const registrationNumber = generateRegistrationNumber()
  const metadata = payment.metadata || {}
  const ticketDetails = metadata.validated_tickets?.[0]

  let ticketTypeId = ticketDetails?.ticket_type_id
  if (!ticketTypeId && payment.event_id) {
    const { data: defaultTicket } = await supabase
      .from("ticket_types")
      .select("id")
      .eq("event_id", payment.event_id)
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .limit(1)
      .single()

    ticketTypeId = (defaultTicket as any)?.id
  }

  const { data: registration, error } = await supabase
    .from("registrations")
    .insert({
      registration_number: registrationNumber,
      event_id: payment.event_id,
      ticket_type_id: ticketTypeId,
      attendee_name: payment.payer_name || "Pending Verification",
      attendee_email: payment.payer_email,
      attendee_phone: payment.payer_phone,
      quantity: ticketDetails?.quantity || 1,
      unit_price: payment.amount,
      total_amount: payment.amount,
      status: "pending", // Mark as pending for admin review
      payment_status: "completed",
      payment_id: payment.id,
      custom_fields: {
        auto_created: true,
        created_from_reconciliation: true,
        needs_admin_review: true,
      },
    } as any)
    .select()
    .single()

  if (error) {
    console.error("[RECONCILE] Failed to create registration:", error)
    return null
  }

  console.log(`[RECONCILE] Created registration ${registrationNumber} for payment ${payment.payment_number}`)
  return registration
}

/**
 * GET /api/payments/reconcile
 * Get reconciliation status/help
 */
export async function GET() {
  // Require admin authentication
  const { user, error: authError } = await requireAdmin()
  if (authError) return authError

  return NextResponse.json({
    endpoint: "/api/payments/reconcile",
    method: "POST",
    description: "Run payment reconciliation to find and fix orphaned payments",
    parameters: {
      fix: "boolean - If true, auto-create registrations for orphaned payments (default: false)",
      hours: "number - How many hours to look back (default: 24)",
    },
    example: {
      url: "POST /api/payments/reconcile",
      body: { fix: false, hours: 48 },
    },
    checks_performed: [
      "Orphaned payments (completed but no registration)",
      "Duplicate payments (same email + amount within 5 minutes)",
      "Stale pending payments (pending > 30 minutes)",
    ],
  })
}
