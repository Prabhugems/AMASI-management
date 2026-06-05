#!/usr/bin/env node
import fs from "node:fs"
import { createClient } from "@supabase/supabase-js"

const env = {}
for (const line of fs.readFileSync("/Users/prabhubalasubramaniam/AMASI-management/.env.technosurg.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const EVENT_ID = "87c614b3-ff23-47c5-8682-87ea32aa77b9"

const { data: set } = await db.from("event_settings").select("*").eq("event_id", EVENT_ID).maybeSingle()
console.log("Full event_settings:")
console.log({
  customize_registration_id: set.customize_registration_id,
  registration_prefix: set.registration_prefix,
  registration_start_number: set.registration_start_number,
  registration_suffix: set.registration_suffix,
  current_registration_number: set.current_registration_number,
  faculty_registration_prefix: set.faculty_registration_prefix,
  faculty_registration_start_number: set.faculty_registration_start_number,
  current_faculty_registration_number: set.current_faculty_registration_number,
})

// Sample 10 non-faculty registrations
const { data: regs } = await db
  .from("registrations")
  .select("registration_number, attendee_name, created_at")
  .eq("event_id", EVENT_ID)
  .not("registration_number", "ilike", "TECH-F-%")
  .order("created_at", { ascending: false })
  .limit(15)
console.log("\nLast 15 NON-faculty registrations:")
for (const r of regs) console.log(`  ${r.registration_number} | ${r.attendee_name} | ${r.created_at}`)

// Count by reg number format
const { data: all } = await db
  .from("registrations")
  .select("registration_number")
  .eq("event_id", EVENT_ID)
const buckets = { faculty: 0, technosurg2026a: 0, reg: 0, other: 0 }
for (const r of all || []) {
  const n = r.registration_number || ""
  if (n.startsWith("TECH-F-")) buckets.faculty++
  else if (n.startsWith("Technosurg2026A")) buckets.technosurg2026a++
  else if (n.startsWith("REG-")) buckets.reg++
  else buckets.other++
}
console.log("\nRegistration number distribution:")
console.log(buckets)

// Ticket types
const { data: tickets } = await db
  .from("ticket_types")
  .select("id, name, price, status, quantity_total, quantity_sold")
  .eq("event_id", EVENT_ID)
console.log("\nTicket types:")
for (const t of tickets || []) console.log(`  ${t.id} | "${t.name}" | ₹${t.price} | status=${t.status} | ${t.quantity_sold}/${t.quantity_total}`)
