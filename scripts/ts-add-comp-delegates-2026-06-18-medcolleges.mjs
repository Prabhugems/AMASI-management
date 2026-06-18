#!/usr/bin/env node
/**
 * One-off: add complimentary delegates for TechnoSurg (med college HODs + Sathish).
 * Source: chat message 2026-06-18.
 * - No emails in source → placeholder; WhatsApp will reach them.
 * - All phones normalised to 10 digits.
 * - Dr. prefix is dropped from stored name (welcome template adds "Dear Dr." itself).
 *
 * Use --apply to actually insert. Default is dry-run.
 */
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

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
const COMP_TICKET_ID = "a7a0b418-83a5-4b4d-b39b-1b2026eac52b"

const ROWS = [
  // MMC (Madras Medical College)
  { name: "C. Sugumar",       phone: "9840532487", institution: "MMC", role: "Director" },
  { name: "T. Selvaraj",      phone: "9840123497", institution: "MMC", role: "Professor" },
  { name: "UP Srinivasan",    phone: "9443657670", institution: "MMC", role: "Associate Professor" },
  // Stanley
  { name: "Jeswanth",         phone: "9444357682", institution: "Stanley", role: "Director (retired)" },
  { name: "L. Anand",         phone: "9500034959", institution: "Stanley", role: "Professor" },
  { name: "P. Senthil Kumar", phone: "9942520654", institution: "Stanley", role: "Associate Professor" },
  // KMC (Kilpauk)
  { name: "Prabhakaran",      phone: "9360301535", institution: "KMC", role: "Professor" },
  // Guindy
  { name: "Amudhan",          phone: "9841229807", institution: "Guindy", role: "Associate Professor" },
  // SGE Stanley
  { name: "Sathish Devakumar",phone: "9994324214", institution: "SGE Stanley", role: null },
]

function slugFromName(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "anon"
}
function placeholderEmail(name, phone) {
  return `${slugFromName(name)}-${phone || "x"}@noemail.local`
}
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

// Attach computed email
for (const r of ROWS) r.email = placeholderEmail(r.name, r.phone)

const { data: ticket } = await db
  .from("ticket_types")
  .select("id, name, price, quantity_sold")
  .eq("id", COMP_TICKET_ID)
  .maybeSingle()
console.log(`Ticket: ${ticket?.name} (sold ${ticket?.quantity_sold})`)

// Pre-flight: existing by phone (since these are placeholder emails)
const phones = ROWS.map(r => r.phone)
const { data: dups } = await db
  .from("registrations")
  .select("attendee_phone, attendee_name, registration_number")
  .eq("event_id", EVENT_ID)
  .in("attendee_phone", phones)
const dupPhone = new Set((dups || []).map(d => d.attendee_phone))
if (dupPhone.size) {
  console.log("\nExisting registrations (will be skipped):")
  for (const d of dups) console.log(`  · ${d.attendee_phone}  ${d.attendee_name}  (${d.registration_number})`)
} else {
  console.log("\nNo existing registrations matched by phone.")
}

console.log(`\n--- ${APPLY ? "APPLYING" : "DRY RUN"} ---`)
const results = { inserted: 0, skipped: 0, failed: 0 }
for (const c of ROWS) {
  if (dupPhone.has(c.phone)) {
    results.skipped++
    console.log(`  · skip dup: ${c.name}  ${c.phone}  [${c.institution}]`)
    continue
  }
  if (!APPLY) {
    console.log(`  • would insert: ${c.name.padEnd(20)}  ${c.phone}  [${c.institution}]${c.role ? "  — " + c.role : ""}`)
    results.inserted++
    continue
  }
  const regNumber = makeCompRegNumber()
  const { error } = await db.from("registrations").insert({
    event_id: EVENT_ID,
    ticket_type_id: COMP_TICKET_ID,
    registration_number: regNumber,
    attendee_name: c.name,
    attendee_email: c.email,
    attendee_phone: c.phone,
    attendee_institution: c.institution,
    attendee_designation: c.role,
    status: "confirmed",
    payment_status: "completed",
    quantity: 1,
    unit_price: 0,
    total_amount: 0,
  })
  if (error) {
    results.failed++
    console.log(`  ✗ ${c.name}: ${error.message}`)
  } else {
    results.inserted++
    console.log(`  ✓ ${regNumber}  ${c.name}  [${c.institution}]`)
  }
}

console.log(`\nSUMMARY  inserted=${results.inserted}  skipped=${results.skipped}  failed=${results.failed}`)
if (!APPLY) console.log("\n(dry run — re-run with --apply to actually insert)")
