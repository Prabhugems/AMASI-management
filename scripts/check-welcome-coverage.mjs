#!/usr/bin/env node
import fs from "node:fs"
import { createClient } from "@supabase/supabase-js"

const env = {}
for (const line of fs.readFileSync(
  "/Users/prabhubalasubramaniam/AMASI-management/.env.technosurg.local",
  "utf8"
).split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const EVENT_ID = "87c614b3-ff23-47c5-8682-87ea32aa77b9"
const TEMPLATE = "technosurg_welcome"

// Pull ALL registrations (delegates + faculty)
const { data: regs } = await db
  .from("registrations")
  .select("id, registration_number, attendee_name, attendee_email, attendee_phone, status, ticket_type:ticket_types(name)")
  .eq("event_id", EVENT_ID)

console.log(`All registrations: ${regs.length}`)

// Bucket by status + phone presence
const stats = { confirmed: 0, otherStatus: 0, noPhone: 0, byTicket: {} }
for (const r of regs) {
  if (r.status !== "confirmed") {
    stats.otherStatus++
    continue
  }
  if (!r.attendee_phone) {
    stats.noPhone++
  }
  stats.confirmed++
  const t = r.ticket_type?.name || "(no ticket)"
  stats.byTicket[t] = (stats.byTicket[t] || 0) + 1
}
console.log(`  Confirmed: ${stats.confirmed}`)
console.log(`  Other status: ${stats.otherStatus}`)
console.log(`  Confirmed but missing phone: ${stats.noPhone}`)
console.log(`  By ticket type:`, stats.byTicket)

// Cross-reference message_logs to find who already received technosurg_welcome
const regIds = regs.filter((r) => r.status === "confirmed" && r.attendee_phone).map((r) => r.id)
const { data: logs } = await db
  .from("message_logs")
  .select("registration_id, status")
  .eq("event_id", EVENT_ID)
  .eq("channel", "whatsapp")
  .ilike("message_body", `%${TEMPLATE}%`)
  .in("registration_id", regIds)

const alreadySent = new Set((logs || []).filter((l) => l.status === "sent").map((l) => l.registration_id))
const alreadyFailed = new Set((logs || []).filter((l) => l.status !== "sent").map((l) => l.registration_id))

console.log(`\nAlready sent ${TEMPLATE} successfully: ${alreadySent.size}`)
console.log(`Attempted but failed: ${alreadyFailed.size - new Set([...alreadyFailed].filter((id) => alreadySent.has(id))).size}`)

const eligibleNew = regIds.filter((id) => !alreadySent.has(id))
console.log(`\n=> Would send NEW messages to: ${eligibleNew.length} delegates`)
console.log(`   (already sent: ${alreadySent.size}; no phone: ${stats.noPhone}; non-confirmed: ${stats.otherStatus})`)
