#!/usr/bin/env node
/**
 * One-off: add Exhibitors for TechnoSurg.
 * Source: ~/Downloads/technosurge list.xlsx (Sheet1)
 *
 * Structure: each row = one pharma company stall, with up to 2 contact persons.
 * - Clean name: strip "MR./Mr ./MR" prefix; convert ALL CAPS → Title Case.
 * - No email in source — use deterministic placeholder so registrations exist;
 *   email blasts will skip @noemail.local, WhatsApp will still reach them.
 * - Institution = company name (also title-cased).
 * - Skip rows with no company OR no people.
 *
 * Use --apply to actually insert. Default is dry-run (preview).
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

// Capitalize first letter of each word — but treat only whitespace/hyphen/slash
// as a word boundary, so "reddy's" → "Reddy's" (not "Reddy'S").
function titleCase(s) {
  return s.toLowerCase().replace(/(?:^|[\s\-/])\w/g, m => m.toUpperCase())
}

function cleanName(s) {
  let v = String(s ?? "").trim()
  v = v.replace(/^(MR|MRS|MS|DR)\s*\.?\s*\.?\s*/i, "")
  v = v.trim()
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
}

function cleanPhone(v) {
  if (v == null) return null
  return String(v).replace(/[^0-9]/g, "") || null
}

function slugFromName(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "anon"
}

function placeholderEmail(name, phone, company) {
  const comp = String(company).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16)
  return `${slugFromName(name)}-${comp || "stall"}-${phone || "x"}@noemail.local`
}

const wb = XLSX.readFile("/Users/prabhubalasubramaniam/Downloads/technosurge list.xlsx")
const sh = wb.Sheets["Sheet1"]
const raw = XLSX.utils.sheet_to_json(sh, { defval: null, header: 1 })

// Data starts at index 2 (title + header)
const dataRows = raw.slice(2).filter(r => Array.isArray(r) && typeof r[0] === "number")

const PEOPLE = []
for (const r of dataRows) {
  const company = cleanCompany(r[1])
  const stall = String(r[3] ?? "").replace(/\s+/g, " ").trim()
  if (!company) continue
  for (const [nameIdx, phoneIdx] of [[4, 5], [6, 7]]) {
    const name = cleanName(r[nameIdx])
    const phone = cleanPhone(r[phoneIdx])
    if (!name) continue
    PEOPLE.push({
      name,
      phone,
      company,
      stall,
      email: placeholderEmail(name, phone, company),
      remark: r[8] ? String(r[8]).trim() : null,
      _missingPhone: !phone,
    })
  }
}

console.log(`Parsed ${dataRows.length} stall rows → ${PEOPLE.length} exhibitor people.`)

const { data: ticket } = await db
  .from("ticket_types")
  .select("id, name, price, quantity_sold")
  .eq("id", EXHIBITOR_TICKET_ID)
  .maybeSingle()
console.log(`Ticket: ${ticket?.name} (sold ${ticket?.quantity_sold})`)

// Pre-flight: duplicates by placeholder email OR by phone (people we already added today)
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

console.log(`\nMissing phone:    ${PEOPLE.filter(p => p._missingPhone).length}`)
console.log(`Existing in DB:   email=${dupEmail.size}  phone=${dupPhone.size}`)

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
    console.log(`  ${String(i).padStart(2)}. ${p.name.padEnd(22)}  ${(p.phone || "—").padEnd(12)}  ${p.stall.padEnd(8)}  ${p.company}${p._missingPhone ? "  ⚠ no phone" : ""}`)
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
