#!/usr/bin/env node
import fs from "node:fs"
import { createClient } from "@supabase/supabase-js"

const env = {}
for (const line of fs.readFileSync("/Users/prabhubalasubramaniam/AMASI-management/.env.technosurg.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const EVENT_ID = "87c614b3-ff23-47c5-8682-87ea32aa77b9"

// All confirmed regs
const { data: regs } = await db
  .from("registrations")
  .select("id, registration_number, attendee_name, attendee_email, attendee_phone, ticket_type_id, created_at")
  .eq("event_id", EVENT_ID)
  .eq("status", "confirmed")
console.log(`Total confirmed regs: ${regs.length}`)

// All sent welcome email log entries (per registration_id)
const { data: emailLogs } = await db
  .from("message_logs")
  .select("registration_id")
  .eq("event_id", EVENT_ID)
  .eq("channel", "email")
  .eq("status", "sent")
const emailedIds = new Set((emailLogs || []).map(r => r.registration_id).filter(Boolean))
console.log(`Regs with at least 1 sent email log: ${emailedIds.size}`)

// All sent WhatsApp log entries
const { data: waLogs } = await db
  .from("message_logs")
  .select("registration_id")
  .eq("event_id", EVENT_ID)
  .eq("channel", "whatsapp")
  .eq("status", "sent")
const waIds = new Set((waLogs || []).map(r => r.registration_id).filter(Boolean))
console.log(`Regs with at least 1 sent WhatsApp log: ${waIds.size}`)

const missingEmail = regs.filter(r => !emailedIds.has(r.id))
const missingWA = regs.filter(r => !waIds.has(r.id) && r.attendee_phone)
const missingWAnoPhone = regs.filter(r => !waIds.has(r.id) && !r.attendee_phone)

console.log(`\nRegs missing email: ${missingEmail.length}`)
console.log(`Regs missing WhatsApp (has phone): ${missingWA.length}`)
console.log(`Regs missing WhatsApp (no phone, will skip): ${missingWAnoPhone.length}`)

console.log(`\n--- Missing email recipients ---`)
for (const r of missingEmail) {
  console.log(`  ${r.registration_number}  ${r.attendee_name}  <${r.attendee_email}>  created=${r.created_at.slice(0,10)}`)
}

console.log(`\n--- Missing WhatsApp recipients (has phone) ---`)
for (const r of missingWA) {
  console.log(`  ${r.registration_number}  ${r.attendee_name}  ${r.attendee_phone}  created=${r.created_at.slice(0,10)}`)
}
