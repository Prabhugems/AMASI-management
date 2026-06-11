#!/usr/bin/env node
/**
 * One-off: add complimentary delegates for TechnoSurg (batch 2026-06-11, 19 rows).
 * - Comp delegate gets a REG-YYYYMMDD-XXXXXXX number on Complimentary Delegate ticket.
 * - Inserted as confirmed/completed with total_amount = 0.
 * - Bumps ticket_types.quantity_sold for the comp ticket.
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
  { name: "Joyner Abraham M",       phone: "7010895550",  email: "joynerabraham@gmail.com" },
  { name: "KARTHIKEYAN S",          phone: "9894795974",  email: "drsk1287@gmail.com" },
  { name: "R.Vijayalakshmi",        phone: "8056092462",  email: "vijayadwarak3@gmail.com" },
  { name: "Shyamprashad",           phone: "9941895006",  email: "shyamprashadk22@gmail.com" },
  { name: "KAMALAKKHANNAN C",       phone: "7010038550",  email: "dr.c.kamal@gmail.com" },
  { name: "R Bharathiraja",         phone: "9894239377",  email: "barathiraja.kbr@gmail.com" },
  { name: "Jothivel Govindasamy",   phone: "9444461849",  email: "jothivelg@hotmail.com" },
  { name: "P.Suresh Kumar",         phone: "944444081",   email: "drpsk88@gmail.com" }, // NOTE: phone is 9 digits in source
  { name: "Chinny Vikram",          phone: "7904297876",  email: "Vikram.hpb@gmail.com" },
  { name: "King Gandhi",            phone: "9003160553",  email: "kinggandhi@gmail.com" },
  { name: "SARATH KUMAR V",         phone: "9841241242",  email: "vsarath1010@gmail.com" },
  { name: "Kapali Neelamekam",      phone: "9551094448",  email: "drneelamekam.k@srmhospitals.com" },
  { name: "Suganth Sarvesh P",      phone: "9952331631",  email: "suganthsarvesh@gmail.com" },
  { name: "Guhan R J",              phone: "8056930411",  email: "guhanrj@gmail.com" },
  { name: "R.Raja",                 phone: "9790108181",  email: "rajamsgs2016@gmail.com" },
  { name: "Pankaj Surana",          phone: "9884480952",  email: "dro_surana@yahoo.co.in" },
  { name: "G.Vijayalakshmi",        phone: "9962238896",  email: "vijayalakshmi.gunasekaran88@gmail.com" },
  { name: "Radha",                  phone: "9840372653",  email: "spksradha@gmail.com" },
  { name: "PRADEEP C",              phone: "9840704621",  email: "cpradeepmmc@gmail.com" },
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

// --- Bump quantity_sold on comp ticket ---
if (results.inserted > 0) {
  const { data: t } = await db
    .from("ticket_types")
    .select("quantity_sold, name")
    .eq("id", COMP_TICKET_ID)
    .single()
  const next = (t?.quantity_sold || 0) + results.inserted
  await db.from("ticket_types").update({ quantity_sold: next }).eq("id", COMP_TICKET_ID)
  console.log(`\n✓ ticket "${t?.name}" quantity_sold → ${next}`)
}

console.log("\n--- SUMMARY ---")
console.log(`Comp del: inserted=${results.inserted}  skipped=${results.skipped}  failed=${results.failed}`)
