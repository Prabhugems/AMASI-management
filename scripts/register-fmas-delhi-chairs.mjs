#!/usr/bin/env node
// Create speaker-ticket registrations (attendee_designation = "Chairperson") for every
// chairperson on event 8e497ba9 that isn't already registered, so badges can print.
// Pulls missing emails/phones from the Mail-Merge xlsx tracker when needed.

import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import XLSX from "xlsx"
import { createClient } from "@supabase/supabase-js"

const EVENT_ID = "8e497ba9-f83b-4a66-9be5-1714f0d8669b"
const XLSX_PATH = "/Users/prabhubalasubramaniam/Downloads/126 FI.xlsx"
const DRY_RUN = process.argv.includes("--dry-run")

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
  }
}
loadEnv()

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
  { auth: { persistSession: false } }
)

function normalize(name) {
  return (name || "")
    .toLowerCase()
    .replace(/^(dr|prof|mr|mrs|ms|shri)\.?\s+/i, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function stripTitle(raw) {
  return (raw || "").replace(/^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Shri\.?)\s+/i, "").trim()
}

// ---- Load xlsx tracker for fallback contacts ----
const wb = XLSX.readFile(XLSX_PATH)
const trackerRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })
const trackerByName = new Map()
for (const r of trackerRows) {
  const key = normalize(r.Name)
  if (!key) continue
  trackerByName.set(key, {
    name: r.Name,
    email: (r.Gmail || "").toString().replace(/\s+/g, "").trim() || null,
    phone: r["Mobile Number"] ? String(r["Mobile Number"]).trim() : null,
  })
}
console.log(`Loaded ${trackerByName.size} contacts from xlsx`)

// ---- Find or create the Speaker ticket ----
let { data: speakerTicket } = await db
  .from("ticket_types")
  .select("id, name")
  .eq("event_id", EVENT_ID)
  .or("name.ilike.%speaker%,name.ilike.%faculty%")
  .limit(1)
  .maybeSingle()

if (!speakerTicket) {
  console.error("No Speaker/Faculty ticket type on this event — aborting.")
  process.exit(1)
}
console.log(`Speaker ticket: ${speakerTicket.name} (${speakerTicket.id})`)

// ---- Unique chairs from faculty_assignments ----
const { data: chairs } = await db
  .from("faculty_assignments")
  .select("faculty_name,faculty_email,faculty_phone")
  .eq("event_id", EVENT_ID)
  .eq("role", "chairperson")

const uniqueChairs = new Map() // key = normalized name
for (const c of chairs) {
  const key = normalize(c.faculty_name)
  if (!key) continue
  const existing = uniqueChairs.get(key) || {
    name: stripTitle(c.faculty_name),
    rawName: c.faculty_name,
    email: null,
    phone: null,
  }
  if (!existing.email && c.faculty_email) existing.email = c.faculty_email.toLowerCase().trim()
  if (!existing.phone && c.faculty_phone) existing.phone = c.faculty_phone
  uniqueChairs.set(key, existing)
}

// Fill in missing email/phone from tracker
for (const [key, chair] of uniqueChairs) {
  if (chair.email && chair.phone) continue
  const t = trackerByName.get(key)
  if (!t) continue
  if (!chair.email && t.email) chair.email = t.email.toLowerCase()
  if (!chair.phone && t.phone) chair.phone = t.phone
}

console.log(`${uniqueChairs.size} unique chair faculty across all sessions`)

// ---- Skip chairs already registered (by email match) ----
const emails = [...uniqueChairs.values()].map((c) => c.email).filter(Boolean)
const { data: regs } = await db
  .from("registrations")
  .select("attendee_email,attendee_name,attendee_designation")
  .eq("event_id", EVENT_ID)
  .in("attendee_email", emails)
const existingByEmail = new Map(regs.map((r) => [r.attendee_email.toLowerCase(), r]))

// Also check by name for chairs that have no email
const existingByName = new Set()
{
  const { data: nameRegs } = await db
    .from("registrations")
    .select("attendee_name")
    .eq("event_id", EVENT_ID)
  for (const r of nameRegs || []) existingByName.add(normalize(r.attendee_name))
}

// ---- Registration number sequence ----
async function nextRegNumber() {
  const date = new Date()
  const ymd =
    date.getFullYear() +
    String(date.getMonth() + 1).padStart(2, "0") +
    String(date.getDate()).padStart(2, "0")
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `CHR-${ymd}-${rand}`
}

let created = 0
let skipped = 0
const failures = []

for (const [key, chair] of uniqueChairs) {
  const exists =
    (chair.email && existingByEmail.has(chair.email)) || existingByName.has(key)
  if (exists) {
    skipped++
    continue
  }
  if (!chair.email) {
    failures.push({ name: chair.name, reason: "no email" })
    continue
  }

  if (DRY_RUN) {
    console.log(` + ${chair.name.padEnd(28)} ${chair.email} ${chair.phone || ""}`)
    created++
    continue
  }

  const regNumber = await nextRegNumber()
  const portalToken = crypto.randomUUID()
  const checkinToken = crypto.randomUUID()
  const { error } = await db.from("registrations").insert({
    event_id: EVENT_ID,
    ticket_type_id: speakerTicket.id,
    registration_number: regNumber,
    attendee_name: chair.name,
    attendee_email: chair.email,
    attendee_phone: chair.phone,
    attendee_designation: "Chairperson",
    attendee_country: "India",
    checkin_token: checkinToken,
    quantity: 1,
    unit_price: 0,
    tax_amount: 0,
    discount_amount: 0,
    total_amount: 0,
    status: "pending",
    payment_status: "completed",
    participation_mode: "offline",
    custom_fields: {
      portal_token: portalToken,
      invitation_sent: new Date().toISOString(),
      needs_travel: false,
      role: "chairperson",
    },
  })
  if (error) {
    failures.push({ name: chair.name, reason: error.message })
    continue
  }
  created++
}

console.log(`\nCreated ${created} chair registrations, skipped ${skipped} (already registered)`)
if (failures.length) {
  console.log(`Failures (${failures.length}):`)
  for (const f of failures) console.log(" -", f.name, "→", f.reason)
}
