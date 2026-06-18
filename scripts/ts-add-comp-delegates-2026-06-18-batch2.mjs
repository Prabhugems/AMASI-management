#!/usr/bin/env node
/**
 * One-off: add complimentary delegates for TechnoSurg (batch 2026-06-18 #2, 5 rows).
 * Source: ~/Downloads/techno surge.xlsx
 * - Comp delegate gets a REG-YYYYMMDD-XXXXXXX number on Complimentary Delegate ticket.
 * - Inserted as confirmed/completed with total_amount = 0.
 * - quantity_sold on ticket_types is auto-bumped by a DB trigger; do NOT bump it here.
 *
 * Use --apply to actually insert. Default is dry-run.
 */
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx"

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

const wb = XLSX.readFile("/Users/prabhubalasubramaniam/Downloads/techno surge.xlsx")
const sh = wb.Sheets[wb.SheetNames[0]]
const raw = XLSX.utils.sheet_to_json(sh, { defval: null })

const ROWS = raw.map(r => ({
  name: String(r["NAME"] || "").trim(),
  email: String(r["MAIL ID"] || "").trim().toLowerCase(),
  phone: r["MOBILE NO"] != null ? String(r["MOBILE NO"]).replace(/[^0-9]/g, "") : null,
  institution: r["ADDRESS"] ? String(r["ADDRESS"]).trim() : null,
})).filter(r => r.name && r.email)

console.log(`Parsed ${ROWS.length} rows from xlsx`)

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

const { data: ticket } = await db
  .from("ticket_types")
  .select("id, name, price, quantity_sold, quantity_total")
  .eq("id", COMP_TICKET_ID)
  .maybeSingle()
console.log(`Ticket: ${ticket?.name} (sold ${ticket?.quantity_sold}/${ticket?.quantity_total ?? "∞"})`)

const allEmails = ROWS.map(r => r.email)
const { data: dupRows } = await db
  .from("registrations")
  .select("attendee_email")
  .eq("event_id", EVENT_ID)
  .in("attendee_email", allEmails)
const dupSet = new Set((dupRows || []).map(r => (r.attendee_email || "").toLowerCase()))
if (dupSet.size) {
  console.log("\nExisting registrations (will be skipped):")
  for (const e of dupSet) console.log(`  · ${e}`)
} else {
  console.log("\nNo existing registrations in DB for any of these emails.")
}

console.log(`\n--- ${APPLY ? "APPLYING" : "DRY RUN"} ---`)
const results = { inserted: 0, skipped: 0, failed: 0 }
for (const c of ROWS) {
  if (dupSet.has(c.email)) {
    results.skipped++
    console.log(`  · skip duplicate: ${c.name} <${c.email}>`)
    continue
  }
  if (!APPLY) {
    console.log(`  • would insert: ${c.name} <${c.email}> ${c.phone || "—"}  inst=${c.institution || "—"}`)
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
    status: "confirmed",
    payment_status: "completed",
    quantity: 1,
    unit_price: 0,
    total_amount: 0,
  })
  if (error) {
    results.failed++
    console.log(`  ✗ ${c.name} <${c.email}>: ${error.message}`)
  } else {
    results.inserted++
    console.log(`  ✓ ${regNumber}  ${c.name}  <${c.email}>`)
  }
}

console.log(`\nSUMMARY  inserted=${results.inserted}  skipped=${results.skipped}  failed=${results.failed}`)
if (!APPLY) console.log("\n(dry run — re-run with --apply to actually insert)")
