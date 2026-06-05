#!/usr/bin/env node
/**
 * Bulk import 33 complimentary delegates onto the TechnoSurg event:
 *   1. Create a "Complimentary Delegate" ticket type (₹0, qty 33).
 *   2. Insert 33 registrations as confirmed with total_amount = 0.
 *   3. Update the ticket's quantity_sold.
 *
 * Sources Supabase credentials from .env.technosurg.local (NOT the AMASI
 * .env.local — that DB doesn't have the TechnoSurg event).
 */
import fs from "node:fs"
import xlsx from "xlsx"
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
const XLSX_PATH = "/Users/prabhubalasubramaniam/Downloads/33 Delegate for 0 fees.xlsx"
const TICKET_NAME = "Complimentary Delegate"

// --- Read xlsx ---
const wb = xlsx.readFile(XLSX_PATH)
const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" })
console.log(`Read ${rows.length} rows from xlsx`)

// --- Create or reuse the Complimentary Delegate ticket type ---
let ticket
const { data: existingTicket } = await db
  .from("ticket_types")
  .select("id, name, price, quantity_total, quantity_sold")
  .eq("event_id", EVENT_ID)
  .eq("name", TICKET_NAME)
  .maybeSingle()

if (existingTicket) {
  ticket = existingTicket
  console.log(`Found existing ticket type: ${ticket.id} (₹${ticket.price}, sold=${ticket.quantity_sold ?? 0})`)
} else {
  const { data: created, error: createErr } = await db
    .from("ticket_types")
    .insert({
      event_id: EVENT_ID,
      name: TICKET_NAME,
      description: "Complimentary delegate registration (0 fee)",
      price: 0,
      status: "active",
      quantity_total: rows.length,
      quantity_sold: 0,
    })
    .select("id, name, price, quantity_total, quantity_sold")
    .single()

  if (createErr) {
    console.error("Failed to create ticket type:", createErr)
    process.exit(1)
  }
  ticket = created
  console.log(`✓ Created ticket type: ${ticket.id} (₹${ticket.price}, qty=${ticket.quantity_total})`)
}

// --- Check for existing registrations by email so we skip duplicates ---
const emails = rows
  .map((r) => String(r.Email || "").trim().toLowerCase())
  .filter(Boolean)

const { data: existingRegs } = await db
  .from("registrations")
  .select("attendee_email")
  .eq("event_id", EVENT_ID)
  .in("attendee_email", emails)

const dupSet = new Set((existingRegs || []).map((r) => (r.attendee_email || "").toLowerCase()))

// --- Insert registrations ---
function makeRegNumber() {
  const date = new Date()
  const dateStr =
    date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, "0") +
    date.getDate().toString().padStart(2, "0")
  const random = Array.from({ length: 7 }, () => "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 36)]).join("")
  return `REG-${dateStr}-${random}`
}

function normalisePhone(v) {
  if (v === null || v === undefined || v === "") return null
  return String(v).replace(/[^0-9]/g, "") || null
}

const results = { inserted: 0, skipped: 0, failed: 0, errors: [] }

for (const r of rows) {
  const name = String(r.Name || "").trim()
  const email = String(r.Email || "").trim().toLowerCase()
  const phone = normalisePhone(r.Phone)

  if (!name || !email) {
    results.failed++
    results.errors.push(`Missing name/email: ${JSON.stringify(r)}`)
    continue
  }
  if (dupSet.has(email)) {
    results.skipped++
    console.log(`  · skip duplicate: ${email}`)
    continue
  }

  const { error } = await db.from("registrations").insert({
    event_id: EVENT_ID,
    ticket_type_id: ticket.id,
    registration_number: makeRegNumber(),
    attendee_name: name,
    attendee_email: email,
    attendee_phone: phone,
    status: "confirmed",
    payment_status: "completed",
    quantity: 1,
    unit_price: 0,
    total_amount: 0,
  })

  if (error) {
    results.failed++
    results.errors.push(`${email}: ${error.message}`)
    console.log(`  ✗ ${email}: ${error.message}`)
  } else {
    results.inserted++
    console.log(`  ✓ ${name} <${email}>`)
  }
}

// --- Bump ticket quantity_sold ---
if (results.inserted > 0) {
  const newSold = (ticket.quantity_sold || 0) + results.inserted
  await db
    .from("ticket_types")
    .update({ quantity_sold: newSold })
    .eq("id", ticket.id)
  console.log(`\n✓ Updated ticket quantity_sold → ${newSold}`)
}

console.log("\n--- Summary ---")
console.log(`Inserted: ${results.inserted}`)
console.log(`Skipped (duplicate): ${results.skipped}`)
console.log(`Failed: ${results.failed}`)
if (results.errors.length) {
  console.log("\nErrors:")
  for (const e of results.errors) console.log("  ", e)
}
