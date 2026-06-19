#!/usr/bin/env node
/**
 * One-off: refund the 2 duplicate paid-but-unlinked registrations for
 * Dr. A Selvarajakumar (TechnoSurg). Both UPI payments captured ₹12,000 each.
 * Uses the event's Razorpay credentials stored on events table.
 *
 * After successful refund:
 *  - payments.status -> 'refunded', refunded_at set, razorpay refund_id stored in metadata
 *  - registrations rows (status=pending) are DELETED so /my and /list are clean
 *
 * Use --apply to actually issue refunds. Default is dry-run.
 */
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import Razorpay from "razorpay"

const APPLY = process.argv.includes("--apply")

const env = {}
for (const line of fs.readFileSync(path.join(process.cwd(), ".env.technosurg.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const EVENT_ID = "87c614b3-ff23-47c5-8682-87ea32aa77b9"

const TARGETS = [
  {
    payment_id: "b16ae3c7-a2c5-4974-a7f6-92f923bc9c53",
    registration_id: "b128336a-3656-4a6d-be1e-8c21a43cd4fc",
    registration_number: "REG-20260618-IDE1HJF",
    razorpay_payment_id: "pay_T388TQxUOCQi3C",
    amount_inr: 12000,
  },
  {
    payment_id: "cab04e1e-f90d-4471-8668-90d1c48111ad",
    registration_id: "993b95e3-20e0-4a0b-af82-730a9e08b05f",
    registration_number: "REG-20260618-1QXQVQ5",
    razorpay_payment_id: "pay_T38V84PMpxRl4n",
    amount_inr: 12000,
  },
]

// 1. Pull event credentials
const { data: event, error: eErr } = await db
  .from("events")
  .select("name, razorpay_key_id, razorpay_key_secret")
  .eq("id", EVENT_ID)
  .single()
if (eErr || !event?.razorpay_key_id || !event?.razorpay_key_secret) {
  console.error("✗ event credentials not found:", eErr?.message)
  process.exit(1)
}
console.log(`Event: ${event.name}`)
console.log(`Razorpay key id: ${event.razorpay_key_id.slice(0, 12)}…`)

// 2. Verify each payment row + fetch payment from Razorpay for safety
const razorpay = new Razorpay({ key_id: event.razorpay_key_id, key_secret: event.razorpay_key_secret })

console.log(`\n--- ${APPLY ? "APPLYING REFUNDS" : "DRY RUN"} ---`)
const summary = { refunded: 0, skipped: 0, failed: 0 }

for (const t of TARGETS) {
  console.log(`\n→ ${t.registration_number}  (payment ${t.razorpay_payment_id})`)
  const { data: pay } = await db
    .from("payments")
    .select("id, status, amount, razorpay_payment_id, refunded_at")
    .eq("id", t.payment_id)
    .single()
  if (!pay) { console.log("  ✗ payment row missing"); summary.failed++; continue }
  if (pay.status === "refunded" || pay.refunded_at) {
    console.log(`  ⚠ already refunded — skip`)
    summary.skipped++
    continue
  }
  if (pay.razorpay_payment_id !== t.razorpay_payment_id) {
    console.log(`  ✗ payment_id mismatch: db=${pay.razorpay_payment_id} expected=${t.razorpay_payment_id}`)
    summary.failed++
    continue
  }
  // Fetch live payment to confirm captured + amount
  let rpPayment
  try {
    rpPayment = await razorpay.payments.fetch(t.razorpay_payment_id)
  } catch (e) {
    console.log("  ✗ razorpay fetch failed:", e.message)
    summary.failed++
    continue
  }
  console.log(`  · live status: ${rpPayment.status}  captured=${rpPayment.captured}  amount(paise)=${rpPayment.amount}  refunded(paise)=${rpPayment.amount_refunded || 0}`)
  if (rpPayment.status !== "captured" || rpPayment.captured !== true) {
    console.log(`  ✗ not in captured state — abort this one`)
    summary.failed++
    continue
  }
  if ((rpPayment.amount_refunded || 0) >= rpPayment.amount) {
    console.log(`  ⚠ already fully refunded at Razorpay`)
    summary.skipped++
    continue
  }
  const refundAmountPaise = rpPayment.amount - (rpPayment.amount_refunded || 0)
  console.log(`  · will refund ${refundAmountPaise/100} INR`)

  if (!APPLY) {
    console.log(`  (dry run — no refund issued)`)
    continue
  }

  // Issue refund
  let refund
  try {
    refund = await razorpay.payments.refund(t.razorpay_payment_id, {
      amount: refundAmountPaise,
      notes: {
        reason: "duplicate registration — user paid 3 times",
        registration_number: t.registration_number,
        triggered_by: "ops script ts-refund-selvarajakumar-2026-06-19",
      },
    })
  } catch (e) {
    console.log("  ✗ refund failed:", e.error?.description || e.message)
    summary.failed++
    continue
  }
  console.log(`  ✓ refund issued: ${refund.id}  status=${refund.status}`)

  // Update payment row
  const { error: upErr } = await db
    .from("payments")
    .update({
      status: "refunded",
      refunded_at: new Date().toISOString(),
      metadata: { ...((await db.from("payments").select("metadata").eq("id", t.payment_id).single()).data?.metadata || {}), refund: refund },
    })
    .eq("id", t.payment_id)
  if (upErr) console.log(`  ! db update failed: ${upErr.message}`)

  // Delete the unlinked registration row
  const { error: delErr } = await db
    .from("registrations")
    .delete()
    .eq("id", t.registration_id)
  if (delErr) console.log(`  ! reg delete failed: ${delErr.message}`)
  else console.log(`  ✓ registration ${t.registration_number} deleted`)

  summary.refunded++
}

console.log(`\nSUMMARY  refunded=${summary.refunded}  skipped=${summary.skipped}  failed=${summary.failed}`)
if (!APPLY) console.log("\n(dry run — re-run with --apply to actually refund)")
