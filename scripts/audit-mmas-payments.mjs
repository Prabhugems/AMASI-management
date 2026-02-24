import { createClient } from "@supabase/supabase-js"
const supabase = createClient("https://jmdwxymbgxwdsmcwbahp.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptZHd4eW1iZ3h3ZHNtY3diYWhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzAxMTA1NSwiZXhwIjoyMDgyNTg3MDU1fQ.rvk94RhIk7lcDonsR_dWdPL7rEzmn91tdXLChDg9b4Y")

const EVENT_ID = "8db2c778-c96d-46da-ac20-00604e764853"

async function main() {
  // Get all registrations
  const { data: regs } = await supabase
    .from("registrations")
    .select("registration_number,attendee_name,attendee_email,total_amount,status,payment_status,payment_id,ticket_type_id")
    .eq("event_id", EVENT_ID)
    .order("created_at")

  // Get all payments
  const { data: payments } = await supabase
    .from("payments")
    .select("id,payment_number,payer_name,payer_email,amount,status,razorpay_order_id,razorpay_payment_id,payment_method")
    .eq("event_id", EVENT_ID)
    .order("created_at")

  const tickets = {
    "81082d07-587a-4026-877e-d6e2bc7c820f": "MMAS Exam",
    "10edfd97-ad1b-439a-bda9-eee7a59862a6": "Hernia Course",
    "02a67d44-e0bc-442e-9f7c-0bee7e51ae4f": "Faculty/Speaker"
  }

  console.log(`=== MMAS Payment Audit ===\n`)
  console.log(`Total registrations: ${regs.length}`)
  console.log(`Total payment records: ${payments.length}\n`)

  // By ticket type
  const byTicket = {}
  for (const r of regs) {
    const t = tickets[r.ticket_type_id] || "Unknown"
    byTicket[t] = byTicket[t] || []
    byTicket[t].push(r)
  }
  for (const [ticket, items] of Object.entries(byTicket)) {
    const confirmed = items.filter(r => r.status === "confirmed").length
    const noPay = items.filter(r => !r.payment_id).length
    const revenue = items.filter(r => r.status === "confirmed").reduce((s, r) => s + (r.total_amount || 0), 0)
    console.log(`  ${ticket}: ${items.length} regs (${confirmed} confirmed, ${noPay} without payment record) Revenue: ₹${revenue.toLocaleString()}`)
  }

  // Registrations without payment_id
  const noPay = regs.filter(r => !r.payment_id)
  if (noPay.length) {
    console.log(`\n⚠ ${noPay.length} registrations WITHOUT payment_id:`)
    for (const r of noPay.slice(0, 15)) {
      const t = tickets[r.ticket_type_id] || "?"
      console.log(`  ${r.registration_number.padEnd(15)} ${r.attendee_name.padEnd(25)} ${t.padEnd(15)} ₹${(r.total_amount||0).toLocaleString().padStart(8)} status=${r.status} pay_status=${r.payment_status}`)
    }
    if (noPay.length > 15) console.log(`  ... and ${noPay.length - 15} more`)
  }

  // Registrations with issues
  const issues = regs.filter(r => r.status !== "confirmed" || (r.payment_status !== "completed" && r.total_amount > 0))
  if (issues.length) {
    console.log(`\n⚠ ${issues.length} registrations with issues:`)
    for (const r of issues.slice(0, 15)) {
      console.log(`  ${r.registration_number.padEnd(15)} ${r.attendee_name.padEnd(25)} status=${r.status} payment=${r.payment_status} ₹${(r.total_amount||0).toLocaleString()}`)
    }
  } else {
    console.log(`\n✓ All paid registrations are confirmed`)
  }

  // Pending/failed payments
  const badPayments = payments.filter(p => p.status !== "completed")
  if (badPayments.length) {
    console.log(`\n⚠ ${badPayments.length} incomplete payment records:`)
    for (const p of badPayments) {
      console.log(`  ${p.payment_number.padEnd(20)} ${p.payer_name.padEnd(25)} ₹${p.amount.toLocaleString().padStart(8)} status=${p.status} rzp_order=${p.razorpay_order_id || "none"} rzp_pay=${p.razorpay_payment_id || "none"}`)
    }
  }

  // Payments without matching registration
  const regPayIds = new Set(regs.map(r => r.payment_id).filter(Boolean))
  const orphanPayments = payments.filter(p => !regPayIds.has(p.id))
  if (orphanPayments.length) {
    console.log(`\n⚠ ${orphanPayments.length} orphan payments (no matching registration):`)
    for (const p of orphanPayments) {
      console.log(`  ${p.payment_number.padEnd(20)} ${p.payer_name.padEnd(25)} ₹${p.amount.toLocaleString().padStart(8)} status=${p.status}`)
    }
  }

  console.log(`\n=== Summary ===`)
  const totalRevenue = regs.filter(r => r.status === "confirmed").reduce((s, r) => s + (r.total_amount || 0), 0)
  const completedPayments = payments.filter(p => p.status === "completed").reduce((s, p) => s + p.amount, 0)
  console.log(`Expected revenue (from confirmed regs): ₹${totalRevenue.toLocaleString()}`)
  console.log(`Completed payments total: ₹${completedPayments.toLocaleString()}`)
  if (totalRevenue !== completedPayments) {
    console.log(`⚠ MISMATCH: ₹${Math.abs(totalRevenue - completedPayments).toLocaleString()} difference`)
  }
}
main()
