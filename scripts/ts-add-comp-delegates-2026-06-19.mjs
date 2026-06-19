#!/usr/bin/env node
/**
 * One-off: add complimentary delegates for TechnoSurg.
 * Source: WhatsApp messages from Dr. Sibi, 2026-06-18.
 * - Skipped: S. Manikannan (already Technosurg2026A1032), G.M. Jagadesan (no contact info).
 * - Dr. prefix dropped from stored name (welcome template adds "Dear Dr.").
 * - Phones normalised to 10 digits.
 * - Reg number format: Technosurg2026A#### computed from current max (event_settings counter is stale).
 *
 * Use --apply to insert. Default is dry-run.
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

const ROWS = [
  {
    name: "M. Pragadheeswaran",
    phone: "8122880052",
    email: "pragadheesh2805@gmail.com",
    institution: "Stanley Medical College",
    designation: "MCh Final Year Surgical Gastroenterology",
  },
  {
    name: "R. Mythra Bhavini",
    phone: "9003284088",
    email: null,
    institution: null,
    designation: "Assistant Professor",
  },
  {
    name: "Nevetha",
    phone: "9790407977",
    email: null,
    institution: null,
    designation: "Assistant Professor",
  },
  {
    name: "Deepika",
    phone: null,
    email: "drdeepi.84@gmail.com",
    institution: null,
    designation: null,
  },
  {
    name: "Abarna P M",
    phone: "9597692001",
    email: "abarnapm1181@gmail.com",
    institution: null,
    designation: null,
  },
  {
    name: "Shalini K",
    phone: "8428779788",
    email: "shalinivishwanathan1012@gmail.com",
    institution: null,
    designation: null,
  },
  {
    name: "Suresh A",
    phone: "9842271007",
    email: null,
    institution: null,
    designation: null,
  },
]

function slugFromName(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "anon"
}
function placeholderEmail(name, phone) {
  return `${slugFromName(name)}-${phone || "x"}@noemail.local`
}

// Attach computed email where missing
for (const r of ROWS) {
  if (!r.email) r.email = placeholderEmail(r.name, r.phone)
}

const { data: ticket } = await db
  .from("ticket_types")
  .select("id, name, price, quantity_sold")
  .eq("id", COMP_TICKET_ID)
  .maybeSingle()
console.log(`Ticket: ${ticket?.name}  price=${ticket?.price}  sold=${ticket?.quantity_sold}`)

// Pre-flight dup check by phone AND email
const phones = ROWS.map(r => r.phone).filter(Boolean)
const emails = ROWS.map(r => r.email).filter(Boolean)

const { data: dupsByPhone } = await db
  .from("registrations")
  .select("attendee_phone, attendee_email, attendee_name, registration_number")
  .eq("event_id", EVENT_ID)
  .in("attendee_phone", phones)
const { data: dupsByEmail } = await db
  .from("registrations")
  .select("attendee_phone, attendee_email, attendee_name, registration_number")
  .eq("event_id", EVENT_ID)
  .in("attendee_email", emails)

const dupPhone = new Set((dupsByPhone || []).map(d => d.attendee_phone))
const dupEmail = new Set((dupsByEmail || []).map(d => (d.attendee_email || "").toLowerCase()))

const allDups = [...(dupsByPhone || []), ...(dupsByEmail || [])]
if (allDups.length) {
  console.log("\nExisting registrations matched:")
  const seen = new Set()
  for (const d of allDups) {
    const key = d.registration_number
    if (seen.has(key)) continue
    seen.add(key)
    console.log(`  · ${d.registration_number}  ${d.attendee_name}  ph=${d.attendee_phone}  em=${d.attendee_email}`)
  }
} else {
  console.log("\nNo existing registrations matched.")
}

// Compute next reg number from max
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
console.log(`\nCurrent max ${REG_PREFIX}: ${maxN || "(none)"}  → next: ${maxN + 1}`)

let nextN = maxN
function nextRegNumber() {
  nextN += 1
  return `${REG_PREFIX}${nextN}`
}

console.log(`\n--- ${APPLY ? "APPLYING" : "DRY RUN"} ---`)
const results = { inserted: 0, skipped: 0, failed: 0 }
for (const c of ROWS) {
  const isPhoneDup = c.phone && dupPhone.has(c.phone)
  const isEmailDup = c.email && !c.email.endsWith("@noemail.local") && dupEmail.has(c.email.toLowerCase())
  if (isPhoneDup || isEmailDup) {
    results.skipped++
    console.log(`  · skip dup: ${c.name}  ph=${c.phone}  em=${c.email}`)
    continue
  }
  if (!APPLY) {
    const reg = `${REG_PREFIX}${nextN + 1}`
    nextN += 1
    console.log(`  • would insert ${reg.padEnd(20)} ${c.name.padEnd(24)} ph=${c.phone || "-"}  em=${c.email}`)
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
if (!APPLY) console.log("\n(dry run — re-run with --apply to actually insert)")
