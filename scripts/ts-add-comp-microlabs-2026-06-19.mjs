#!/usr/bin/env node
/**
 * Comp delegates from MicroLabs (Anwar list, 16 names).
 * Source: Bulk registration 1_micro.xls — names + 10-digit phones, no emails.
 *
 * Use --apply to commit. Default is dry-run.
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
const REG_PREFIX = "Technosurg2026A"
const INSTITUTION = "MicroLabs"

function properName(raw) {
  return String(raw)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(w => (w.length === 1 ? w.toUpperCase() + "." : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
}

const RAW = [
  ["S NAMBIRAJAN", "9444283370"],
  ["S MATHAN", "8903300932"],
  ["D CHANDER", "9600068693"],
  ["SARANYA", "8939761283"],
  ["SWARNA PRADHA", "6381439082"],
  ["VIGNESH", "9390356938"],
  ["SUNDARAJAN", "8778609822"],
  ["KARTHIK", "9884912017"],
  ["SATHISH", "7305209393"],
  ["C R ARAVIND", "8072943680"],
  ["ASHOK KUMAR", "9444319068"],
  ["BALAJI THENDARAJAN", "9003489858"],
  ["BHARANI", "9789978997"],
  ["GOWTHAM", "7200406307"],
  ["S SUGUMARAN", "9940303257"],
  ["ANUSHA", "9092276551"],
]

const ROWS = RAW.map(([name, phone]) => ({
  name: properName(name),
  phone: String(phone).replace(/\D/g, ""),
  institution: INSTITUTION,
  designation: null,
}))

function slugFromName(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "anon"
}
function placeholderEmail(name, phone) {
  return `${slugFromName(name)}-${phone || "x"}@noemail.local`
}
for (const r of ROWS) r.email = placeholderEmail(r.name, r.phone)

const { data: ticket } = await db
  .from("ticket_types")
  .select("id, name, price, quantity_sold")
  .eq("id", COMP_TICKET_ID)
  .maybeSingle()
console.log(`Ticket: ${ticket?.name}  sold=${ticket?.quantity_sold}`)

// Dup-check by phone
const phones = ROWS.map(r => r.phone)
const { data: dupRows } = await db
  .from("registrations")
  .select("attendee_phone, attendee_name, registration_number")
  .eq("event_id", EVENT_ID)
  .in("attendee_phone", phones)
const dupPhone = new Set((dupRows || []).map(d => d.attendee_phone))
if (dupPhone.size) {
  console.log("\nExisting registrations (will be skipped):")
  for (const d of dupRows) console.log(`  · ${d.attendee_phone}  ${d.attendee_name}  (${d.registration_number})`)
} else {
  console.log("\nNo existing registrations matched by phone.")
}

// Next reg number
const { data: maxRows } = await db
  .from("registrations")
  .select("registration_number")
  .eq("event_id", EVENT_ID)
  .ilike("registration_number", `${REG_PREFIX}%`)
  .order("registration_number", { ascending: false })
  .limit(1)
const maxN = maxRows?.[0]?.registration_number
  ? parseInt(maxRows[0].registration_number.slice(REG_PREFIX.length), 10) || 0
  : 0
console.log(`Current max ${REG_PREFIX}: ${maxN || "(none)"}  → next: ${maxN + 1}`)

let nextN = maxN
function nextRegNumber() {
  nextN += 1
  return `${REG_PREFIX}${nextN}`
}

console.log(`\n--- ${APPLY ? "APPLYING" : "DRY RUN"} ---`)
const results = { inserted: 0, skipped: 0, failed: 0 }
for (const c of ROWS) {
  if (dupPhone.has(c.phone)) {
    results.skipped++
    console.log(`  · skip dup: ${c.name}  ${c.phone}`)
    continue
  }
  if (!APPLY) {
    const reg = `${REG_PREFIX}${nextN + 1}`
    nextN += 1
    console.log(`  • would insert ${reg}  ${c.name.padEnd(22)}  ${c.phone}`)
    results.inserted++
    continue
  }
  const regNumber = nextRegNumber()
  const { error } = await db.from("registrations").insert({
    event_id: EVENT_ID,
    ticket_type_id: COMP_TICKET_ID,
    registration_number: regNumber,
    attendee_name: c.name,
    attendee_email: c.email,
    attendee_phone: c.phone,
    attendee_institution: c.institution,
    attendee_designation: c.designation,
    status: "confirmed",
    payment_status: "completed",
    quantity: 1,
    unit_price: 0,
    total_amount: 0,
  })
  if (error) {
    results.failed++
    nextN -= 1
    console.log(`  ✗ ${c.name}: ${error.message}`)
  } else {
    results.inserted++
    console.log(`  ✓ ${regNumber}  ${c.name}`)
  }
}

console.log(`\nSUMMARY  inserted=${results.inserted}  skipped=${results.skipped}  failed=${results.failed}`)
if (!APPLY) console.log("\n(dry run — re-run with --apply to insert)")
