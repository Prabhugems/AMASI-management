#!/usr/bin/env node
/**
 * One-off: register 2 faculty + 38 complimentary delegates for TechnoSurg
 * (batch 2026-06-13), and mark badges auto-ready for all.
 *
 * - Faculty → TECH-F-XXXX on Faculty ticket, counter bumped on event_settings.
 * - Comp delegates → REG-YYYYMMDD-XXXXXXX on Complimentary Delegate ticket.
 * - All inserted as confirmed/completed with total_amount = 0.
 * - Bumps ticket_types.quantity_sold for both tickets.
 * - Badges auto-ready: sets badge_generated_at = now() and
 *   badge_template_id = (template that includes the ticket_type, else default).
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
const FACULTY_TICKET_ID = "4c5b4c13-6847-4779-a161-3427c4a8f994"
const COMP_TICKET_ID = "a7a0b418-83a5-4b4d-b39b-1b2026eac52b"

const FACULTY = [
  { name: "Vimalakar Reddy", phone: "8220721103", email: "vimalakarreddy@gmail.com" },
  { name: "Ameet Kumar",     phone: "6002092231", email: "docam@rediffmail.com" },
]

const COMP_DELEGATES = [
  { name: "Durai Raj Kumar M",        phone: "9486965685", email: "mdurai07@gmail.com" },
  { name: "A. Sekar",                 phone: "9442884300", email: "drasekar1969@gmail.com" },
  { name: "S. Vishnuvarthan",         phone: "9842549921", email: "vishnuvarthanselvaraj@gmail.com" },
  { name: "R. Karunanithi",           phone: "9884069000", email: "rknithi2000@yahoo.co.in" },
  { name: "M. Loganathan",            phone: "9840293381", email: "drlogu.mannu@gmail.com" },
  { name: "Natarajan Ramalingam",     phone: "9865969151", email: "surgnutty@gmail.com" },
  { name: "Durai Ravi",               phone: "9597031003", email: "drdurairavi@gmail.com" },
  { name: "Aravind Nagarajan",        phone: "9597868961", email: "dr.aravind88@gmail.com" },
  { name: "Lohit Sai K",              phone: "9894984103", email: "lohit.sai1991@gmail.com" },
  { name: "Jebin Levi. J",            phone: "8015151979", email: "jjebinlevi@gmail.com" },
  { name: "Preethiya.S",              phone: "9952061832", email: "preethiyaswt@gmail.com" },
  { name: "Ilakkiya. S",              phone: "8939614228", email: "ilakkiya.sekar@gmail.com" },
  { name: "Sivachandran. K",          phone: "9092309016", email: "schandranmbbsmd@gmail.com" },
  { name: "Elakkiya Selvaraj",        phone: "9489772727", email: "ilakkiya22@gmail.com" },
  { name: "Naveenkumar. M",           phone: "7200364127", email: "hbknaveenkumar@gmail.com" },
  { name: "S. Dinesh kumar",          phone: "9842436938", email: "dinesh.ssr82@yahoo.co.in" },
  { name: "Ajay Raja",                phone: "9791867711", email: "ajay2king555@gmail.com" },
  { name: "Kumaragurubaran",          phone: "9840566049", email: "kgbstanley@gmail.com" },
  { name: "R. Sivamarieswaran",       phone: "9790836736", email: "dr.sivamarieswaran@gmail.com" },
  { name: "Mdhusudhanan. D",          phone: "9789994567", email: "dr.devamadhu@gmail.com" },
  { name: "Hubert Cyril Lourdes",     phone: "9150700667", email: "drcyril1074@gmail.com" },
  { name: "C. Kolandasamy",           phone: "7904238588", email: "gastrosurgeondrks@gmail.com" },
  { name: "S. Gayatri devi",          phone: "9150899220", email: "drgayathrisamy@gmail.com" },
  { name: "Senthil Ganesan",          phone: "9003827925", email: "jeeyes1@gmail.com" },
  { name: "Sugumar Balakrishnan",     phone: "7708844805", email: "dr.sugumar.md@gmail.com" },
  { name: "Rafiq",                    phone: "9551236625", email: "rafiq.dr.anwar@gmail.com" },
  { name: "Divya R",                  phone: "9840768275", email: "divya.ravi.chennai@gmail.com" },
  { name: "Meenakshi",                phone: "8220825008", email: "Meenanivi1995@gmail.com" },
  { name: "Aiswarya",                 phone: "9790821232", email: "aishu90rangesh@gmail.com" },
  { name: "Preethi M",                phone: "8939031090", email: "preethi.drsar@gmail.com" },
  { name: "G.M.Nandhini",             phone: "9789252145", email: "nandhugm.25@gmail.com" },
  { name: "k.M.kunguma sangeta",      phone: "9600604497", email: "sangetamurugan1990@gmail.com" },
  { name: "Himapavan. V",             phone: "9442498393", email: "himapavan95@gmail.com" },
  { name: "Mari Vel",                 phone: "9840746162", email: "drmarivelmuruganofficial@gmail.com" },
  { name: "Anantha Ramakrishnan",     phone: "9094190902", email: "kanisanju09@gmail.com" },
  { name: "Umesh raj",                phone: "9894485752", email: "drumeshraj21@gmail.com" },
  { name: "Ganesh guru",              phone: "9789858584", email: "guruganesh84@sbmch.com" },
  { name: "Sunitha Jayarani",         phone: "9047419875", email: "dr.sunithajayarani@gmail.com" },
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

// --- Resolve badge template per ticket type ---
async function resolveBadgeTemplateId(ticketTypeId) {
  // 1. Template that explicitly lists this ticket type
  const { data: specific } = await db
    .from("badge_templates")
    .select("id, name")
    .eq("event_id", EVENT_ID)
    .contains("ticket_type_ids", [ticketTypeId])
    .limit(1)
  if (specific?.[0]) return specific[0]

  // 2. Default template for event
  const { data: def } = await db
    .from("badge_templates")
    .select("id, name")
    .eq("event_id", EVENT_ID)
    .eq("is_default", true)
    .limit(1)
  if (def?.[0]) return def[0]

  return null
}

const facultyBadgeTpl = await resolveBadgeTemplateId(FACULTY_TICKET_ID)
const compBadgeTpl = await resolveBadgeTemplateId(COMP_TICKET_ID)
console.log(`Badge template (faculty): ${facultyBadgeTpl ? `${facultyBadgeTpl.name} [${facultyBadgeTpl.id}]` : "(none — will skip auto-ready)"}`)
console.log(`Badge template (comp):    ${compBadgeTpl ? `${compBadgeTpl.name} [${compBadgeTpl.id}]` : "(none — will skip auto-ready)"}`)

// --- Pre-flight: dup check + counter read ---
const allEmails = [...FACULTY, ...COMP_DELEGATES].map(r => r.email.trim().toLowerCase())
const { data: dupRows } = await db
  .from("registrations")
  .select("attendee_email")
  .eq("event_id", EVENT_ID)
  .in("attendee_email", allEmails)
const dupSet = new Set((dupRows || []).map(r => (r.attendee_email || "").toLowerCase()))
if (dupSet.size) {
  console.log("\nFound duplicates — these will be skipped:")
  for (const e of dupSet) console.log(`  · ${e}`)
}

const { data: settings, error: sErr } = await db
  .from("event_settings")
  .select("current_faculty_registration_number")
  .eq("event_id", EVENT_ID)
  .single()
if (sErr) { console.error("settings read err:", sErr); process.exit(1) }
let counter = settings.current_faculty_registration_number || 0
console.log(`\nStarting faculty counter at: ${counter} (next mint = ${counter + 1})`)

const nowIso = new Date().toISOString()

// --- Faculty ---
const facultyResults = { inserted: 0, skipped: 0, failed: 0 }
console.log("\n--- FACULTY ---")
for (const f of FACULTY) {
  const email = f.email.trim().toLowerCase()
  if (dupSet.has(email)) {
    facultyResults.skipped++
    console.log(`  · skip duplicate: ${email}`)
    continue
  }
  const nextNum = counter + 1
  const regNumber = `TECH-F-${nextNum}`

  const payload = {
    event_id: EVENT_ID,
    ticket_type_id: FACULTY_TICKET_ID,
    registration_number: regNumber,
    attendee_name: f.name.trim(),
    attendee_email: email,
    attendee_phone: normalisePhone(f.phone),
    status: "confirmed",
    payment_status: "completed",
    quantity: 1,
    unit_price: 0,
    total_amount: 0,
  }
  if (facultyBadgeTpl) {
    payload.badge_template_id = facultyBadgeTpl.id
    payload.badge_generated_at = nowIso
  }

  const { error } = await db.from("registrations").insert(payload)
  if (error) {
    facultyResults.failed++
    console.log(`  ✗ ${f.name} <${email}>: ${error.message}`)
  } else {
    counter = nextNum
    facultyResults.inserted++
    console.log(`  ✓ ${regNumber}  ${f.name}  <${email}>${facultyBadgeTpl ? "  [badge ready]" : ""}`)
  }
}

if (facultyResults.inserted > 0) {
  const { error: cErr } = await db
    .from("event_settings")
    .update({ current_faculty_registration_number: counter })
    .eq("event_id", EVENT_ID)
  if (cErr) console.log(`  ! failed to bump counter: ${cErr.message}`)
  else console.log(`✓ event_settings.current_faculty_registration_number → ${counter}`)
}

// --- Comp delegates ---
const compResults = { inserted: 0, skipped: 0, failed: 0 }
console.log("\n--- COMPLIMENTARY DELEGATES ---")
for (const c of COMP_DELEGATES) {
  const email = c.email.trim().toLowerCase()
  if (dupSet.has(email)) {
    compResults.skipped++
    console.log(`  · skip duplicate: ${email}`)
    continue
  }
  const regNumber = makeCompRegNumber()
  const payload = {
    event_id: EVENT_ID,
    ticket_type_id: COMP_TICKET_ID,
    registration_number: regNumber,
    attendee_name: c.name.trim(),
    attendee_email: email,
    attendee_phone: normalisePhone(c.phone),
    status: "confirmed",
    payment_status: "completed",
    quantity: 1,
    unit_price: 0,
    total_amount: 0,
  }
  if (compBadgeTpl) {
    payload.badge_template_id = compBadgeTpl.id
    payload.badge_generated_at = nowIso
  }
  const { error } = await db.from("registrations").insert(payload)
  if (error) {
    compResults.failed++
    console.log(`  ✗ ${c.name} <${email}>: ${error.message}`)
  } else {
    compResults.inserted++
    console.log(`  ✓ ${regNumber}  ${c.name}  <${email}>${compBadgeTpl ? "  [badge ready]" : ""}`)
  }
}

// --- Bump quantity_sold + badges_generated_count ---
async function bumpSold(ticketId, by) {
  if (by <= 0) return
  const { data: t } = await db
    .from("ticket_types")
    .select("quantity_sold, name")
    .eq("id", ticketId)
    .single()
  const next = (t?.quantity_sold || 0) + by
  await db.from("ticket_types").update({ quantity_sold: next }).eq("id", ticketId)
  console.log(`✓ ticket "${t?.name}" quantity_sold → ${next}`)
}
await bumpSold(FACULTY_TICKET_ID, facultyResults.inserted)
await bumpSold(COMP_TICKET_ID, compResults.inserted)

async function bumpBadgeCount(tpl, by) {
  if (!tpl || by <= 0) return
  const { data: row } = await db
    .from("badge_templates")
    .select("badges_generated_count, name")
    .eq("id", tpl.id)
    .single()
  const next = (row?.badges_generated_count || 0) + by
  await db.from("badge_templates").update({ badges_generated_count: next }).eq("id", tpl.id)
  console.log(`✓ badge template "${row?.name}" badges_generated_count → ${next}`)
}
await bumpBadgeCount(facultyBadgeTpl, facultyResults.inserted)
await bumpBadgeCount(compBadgeTpl, compResults.inserted)

console.log("\n--- SUMMARY ---")
console.log(`Faculty:  inserted=${facultyResults.inserted}  skipped=${facultyResults.skipped}  failed=${facultyResults.failed}`)
console.log(`Comp del: inserted=${compResults.inserted}  skipped=${compResults.skipped}  failed=${compResults.failed}`)
