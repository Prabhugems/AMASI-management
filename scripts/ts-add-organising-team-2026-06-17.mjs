#!/usr/bin/env node
/**
 * Build the TechnoSurg Organising Team from DR's TNMC details.xlsx:
 *   - Create (or reuse) an "Organising Team" ticket type.
 *   - For rows that match an existing registration (Faculty or Delegate) by
 *     email/phone: CONVERT to Organising Team (renumber TECH-O-XXXX, swap
 *     ticket type).
 *   - For new rows with contact info: CREATE a fresh TECH-O-XXXX registration.
 *   - Rows without contact info are skipped (logged).
 *   - Numbering starts at TECH-O-1001.
 *
 * Pass --live to apply; default is dry-run.
 */
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx"

const LIVE = process.argv.includes("--live")
const env = {}
for (const line of fs.readFileSync(path.join(process.cwd(), ".env.technosurg.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const EVENT_ID = "87c614b3-ff23-47c5-8682-87ea32aa77b9"
const XLSX_PATH = "/Users/prabhubalasubramaniam/Downloads/DR's TNMC details.xlsx"
const ORG_TICKET_NAME = "Organising Team"
const ORG_PREFIX = "TECH-O-"
const ORG_START = 1001

// --- Helpers ----------------------------------------------------------------
function titleCase(s) {
  return String(s || "")
    .replace(/\b(MBBS|MD|DNB|DM|DESA|FIPM|MS|MCh|FNB|FACRSI|EFIAGES|FMAS|MRCS|DMAS|FMGS|FRM|DrNB|MEM|FRCS|MRCP|HOD|OG|SGE|GS|RD)\b\.?/gi, "")
    .replace(/[,()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(DR|Dr)\.?\s*/i, "")
    .replace(/\b([A-Z])([A-Z]+)\b/g, (_, a, b) => a + b.toLowerCase())
}
function normEmail(s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, "") || null }
function normPhone(s) {
  const cleaned = String(s || "").replace(/[^0-9]/g, "")
  return cleaned || null
}

// --- Parse Excel ------------------------------------------------------------
const wb = XLSX.readFile(XLSX_PATH)
const data = XLSX.utils.sheet_to_json(wb.Sheets["Sheet1"], { defval: "", header: 1 })
const rows = []
for (let i = 1; i < data.length; i++) {
  const r = data[i] || []
  if (!r[2]) continue
  if (String(r[0]).toUpperCase() === "SL NO") continue
  if (String(r[2]).toUpperCase() === "NAME OF THE DOCTOR") continue
  rows.push({
    name: titleCase(r[2]),
    department: String(r[3] || "").trim(),
    designation: String(r[4] || "").trim(),
    email: normEmail(r[8]),
    phone: normPhone(r[7]),
  })
}
console.log(`Parsed ${rows.length} rows from Excel.`)
const noContact = rows.filter((r) => !r.email && !r.phone)
const withContact = rows.filter((r) => r.email || r.phone)
console.log(`  · with contact: ${withContact.length}`)
console.log(`  · without contact: ${noContact.length}`)
if (noContact.length) {
  console.log("  Without contact (will be skipped):")
  for (const r of noContact) console.log(`    · ${r.name}`)
}

// --- Resolve / create ticket type ------------------------------------------
console.log()
const { data: existingTicket } = await db
  .from("ticket_types")
  .select("id, name")
  .eq("event_id", EVENT_ID)
  .eq("name", ORG_TICKET_NAME)
  .maybeSingle()

let ORG_TICKET_ID = existingTicket?.id ?? null
if (ORG_TICKET_ID) {
  console.log(`Ticket type "${ORG_TICKET_NAME}" already exists: ${ORG_TICKET_ID}`)
} else if (LIVE) {
  const { data: created, error } = await db
    .from("ticket_types")
    .insert({
      event_id: EVENT_ID,
      name: ORG_TICKET_NAME,
      description: "Organising Team — internal complimentary registration.",
      price: 0,
      tax_percentage: 0,
      quantity_total: 200,
      quantity_sold: 0,
      is_hidden: true,
      status: "active",
    })
    .select("id")
    .single()
  if (error) { console.error("Failed to create ticket type:", error.message); process.exit(1) }
  ORG_TICKET_ID = created.id
  console.log(`Created ticket type "${ORG_TICKET_NAME}": ${ORG_TICKET_ID}`)
} else {
  console.log(`(dry-run) Would create new ticket type "${ORG_TICKET_NAME}".`)
}

// --- Pull existing TechnoSurg registrations --------------------------------
const { data: existing } = await db
  .from("registrations")
  .select("id, registration_number, attendee_name, attendee_email, attendee_phone, ticket_type_id")
  .eq("event_id", EVENT_ID)
const byEmail = new Map()
const byPhone = new Map()
for (const r of existing || []) {
  if (r.attendee_email) byEmail.set(r.attendee_email.toLowerCase(), r)
  if (r.attendee_phone) byPhone.set(String(r.attendee_phone).replace(/[^0-9]/g, ""), r)
}

// --- Plan ------------------------------------------------------------------
const plan = { convert: [], create: [], skip: noContact.length }
for (const r of withContact) {
  const m = (r.email && byEmail.get(r.email)) || (r.phone && byPhone.get(r.phone)) || null
  if (m) plan.convert.push({ ...r, existing: m })
  else plan.create.push(r)
}

console.log()
console.log("--- PLAN ---")
console.log(`Convert (faculty/delegate → Organising Team): ${plan.convert.length}`)
for (const c of plan.convert) {
  console.log(`  · ${c.existing.registration_number}  ${c.existing.attendee_name}  ↔  ${c.name}`)
}
console.log(`Create new: ${plan.create.length}`)
console.log(`Skip (no contact): ${plan.skip}`)
console.log()

if (!LIVE) {
  console.log("Dry-run. Pass --live to execute.")
  process.exit(0)
}

// --- Allocate sequence: convert rows keep their slot order, then new rows --
let counter = ORG_START
const allOps = []
for (const c of plan.convert) {
  allOps.push({ kind: "convert", existing: c.existing, name: c.name, email: c.email, phone: c.phone, regNumber: `${ORG_PREFIX}${counter++}` })
}
for (const n of plan.create) {
  allOps.push({ kind: "create", name: n.name, email: n.email, phone: n.phone, regNumber: `${ORG_PREFIX}${counter++}` })
}

// --- Execute ---------------------------------------------------------------
const result = { converted: 0, created: 0, failed: 0 }
console.log("--- EXECUTING ---")
for (const op of allOps) {
  if (op.kind === "convert") {
    const { error } = await db.from("registrations").update({
      ticket_type_id: ORG_TICKET_ID,
      registration_number: op.regNumber,
      attendee_name: op.name,  // overwrite with the cleaned name
    }).eq("id", op.existing.id)
    if (error) { result.failed++; console.log(`  ✗ convert ${op.existing.registration_number} → ${op.regNumber}: ${error.message}`) }
    else { result.converted++; console.log(`  ✓ convert ${op.existing.registration_number} → ${op.regNumber}  ${op.name}`) }
  } else {
    const { error } = await db.from("registrations").insert({
      event_id: EVENT_ID,
      ticket_type_id: ORG_TICKET_ID,
      registration_number: op.regNumber,
      attendee_name: op.name,
      attendee_email: op.email,
      attendee_phone: op.phone,
      status: "confirmed",
      payment_status: "completed",
      quantity: 1,
      unit_price: 0,
      total_amount: 0,
    })
    if (error) { result.failed++; console.log(`  ✗ create ${op.regNumber} ${op.name}: ${error.message}`) }
    else { result.created++; console.log(`  ✓ create ${op.regNumber}  ${op.name}`) }
  }
}

console.log()
console.log("--- SUMMARY ---")
console.log(`Converted: ${result.converted}`)
console.log(`Created:   ${result.created}`)
console.log(`Failed:    ${result.failed}`)
console.log(`Skipped (no contact): ${plan.skip}`)
