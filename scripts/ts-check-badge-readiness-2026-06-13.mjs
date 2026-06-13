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

const { data: regs } = await db
  .from("registrations")
  .select("id, registration_number, attendee_name, ticket_type_id, badge_generated_at, badge_template_id")
  .eq("event_id", EVENT_ID)
  .eq("status", "confirmed")

const FACULTY_TICKET_ID = "4c5b4c13-6847-4779-a161-3427c4a8f994"
const COMP_TICKET_ID = "a7a0b418-83a5-4b4d-b39b-1b2026eac52b"

const total = regs.length
const ready = regs.filter(r => r.badge_generated_at).length
const notReady = regs.filter(r => !r.badge_generated_at)

console.log(`Total confirmed regs: ${total}`)
console.log(`Badges ready: ${ready}`)
console.log(`Badges NOT ready: ${notReady.length}`)

const byTicket = {}
for (const r of notReady) {
  const key = r.ticket_type_id || "unknown"
  byTicket[key] = (byTicket[key] || 0) + 1
}
console.log(`\nBreakdown of NOT-ready by ticket_type_id:`)
for (const [k, v] of Object.entries(byTicket)) {
  const label = k === FACULTY_TICKET_ID ? "Faculty"
              : k === COMP_TICKET_ID ? "Complimentary Delegate"
              : k
  console.log(`  ${label}: ${v}`)
}

// All distinct ticket types in event
const { data: tts } = await db
  .from("ticket_types")
  .select("id, name")
  .eq("event_id", EVENT_ID)
console.log(`\nAll event ticket types:`)
for (const t of tts) console.log(`  ${t.id}  ${t.name}`)
