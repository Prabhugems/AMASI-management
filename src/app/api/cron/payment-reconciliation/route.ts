import { createAdminClient } from "@/lib/supabase/server"
import { getNextRegistrationNumber } from "@/lib/services/registration-number"
import { sendPaymentAlert } from "@/lib/services/payment-alerts"
import { NextRequest, NextResponse } from "next/server"

// Razorpay API base
const RAZORPAY_API = "https://api.razorpay.com/v1"

interface RazorpayPaymentItem {
  id: string
  entity: string
  amount: number
  currency: string
  status: string
  order_id: string
  method: string
  email: string
  contact: string
  notes: Record<string, string>
  created_at: number
  captured_at?: number
  description?: string
}

interface ReconciliationSummary {
  razorpay_payments_fetched: number
  missing_in_db: number
  auto_created: number
  orphans_logged: number
  pending_updated: number
  already_synced: number
  errors: string[]
  details: {
    type: string
    razorpay_payment_id: string
    amount: number
    email?: string
    event_id?: string
    action: string
  }[]
}

/**
 * Fetch captured payments from Razorpay for a given key pair within the last N hours.
 * Uses the Razorpay Payments API with basic auth.
 */
async function fetchRazorpayPayments(
  keyId: string,
  keySecret: string,
  fromTimestamp: number,
  toTimestamp: number,
): Promise<RazorpayPaymentItem[]> {
  const allPayments: RazorpayPaymentItem[] = []
  let skip = 0
  const count = 100

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64")

  while (true) {
    const url = `${RAZORPAY_API}/payments?from=${fromTimestamp}&to=${toTimestamp}&count=${count}&skip=${skip}`
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Razorpay API error ${res.status}: ${errText}`)
    }

    const data = await res.json()
    const items: RazorpayPaymentItem[] = data.items || []

    // Only include captured payments
    const captured = items.filter((p) => p.status === "captured")
    allPayments.push(...captured)

    if (items.length < count) break
    skip += count

    // Safety: don't fetch more than 1000 payments in one run
    if (skip >= 1000) break
  }

  return allPayments
}

/**
 * GET /api/cron/payment-reconciliation
 *
 * Cron job that runs every 6 hours to reconcile Razorpay payments with our database.
 *
 * 1. Fetches all captured payments from Razorpay (last 24 hours)
 * 2. Compares with our payments table - finds any missing from our DB
 * 3. For missing ones with event_id in notes, auto-creates payment + registration
 * 4. For missing ones without event_id, logs them as orphans
 * 5. Updates "pending" payments in our DB that are actually captured on Razorpay
 * 6. Returns a summary
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel cron sends Authorization header)
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET?.trim()

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const summary: ReconciliationSummary = {
    razorpay_payments_fetched: 0,
    missing_in_db: 0,
    auto_created: 0,
    orphans_logged: 0,
    pending_updated: 0,
    already_synced: 0,
    errors: [],
    details: [],
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createAdminClient()) as any

    // Time window: last 24 hours
    const now = Math.floor(Date.now() / 1000)
    const fromTimestamp = now - 24 * 60 * 60

    // ================================================================
    // STEP 0: Gather all Razorpay credential sets (default + per-event)
    // ================================================================
    const defaultKeyId = process.env.RAZORPAY_KEY_ID?.trim()
    const defaultKeySecret = process.env.RAZORPAY_KEY_SECRET?.trim()

    if (!defaultKeyId || !defaultKeySecret) {
      return NextResponse.json(
        { error: "Razorpay credentials not configured" },
        { status: 500 },
      )
    }

    // Collect credential sets: default + any event-specific ones
    const credentialSets: { keyId: string; keySecret: string; label: string }[] = [
      { keyId: defaultKeyId, keySecret: defaultKeySecret, label: "default" },
    ]

    // Find events with their own Razorpay credentials
    const { data: eventsWithCreds } = await supabase
      .from("events")
      .select("id, name, razorpay_key_id, razorpay_key_secret")
      .not("razorpay_key_id", "is", null)
      .not("razorpay_key_secret", "is", null)

    if (eventsWithCreds) {
      for (const evt of eventsWithCreds) {
        // Skip if same as default
        if (evt.razorpay_key_id === defaultKeyId) continue
        credentialSets.push({
          keyId: evt.razorpay_key_id,
          keySecret: evt.razorpay_key_secret,
          label: `event:${evt.name}`,
        })
      }
    }

    // ================================================================
    // STEP 1: Fetch all captured payments from Razorpay
    // ================================================================
    const allRazorpayPayments: RazorpayPaymentItem[] = []
    const seenPaymentIds = new Set<string>()

    for (const creds of credentialSets) {
      try {
        const payments = await fetchRazorpayPayments(
          creds.keyId,
          creds.keySecret,
          fromTimestamp,
          now,
        )
        for (const p of payments) {
          if (!seenPaymentIds.has(p.id)) {
            seenPaymentIds.add(p.id)
            allRazorpayPayments.push(p)
          }
        }
        console.log(
          `[RECON] Fetched ${payments.length} captured payments from Razorpay (${creds.label})`,
        )
      } catch (err: any) {
        const msg = `Failed to fetch from Razorpay (${creds.label}): ${err.message}`
        console.error(`[RECON] ${msg}`)
        summary.errors.push(msg)
      }
    }

    summary.razorpay_payments_fetched = allRazorpayPayments.length

    if (allRazorpayPayments.length === 0) {
      return NextResponse.json({
        message: "Payment reconciliation completed - no payments found in window",
        summary,
        timestamp: new Date().toISOString(),
      })
    }

    // ================================================================
    // STEP 2: Check which Razorpay payments exist in our DB
    // ================================================================
    // Batch lookup: get all razorpay_payment_ids we already have
    const razorpayPaymentIds = allRazorpayPayments.map((p) => p.id)

    // Query in batches of 100 to avoid query size limits
    const existingPaymentIds = new Set<string>()
    const pendingPayments: { id: string; razorpay_payment_id: string; razorpay_order_id: string }[] = []

    for (let i = 0; i < razorpayPaymentIds.length; i += 100) {
      const batch = razorpayPaymentIds.slice(i, i + 100)

      const { data: existingByPaymentId } = await supabase
        .from("payments")
        .select("id, razorpay_payment_id, razorpay_order_id, status")
        .in("razorpay_payment_id", batch)

      if (existingByPaymentId) {
        for (const p of existingByPaymentId) {
          existingPaymentIds.add(p.razorpay_payment_id)
        }
      }
    }

    // Also look up by order_id for payments that might not have payment_id set yet
    const razorpayOrderIds = allRazorpayPayments
      .filter((p) => p.order_id && !existingPaymentIds.has(p.id))
      .map((p) => p.order_id)

    if (razorpayOrderIds.length > 0) {
      for (let i = 0; i < razorpayOrderIds.length; i += 100) {
        const batch = razorpayOrderIds.slice(i, i + 100)

        const { data: existingByOrderId } = await supabase
          .from("payments")
          .select("id, razorpay_payment_id, razorpay_order_id, status")
          .in("razorpay_order_id", batch)

        if (existingByOrderId) {
          for (const p of existingByOrderId) {
            // Find the corresponding Razorpay payment
            const rzpPayment = allRazorpayPayments.find(
              (rp) => rp.order_id === p.razorpay_order_id,
            )
            if (rzpPayment) {
              existingPaymentIds.add(rzpPayment.id)

              // Track pending payments that need updating (Step 5)
              if (p.status === "pending") {
                pendingPayments.push({
                  id: p.id,
                  razorpay_payment_id: rzpPayment.id,
                  razorpay_order_id: p.razorpay_order_id,
                })
              }
            }
          }
        }
      }
    }

    // ================================================================
    // STEP 3 & 4: Process missing payments
    // ================================================================
    const missingPayments = allRazorpayPayments.filter(
      (p) => !existingPaymentIds.has(p.id),
    )
    summary.missing_in_db = missingPayments.length
    summary.already_synced = allRazorpayPayments.length - missingPayments.length

    for (const rzpPayment of missingPayments) {
      const eventId = rzpPayment.notes?.event_id || null
      const payerEmail = rzpPayment.email || rzpPayment.notes?.payer_email || null
      const payerName = rzpPayment.notes?.payer_name || rzpPayment.notes?.name || "Unknown"
      const payerPhone = rzpPayment.contact?.replace("+", "").replace(/^91/, "") || null
      const amount = rzpPayment.amount / 100 // Convert paise to rupees

      if (eventId && payerEmail) {
        // ---- STEP 3: Has event_id - auto-create payment + registration ----
        try {
          // Check if a registration already exists for this email+event
          const { data: existingReg } = await supabase
            .from("registrations")
            .select("id")
            .eq("attendee_email", payerEmail)
            .eq("event_id", eventId)
            .in("status", ["confirmed", "pending"])
            .maybeSingle()

          if (existingReg) {
            // Registration exists, just ensure payment record is created
            summary.details.push({
              type: "existing_registration",
              razorpay_payment_id: rzpPayment.id,
              amount,
              email: payerEmail,
              event_id: eventId,
              action: "skipped - registration already exists",
            })
            summary.already_synced++
            summary.missing_in_db--
            continue
          }

          // Create payment record
          const paymentNumber = `RECON-${Date.now().toString(36).toUpperCase()}`
          const { data: newPayment, error: paymentError } = await supabase
            .from("payments")
            .insert({
              payment_number: paymentNumber,
              payment_type: "registration",
              payment_method: "razorpay",
              payer_name: payerName,
              payer_email: payerEmail,
              payer_phone: payerPhone,
              amount,
              currency: rzpPayment.currency || "INR",
              net_amount: amount,
              razorpay_order_id: rzpPayment.order_id,
              razorpay_payment_id: rzpPayment.id,
              status: "completed",
              completed_at: new Date(rzpPayment.created_at * 1000).toISOString(),
              event_id: eventId,
              metadata: {
                is_reconciled: true,
                created_from_cron_reconciliation: true,
                razorpay_notes: rzpPayment.notes,
                razorpay_method: rzpPayment.method,
              },
            } as any)
            .select("id")
            .single()

          if (paymentError) {
            summary.errors.push(
              `Failed to create payment for ${rzpPayment.id}: ${paymentError.message}`,
            )
            continue
          }

          // Find a suitable ticket type
          const { data: tickets } = await supabase
            .from("ticket_types")
            .select("id, price")
            .eq("event_id", eventId)
            .eq("status", "active")
            .order("price", { ascending: false })

          const matchedTicket =
            tickets?.find((t: any) => Math.abs(t.price - amount) < 200) ||
            tickets?.[0]

          if (matchedTicket) {
            const regNumber = await getNextRegistrationNumber(supabase, eventId)

            await supabase.from("registrations").insert({
              event_id: eventId,
              ticket_type_id: matchedTicket.id,
              registration_number: regNumber,
              attendee_name: payerName,
              attendee_email: payerEmail,
              attendee_phone: payerPhone,
              unit_price: amount,
              total_amount: amount,
              status: "confirmed",
              payment_status: "completed",
              payment_id: newPayment.id,
              confirmed_at: new Date().toISOString(),
              custom_fields: {
                auto_created: true,
                created_from_cron_reconciliation: true,
                needs_admin_review: true,
              },
            } as any)

            console.log(
              `[RECON] Auto-created payment + registration ${regNumber} for ${payerEmail} (${rzpPayment.id})`,
            )
          }

          // Send admin alert for missing registration auto-created
          sendPaymentAlert("registration_missing", {
            delegateName: payerName,
            delegateEmail: payerEmail,
            amount,
            currency: rzpPayment.currency || "INR",
            razorpayPaymentId: rzpPayment.id,
            razorpayOrderId: rzpPayment.order_id,
            eventId,
            notes: "Payment found on Razorpay but missing from database. Auto-created payment and registration during reconciliation.",
          }).catch(console.error)

          summary.auto_created++
          summary.details.push({
            type: "auto_created",
            razorpay_payment_id: rzpPayment.id,
            amount,
            email: payerEmail,
            event_id: eventId,
            action: "created payment + registration",
          })
        } catch (err: any) {
          summary.errors.push(
            `Error processing ${rzpPayment.id}: ${err.message}`,
          )
        }
      } else {
        // ---- STEP 4: No event_id - log as orphan ----
        console.log(
          `[RECON] Orphan payment: ${rzpPayment.id} (${payerEmail || "no email"}, amount: ${amount}) - no event_id in notes`,
        )

        // Create a minimal payment record so it's tracked
        try {
          await supabase.from("payments").insert({
            payment_number: `ORPHAN-RECON-${Date.now().toString(36).toUpperCase()}`,
            payment_type: "registration",
            payment_method: "razorpay",
            payer_name: payerName,
            payer_email: payerEmail || "unknown@unknown.com",
            payer_phone: payerPhone,
            amount,
            currency: rzpPayment.currency || "INR",
            net_amount: amount,
            razorpay_order_id: rzpPayment.order_id,
            razorpay_payment_id: rzpPayment.id,
            status: "completed",
            completed_at: new Date(rzpPayment.created_at * 1000).toISOString(),
            event_id: null,
            metadata: {
              is_orphan: true,
              needs_manual_review: true,
              created_from_cron_reconciliation: true,
              razorpay_notes: rzpPayment.notes,
              razorpay_method: rzpPayment.method,
            },
          } as any)
        } catch {
          // Might fail on unique constraint if already tracked - that's fine
        }

        // Try to log an alert
        try {
          await supabase.from("payment_alerts").insert({
            payment_id: null,
            alert_type: "orphan_reconciliation",
            message: `Razorpay payment ${rzpPayment.id} (${amount} ${rzpPayment.currency}) has no event_id. Email: ${payerEmail || "none"}. Needs manual review.`,
            severity: "medium",
            status: "pending",
            created_at: new Date().toISOString(),
          } as any)
        } catch {
          // payment_alerts table might not exist
        }

        // Send admin alert for orphan payment
        sendPaymentAlert("orphan_payment", {
          delegateName: payerName,
          delegateEmail: payerEmail || undefined,
          amount,
          currency: rzpPayment.currency || "INR",
          razorpayPaymentId: rzpPayment.id,
          razorpayOrderId: rzpPayment.order_id,
          notes: "Found during reconciliation. No event_id in payment notes.",
        }).catch(console.error)

        summary.orphans_logged++
        summary.details.push({
          type: "orphan",
          razorpay_payment_id: rzpPayment.id,
          amount,
          email: payerEmail || undefined,
          action: "logged for manual review - no event_id",
        })
      }
    }

    // ================================================================
    // STEP 5: Update pending payments that are actually captured
    // ================================================================
    for (const pending of pendingPayments) {
      try {
        const { error: updateError } = await supabase
          .from("payments")
          .update({
            status: "completed",
            razorpay_payment_id: pending.razorpay_payment_id,
            completed_at: new Date().toISOString(),
            metadata: {
              updated_by_cron_reconciliation: true,
              reconciled_at: new Date().toISOString(),
            },
          } as any)
          .eq("id", pending.id)
          .eq("status", "pending") // Only update if still pending

        if (!updateError) {
          // Also update any linked registrations
          await supabase
            .from("registrations")
            .update({
              status: "confirmed",
              payment_status: "completed",
              confirmed_at: new Date().toISOString(),
            })
            .eq("payment_id", pending.id)
            .eq("status", "pending")

          summary.pending_updated++
          summary.details.push({
            type: "pending_updated",
            razorpay_payment_id: pending.razorpay_payment_id,
            amount: 0,
            action: "updated pending -> completed (captured on Razorpay)",
          })

          console.log(
            `[RECON] Updated pending payment ${pending.id} to completed (Razorpay: ${pending.razorpay_payment_id})`,
          )
        }
      } catch (err: any) {
        summary.errors.push(
          `Failed to update pending payment ${pending.id}: ${err.message}`,
        )
      }
    }

    // Also check for pending payments in our DB that might not have been in the batch above
    // (e.g., payments older than 24h that are still pending but were captured long ago)
    const { data: stalePending } = await supabase
      .from("payments")
      .select("id, razorpay_payment_id, razorpay_order_id")
      .eq("status", "pending")
      .eq("payment_method", "razorpay")
      .not("razorpay_payment_id", "is", null)

    if (stalePending && stalePending.length > 0) {
      for (const stale of stalePending) {
        // Already processed above
        if (pendingPayments.some((p) => p.id === stale.id)) continue

        try {
          // Check this payment directly on Razorpay
          const auth = Buffer.from(`${defaultKeyId}:${defaultKeySecret}`).toString("base64")
          const res = await fetch(`${RAZORPAY_API}/payments/${stale.razorpay_payment_id}`, {
            headers: { Authorization: `Basic ${auth}` },
          })

          if (res.ok) {
            const rzpData = await res.json()

            if (rzpData.status === "captured") {
              await supabase
                .from("payments")
                .update({
                  status: "completed",
                  completed_at: new Date().toISOString(),
                  metadata: {
                    updated_by_cron_reconciliation: true,
                    reconciled_at: new Date().toISOString(),
                    was_stale_pending: true,
                  },
                } as any)
                .eq("id", stale.id)
                .eq("status", "pending")

              await supabase
                .from("registrations")
                .update({
                  status: "confirmed",
                  payment_status: "completed",
                  confirmed_at: new Date().toISOString(),
                })
                .eq("payment_id", stale.id)
                .eq("status", "pending")

              summary.pending_updated++
              summary.details.push({
                type: "stale_pending_updated",
                razorpay_payment_id: stale.razorpay_payment_id,
                amount: 0,
                action: "stale pending payment updated -> completed",
              })

              console.log(
                `[RECON] Fixed stale pending payment ${stale.id} (captured on Razorpay)`,
              )
            }
          }
        } catch (err: any) {
          // Non-critical - just skip
          console.error(`[RECON] Error checking stale payment ${stale.id}: ${err.message}`)
        }
      }
    }

    console.log("[RECON] Reconciliation completed:", JSON.stringify(summary, null, 2))

    return NextResponse.json({
      message: "Payment reconciliation completed",
      summary: {
        razorpay_payments_fetched: summary.razorpay_payments_fetched,
        already_synced: summary.already_synced,
        missing_in_db: summary.missing_in_db,
        auto_created: summary.auto_created,
        orphans_logged: summary.orphans_logged,
        pending_updated: summary.pending_updated,
        errors_count: summary.errors.length,
      },
      details: summary.details,
      errors: summary.errors.length > 0 ? summary.errors : undefined,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("[RECON] Payment reconciliation error:", error)
    return NextResponse.json(
      { error: "Payment reconciliation failed", message: error.message },
      { status: 500 },
    )
  }
}
