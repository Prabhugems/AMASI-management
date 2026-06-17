#!/usr/bin/env node
/**
 * One-off: add complimentary delegates for TechnoSurg (batch 2026-06-17, 7 rows).
 * Source: ~/Downloads/DOC-20260615-WA0000..xlsx
 * - Comp delegate gets a REG-YYYYMMDD-XXXXXXX number on Complimentary Delegate ticket.
 * - Inserted as confirmed/completed with total_amount = 0.
 * - quantity_sold on ticket_types is auto-bumped by a DB trigger; do NOT bump it here.
 */
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const env = {}
for (const line of fs.readFileSync(path.join(process.cwd(), ".env.technosurg.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const EVENT_ID = "87c614b3-ff23-47c5-8682-87ea32aa77b9"
const COMP_TICKET_ID = "a7a0b418-83a5-4b4d-b39b-1b2026eac52b"

const ROWS = [
  { name: "Dr. Pravindhira S.N.",  phone: "8939891892", email: "drsnpravindhira@gmail.com" },
  { name: "Dr. Kishore.D",         phone: "9500131965", email: "kishoredr91@gmail.com" },
  { name: "Gopi Ramu",             phone: "7200492016", email: "gopikrish9974@gmail.com" },
  { name: "Archana H",             phone: "9626376605", email: "archanaharikrishnan1@gmail.com" },
  { name: "Irshad Ahamed S",       phone: "9629743229", email: "irshadahamed24@gmail.com" },
  { name: "Dr. Vijayan",           phone: "9841014406", email: "jvgovardhan2008@gmail.com" },
  { name: "Dr. Archit Pathak",     phone: "9560759228", email: "drarchitpathak@gmail.com" },
]

function makeCompRegNumber() {
  const d = new Date()
  const dateStr = d.getFullYear().toString() +
    (d.getMonth() + 1).toString().padStart(2, "0") +
    d.getDate().toString().padStart(2, "0")
  const random = Array.from({ length: 7 }, () =>
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 36)]
  ).join("")
  return `REG-${dateStr}-${random}`
}

function normalisePhone(v) {
  if (!v) return null
  return String(v).replace(/[^0-9]/g, "") || null
}

// --- Pre-flight: check duplicates in DB ---
const allEmails = ROWS.map(r => r.email.toLowerCase())
const { data: dupRows } = await db
  .from("registrations")
  .select("attendee_email")
  .eq("event_id", EVENT_ID)
  .in("attendee_email", allEmails)
const dupSet = new Set((dupRows || []).map(r => (r.attendee_email || "").toLowerCase()))
if (dupSet.size) {
  console.log("Found existing registrations — these will be skipped:")
  for (const e of dupSet) console.log(`  · ${e}`)
} else {
  console.log("No existing registrations in DB for any of these emails.")
}

// --- Insert ---
const results = { inserted: 0, skipped: 0, failed: 0 }
console.log("\n--- COMPLIMENTARY DELEGATES ---")
for (const c of ROWS) {
  const email = c.email.toLowerCase()
  if (dupSet.has(email)) {
    results.skipped++
    console.log(`  · skip duplicate: ${email}`)
    continue
  }
  const regNumber = makeCompRegNumber()
  const { error } = await db.from("registrations").insert({
    event_id: EVENT_ID,
    ticket_type_id: COMP_TICKET_ID,
    registration_number: regNumber,
    attendee_name: c.name,
    attendee_email: email,
    attendee_phone: normalisePhone(c.phone),
    status: "confirmed",
    payment_status: "completed",
    quantity: 1,
    unit_price: 0,
    total_amount: 0,
  })
  if (error) {
    results.failed++
    console.log(`  ✗ ${c.name} <${email}>: ${error.message}`)
  } else {
    results.inserted++
    console.log(`  ✓ ${regNumber}  ${c.name}  <${email}>`)
  }
}

console.log("\n--- SUMMARY ---")
console.log(`Comp del: inserted=${results.inserted}  skipped=${results.skipped}  failed=${results.failed}`)
