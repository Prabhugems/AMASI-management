#!/usr/bin/env node
/**
 * Add Exhibitors (batch 2) for TechnoSurg from
 * ~/Downloads/Technosurge registration.xlsx Sheet1.
 * Header: SNO | COMPANY | NAME | CONTACT NUMBER | MAIL ID.
 * One person per row.
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
const EXHIBITOR_TICKET_ID = "53fdd5d0-19da-4c0f-ad30-53702c2494a7"

function titleCase(s) {
  // Treat space, hyphen, slash, and period as word boundaries so
  // "s.thejashwini" → "S.Thejashwini" not "S.thejashwini".
  return s.toLowerCase().replace(/(?:^|[\s\-/.])\w/g, m => m.toUpperCase())
}
function cleanName(s) {
  let v = String(s ?? "").replace(/\r/g, "").trim()
  // Multi-line: keep first non-empty line only
  v = (v.split(/\n/).find(line => line.trim()) || "").trim()
  // Drop appended role/affiliation after the first comma
  v = v.split(",")[0].trim()
  // Strip honorifics — handle both "Mr." and "Mr.Name" (no space)
  v = v.replace(/^(mr|mrs|ms|dr)\.?\s*/i, "")
  // Strip leading/trailing junk (commas, dashes, dots that orphaned at the edge)
  v = v.replace(/^[\s,.\-]+|[\s,.\-]+$/g, "").trim()
  if (!v) return ""
  return titleCase(v)
}
function cleanCompany(s) {
  let v = String(s ?? "").replace(/\s+/g, " ").trim()
  if (!v) return ""
  v = titleCase(v)
  return v
    .replace(/\bLtd\b/g, "Ltd")
    .replace(/\bPvt\b/g, "Pvt")
    .replace(/\bLimited\b/g, "Limited")
    .replace(/\bIit\b/g, "IIT")
    .replace(/\bJ&j\b/gi, "J&J")
    .replace(/\bSsi\b/g, "SSI")
}
function cleanPhone(v) {
  if (v == null) return null
  let cleaned = String(v).replace(/[^0-9]/g, "")
  // Strip leading +91 (12 digits, starts with 91)
  if (cleaned.length === 12 && cleaned.startsWith("91")) cleaned = cleaned.slice(2)
  return cleaned || null
}
function cleanEmail(s) {
  if (!s) return null
  const e = String(s).trim().toLowerCase().replace(/\s+/g, "")
  return e || null
}
function slug(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "anon"
}
function placeholderEmail(name, phone, company) {
  const comp = String(company).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16)
  return `${slug(name)}-${comp || "stall"}-${phone || "x"}@noemail.local`
}

const wb = XLSX.readFile("/Users/prabhubalasubramaniam/Downloads/Technosurge registration.xlsx")
const raw = XLSX.utils.sheet_to_json(wb.Sheets["Sheet1"], { defval: null, header: 1 })
const dataRows = raw.slice(1).filter(r => Array.isArray(r) && typeof r[0] === "number")

const PEOPLE = dataRows.map(r => {
  const company = cleanCompany(r[1])
  const name = cleanName(r[2])
  const phone = cleanPhone(r[3])
  const realEmail = cleanEmail(r[4])
  if (!company || !name) return null
  return {
    name,
    phone,
    company,
    email: realEmail || placeholderEmail(name, phone, company),
    _placeholder: !realEmail,
    _missingPhone: !phone,
  }
}).filter(Boolean)

console.log(`Parsed ${dataRows.length} stall rows → ${PEOPLE.length} exhibitor people.`)

const { data: ticket } = await db
  .from("ticket_types")
  .select("id, name, quantity_sold")
  .eq("id", EXHIBITOR_TICKET_ID)
  .maybeSingle()
console.log(`Ticket: ${ticket?.name} (sold ${ticket?.quantity_sold})`)

// Pre-flight: existing by email OR phone
const allEmails = PEOPLE.map(p => p.email)
const allPhones = PEOPLE.map(p => p.phone).filter(Boolean)
const orParts = []
if (allEmails.length) orParts.push(`attendee_email.in.(${allEmails.map(e => `"${e}"`).join(",")})`)
if (allPhones.length) orParts.push(`attendee_phone.in.(${allPhones.map(p => `"${p}"`).join(",")})`)
const { data: dups } = await db
  .from("registrations")
  .select("attendee_email, attendee_phone")
  .eq("event_id", EVENT_ID)
  .or(orParts.join(","))
const dupEmail = new Set((dups || []).map(d => (d.attendee_email || "").toLowerCase()))
const dupPhone = new Set((dups || []).map(d => d.attendee_phone).filter(Boolean))

console.log(`\nMissing phone:  ${PEOPLE.filter(p => p._missingPhone).length}`)
console.log(`Existing in DB: email=${dupEmail.size}  phone=${dupPhone.size}`)

console.log(`\n--- ${APPLY ? "APPLYING" : "DRY RUN PREVIEW"} ---`)
const results = { inserted: 0, skipped: 0, failed: 0 }
let i = 0
for (const p of PEOPLE) {
  i++
  const dup = dupEmail.has(p.email) || (p.phone && dupPhone.has(p.phone))
  if (dup) {
    results.skipped++
    console.log(`  · skip dup: ${p.name} <${p.email}> ${p.phone || "—"} [${p.company}]`)
    continue
  }
  if (!APPLY) {
    console.log(`  ${String(i).padStart(2)}. ${p.name.padEnd(24)}  ${(p.phone || "—").padEnd(12)}  ${p.company}${p._missingPhone ? "  ⚠ no phone" : ""}${p._placeholder ? "" : "  ✉"}`)
    results.inserted++
    continue
  }
  const d = new Date()
  const regNumber = `REG-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${Array.from({length:7},()=>"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random()*36)]).join("")}`
  const { error } = await db.from("registrations").insert({
    event_id: EVENT_ID,
    ticket_type_id: EXHIBITOR_TICKET_ID,
    registration_number: regNumber,
    attendee_name: p.name,
    attendee_email: p.email,
    attendee_phone: p.phone,
    attendee_institution: p.company,
    status: "confirmed",
    payment_status: "completed",
    quantity: 1,
    unit_price: 0,
    total_amount: 0,
  })
  if (error) {
    results.failed++
    console.log(`  ✗ ${p.name} [${p.company}]: ${error.message}`)
  } else {
    results.inserted++
    console.log(`  ✓ ${regNumber}  ${p.name}  [${p.company}]  ${p.phone || "—"}`)
  }
}

console.log(`\nSUMMARY  inserted=${results.inserted}  skipped=${results.skipped}  failed=${results.failed}`)
if (!APPLY) console.log("\n(dry run — re-run with --apply to actually insert)")
