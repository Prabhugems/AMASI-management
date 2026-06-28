#!/usr/bin/env node
/**
 * Apply the "final" v-1 program for 125th AMASI Skill Course (Kolkata).
 *
 * Source of truth: AMASI SKILL COURSE-1.docx (Gynae track only).
 *
 * Updates in this script:
 *   A. Backfill real email + phone for 14 existing Gynae faculty
 *      (currently registered as pending-125F20XX@amasi.local with no phone).
 *      Also renames "Zoha" → "Dr M M Samsuzzoha" (same person).
 *   B. Add 3 new faculty (Kamilya, Sudip Basu, Abhinibesh Chatterjee) as
 *      registrations only if missing.
 *   C. Program changes:
 *      - G-D1-07: rename topic to "Laparoscopic Sacro-colpopexy for vault
 *                 prolapse" and reassign from Arnab Basak → Kamilya
 *      - G-D2-04: speaker rename Zoha → Dr M M Samsuzzoha (cascades from A)
 *      - G-D2-06: speaker change Abhijit Halder → Sudip Basu
 *      - G-D3-01..04: add 9 FMAS examiners as faculty_assignments
 *
 * Idempotent: re-running should be a no-op once applied.
 * Run with --apply to actually write; default is dry-run.
 */
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const APPLY = process.argv.includes("--apply")
const env = {}
for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const EVENT_ID = "cb26bbb1-0ab9-4e2f-a391-dcb5636c47d6"

// === A. CONTACT UPDATES for existing faculty ===
// Keyed by registration_number. Each entry → final name, email, phone.
const CONTACT_UPDATES = [
  { reg: "125F2028", name: "Subrata Lal Seal",     email: "sealsubrata@gmail.com",            phone: "9831032708" },
  { reg: "125F2029", name: "Biswajyoti Guha",      email: "reach2biswa33@gmail.com",          phone: "9007539296" },
  { reg: "125F2030", name: "Pushan Kundu",         email: "kpushan@ymail.com",                phone: "9830175185" },
  { reg: "125F2031", name: "Mandira Dasgupta",     email: "mandiradasgupta@hotmail.com",      phone: "9831106193" },
  { reg: "125F2032", name: "Amit Basu",            email: "amitbasu1@gmail.com",              phone: "9831178828" },
  { reg: "125F2034", name: "Bidisha Roychowdhury", email: "bidisha_roychoudhury@yahoo.co.in", phone: "9831645879" },
  { reg: "125F2035", name: "Arunashis Mallick",    email: "arumallick88@gmail.com",           phone: "9432976278" },
  { reg: "125F2036", name: "Poushali Sanyal",      email: "poushali.sanyal@yahoo.co.in",      phone: "9830279680" },
  { reg: "125F2038", name: "Dr M M Samsuzzoha",    email: "samzoha@hotmail.com",              phone: "9830229994",
    renameFrom: "Zoha" },
  { reg: "125F2040", name: "Abhijit Halder",       email: "drabhijit84@gmail.com",            phone: "9432163681" },
  { reg: "125F2041", name: "Sebanti Goswami",      email: "sebantigoswami@yahoo.co.in",       phone: "9831135933" },
  { reg: "125F2042", name: "Sanjay Biswas",        email: "drsanjaykrbiswas@gmail.com",       phone: "9830140782" },
  { reg: "125F2043", name: "Basab Mukherjee",      email: "basabm@gmail.com",                 phone: "9830027759" },
  { reg: "125F2044", name: "Shyamal Sett",         email: "drshyamalsett@yahoo.co.in",        phone: "9830144356" },
]

// === B. NEW FACULTY to add as registrations (if missing) ===
const NEW_FACULTY = [
  { name: "Gouri Sankar Kamilya",   email: "drgkamilya@gmail.com", phone: "9433122643" },
  { name: "Sudip Basu",             email: "sbasu64@gmail.com",    phone: "9831592936" },
  { name: "Abhinibesh Chatterjee",  email: "acbb258@gmail.com",    phone: "9830617414" },
]

// === C. PROGRAM CHANGES ===
// C1. G-D1-07: rename topic + reassign Arnab Basak → Kamilya
// C2. G-D2-04: speaker name updates via cascade from A (Zoha → Samsuzzoha)
// C3. G-D2-06: speaker change Abhijit Halder → Sudip Basu
// C4. G-D3-01..04: add 9 FMAS examiners

const FMAS_EXAMINERS = [
  { name: "Subrata Lal Seal",     email: "sealsubrata@gmail.com",            phone: "9831032708" },
  { name: "Amit Basu",            email: "amitbasu1@gmail.com",              phone: "9831178828" },
  { name: "Pushan Kundu",         email: "kpushan@ymail.com",                phone: "9830175185" },
  { name: "Biswajyoti Guha",      email: "reach2biswa33@gmail.com",          phone: "9007539296" },
  { name: "Mandira Dasgupta",     email: "mandiradasgupta@hotmail.com",      phone: "9831106193" },
  { name: "Abhinibesh Chatterjee", email: "acbb258@gmail.com",               phone: "9830617414" },
  { name: "Abhijit Halder",       email: "drabhijit84@gmail.com",            phone: "9432163681" },
  { name: "Gouri Sankar Kamilya", email: "drgkamilya@gmail.com",             phone: "9433122643" },
  { name: "Sudip Basu",           email: "sbasu64@gmail.com",                phone: "9831592936" },
]
const GYNAE_EXAM_SESSION_CODES = ["G-D3-01", "G-D3-02", "G-D3-03", "G-D3-04"]

// ------------------------------------------------------------
const log = []
function L(msg) { log.push(msg); console.log(msg) }
function header(t) { L(""); L("=".repeat(72)); L(t); L("=".repeat(72)) }

async function fetchRegByRegNo(regNo) {
  const { data } = await supabase.from("registrations")
    .select("id, registration_number, attendee_name, attendee_email, attendee_phone")
    .eq("event_id", EVENT_ID).eq("registration_number", regNo).maybeSingle()
  return data
}
async function fetchRegByEmail(email) {
  const { data } = await supabase.from("registrations")
    .select("id, registration_number, attendee_name, attendee_email, attendee_phone")
    .eq("event_id", EVENT_ID).ilike("attendee_email", email).maybeSingle()
  return data
}
async function fetchRegByName(name) {
  const { data } = await supabase.from("registrations")
    .select("id, registration_number, attendee_name, attendee_email, attendee_phone")
    .eq("event_id", EVENT_ID).ilike("attendee_name", name).maybeSingle()
  return data
}

header(APPLY ? "APPLY MODE — changes WILL be written" : "DRY RUN — no DB writes")

// ----- A. Contact updates -----
header("A. Contact updates to existing Gynae faculty")
const aOps = []
for (const u of CONTACT_UPDATES) {
  const reg = await fetchRegByRegNo(u.reg)
  if (!reg) { L(`  ⚠ ${u.reg}: not found, skipping`); continue }
  const nameChanged  = reg.attendee_name !== u.name
  const emailChanged = (reg.attendee_email || "").toLowerCase() !== u.email.toLowerCase()
  const phoneChanged = (reg.attendee_phone || "") !== u.phone
  if (!nameChanged && !emailChanged && !phoneChanged) {
    L(`  ✓ ${u.reg} ${reg.attendee_name}: already up-to-date`)
    continue
  }
  L(`  ${u.reg} ${reg.attendee_name}`)
  if (nameChanged)  L(`     name:  "${reg.attendee_name}" → "${u.name}"`)
  if (emailChanged) L(`     email: "${reg.attendee_email}" → "${u.email}"`)
  if (phoneChanged) L(`     phone: "${reg.attendee_phone || ""}" → "${u.phone}"`)
  aOps.push({ regId: reg.id, oldName: reg.attendee_name, ...u })
}

if (APPLY) {
  for (const op of aOps) {
    const { error: e1 } = await supabase.from("registrations").update({
      attendee_name: op.name, attendee_email: op.email, attendee_phone: op.phone,
    }).eq("id", op.regId)
    if (e1) L(`     ✗ reg update failed: ${e1.message}`)

    // Cascade to faculty_assignments matching the OLD email or the old name
    const { data: assn } = await supabase.from("faculty_assignments")
      .select("id, faculty_name, faculty_email")
      .eq("event_id", EVENT_ID)
      .or(`faculty_email.eq.pending-${op.reg}@amasi.local,faculty_name.eq.${op.oldName}`)
    for (const a of assn || []) {
      const { error: e2 } = await supabase.from("faculty_assignments").update({
        faculty_name: op.name, faculty_email: op.email, faculty_phone: op.phone,
      }).eq("id", a.id)
      if (e2) L(`     ✗ assignment ${a.id} update failed: ${e2.message}`)
    }
    L(`     ✓ ${op.reg} updated (+${(assn || []).length} assignment(s))`)
  }
}

// ----- B. New faculty registrations -----
header("B. New faculty registrations")
const bOps = []
// We need a ticket_type_id for Faculty. Look up any existing 125 faculty reg to copy from.
const { data: anyFaculty } = await supabase.from("registrations")
  .select("ticket_type_id, registration_number")
  .eq("event_id", EVENT_ID)
  .like("registration_number", "125F2%")
  .limit(1)
  .maybeSingle()
const FACULTY_TICKET_TYPE_ID = anyFaculty?.ticket_type_id
L(`  Faculty ticket_type_id: ${FACULTY_TICKET_TYPE_ID}`)

// Find next available faculty reg number
const { data: maxReg } = await supabase.from("registrations")
  .select("registration_number")
  .eq("event_id", EVENT_ID)
  .like("registration_number", "125F2%")
  .order("registration_number", { ascending: false })
  .limit(1)
  .maybeSingle()
let nextSeq = maxReg ? parseInt(maxReg.registration_number.slice(4), 10) + 1 : 2045
L(`  Next faculty reg #: 125F${nextSeq}`)

for (const f of NEW_FACULTY) {
  const existing = await fetchRegByEmail(f.email) || await fetchRegByName(f.name)
  if (existing) {
    L(`  ✓ ${f.name}: already exists as ${existing.registration_number}`)
    continue
  }
  const regNo = `125F${nextSeq++}`
  L(`  + ${regNo}: ${f.name} <${f.email}> ${f.phone}`)
  bOps.push({ regNo, ...f })
}

if (APPLY) {
  for (const op of bOps) {
    const { error } = await supabase.from("registrations").insert({
      event_id: EVENT_ID,
      ticket_type_id: FACULTY_TICKET_TYPE_ID,
      registration_number: op.regNo,
      attendee_name: op.name,
      attendee_email: op.email,
      attendee_phone: op.phone,
      status: "confirmed",
      payment_status: "completed",
      unit_price: 0,
      tax_amount: 0,
      discount_amount: 0,
      total_amount: 0,
      currency: "INR",
      quantity: 1,
      participation_mode: "offline",
      confirmed_at: new Date().toISOString(),
      notes: "Faculty - Gynae, added from v-1 doc 2026-06-28",
    })
    if (error) L(`     ✗ insert failed for ${op.regNo}: ${error.message}`)
    else L(`     ✓ ${op.regNo} created`)
  }
}

// ----- C. Program changes -----
header("C. Session / program changes")

// C1: G-D1-07 — rename + speaker swap (Arnab Basak → Kamilya)
{
  const { data: sess } = await supabase.from("sessions")
    .select("id, session_name, speakers")
    .eq("event_id", EVENT_ID).eq("session_code", "G-D1-07").single()
  const newTopic = "Laparoscopic Sacro-colpopexy for vault prolapse"
  const newSpeakers = "Gouri Sankar Kamilya"
  L(`  G-D1-07:`)
  L(`     topic:    "${sess.session_name}" → "${newTopic}"`)
  L(`     speakers: "${sess.speakers}" → "${newSpeakers}"`)
  if (APPLY) {
    const { error } = await supabase.from("sessions").update({
      session_name: newTopic, speakers: newSpeakers,
      speakers_text: "Gouri Sankar Kamilya <drgkamilya@gmail.com>",
    }).eq("id", sess.id)
    if (error) L(`     ✗ update failed: ${error.message}`)
    else L(`     ✓ updated`)

    // Remove Arnab Basak's assignment for this session
    const { data: deleted, error: delErr } = await supabase.from("faculty_assignments")
      .delete().eq("event_id", EVENT_ID).eq("session_id", sess.id)
      .ilike("faculty_name", "Arnab Basak").select("id")
    if (delErr) L(`     ✗ delete Arnab Basak assignment failed: ${delErr.message}`)
    else L(`     ✓ removed ${deleted?.length || 0} Arnab Basak assignment(s) for G-D1-07`)

    // Insert Kamilya assignment
    const { error: insErr } = await supabase.from("faculty_assignments").insert({
      event_id: EVENT_ID, session_id: sess.id,
      faculty_name: "Gouri Sankar Kamilya",
      faculty_email: "drgkamilya@gmail.com",
      faculty_phone: "9433122643",
      role: "speaker", topic_title: newTopic, session_name: newTopic, status: "pending",
    })
    if (insErr) L(`     ✗ insert Kamilya failed: ${insErr.message}`)
    else L(`     ✓ inserted Kamilya as speaker`)
  }
}

// C2: G-D2-04 speakers field cascade (Zoha → Dr M M Samsuzzoha)
{
  const { data: sess } = await supabase.from("sessions")
    .select("id, session_name, speakers")
    .eq("event_id", EVENT_ID).eq("session_code", "G-D2-04").single()
  const newSpeakers = "Dr M M Samsuzzoha"
  L(`  G-D2-04 (TLH):`)
  L(`     speakers: "${sess.speakers}" → "${newSpeakers}"`)
  if (APPLY) {
    const { error } = await supabase.from("sessions").update({
      speakers: newSpeakers,
      speakers_text: "Dr M M Samsuzzoha <samzoha@hotmail.com>",
    }).eq("id", sess.id)
    if (error) L(`     ✗ update failed: ${error.message}`)
    else L(`     ✓ updated`)
  }
}

// C3: G-D2-06 — speaker change Abhijit Halder → Sudip Basu
{
  const { data: sess } = await supabase.from("sessions")
    .select("id, session_name, speakers")
    .eq("event_id", EVENT_ID).eq("session_code", "G-D2-06").single()
  const newSpeakers = "Sudip Basu"
  L(`  G-D2-06 (Hysteroscopic Myomectomy):`)
  L(`     speakers: "${sess.speakers}" → "${newSpeakers}"`)
  if (APPLY) {
    const { error } = await supabase.from("sessions").update({
      speakers: newSpeakers,
      speakers_text: "Sudip Basu <sbasu64@gmail.com>",
    }).eq("id", sess.id)
    if (error) L(`     ✗ update failed: ${error.message}`)
    else L(`     ✓ updated`)

    // Remove Abhijit Halder's assignment for this session
    const { data: deleted, error: delErr } = await supabase.from("faculty_assignments")
      .delete().eq("event_id", EVENT_ID).eq("session_id", sess.id)
      .ilike("faculty_name", "Abhijit Halder").select("id")
    if (delErr) L(`     ✗ delete Abhijit Halder assignment failed: ${delErr.message}`)
    else L(`     ✓ removed ${deleted?.length || 0} Abhijit Halder assignment(s) for G-D2-06`)

    // Insert Sudip Basu
    const { error: insErr } = await supabase.from("faculty_assignments").insert({
      event_id: EVENT_ID, session_id: sess.id,
      faculty_name: "Sudip Basu",
      faculty_email: "sbasu64@gmail.com",
      faculty_phone: "9831592936",
      role: "speaker",
      topic_title: "Hysteroscopic Myomectomy & Septal Resection",
      session_name: "Hysteroscopic Myomectomy & Septal Resection",
      status: "pending",
    })
    if (insErr) L(`     ✗ insert Sudip Basu failed: ${insErr.message}`)
    else L(`     ✓ inserted Sudip Basu as speaker`)
  }
}

// C4: FMAS exam faculty assignments (G-D3-01..04)
header("C4. FMAS examiners on G-D3-01..04")
{
  const { data: examSessions } = await supabase.from("sessions")
    .select("id, session_code, session_name")
    .eq("event_id", EVENT_ID).in("session_code", GYNAE_EXAM_SESSION_CODES)
  L(`  ${examSessions.length} exam sessions found`)
  const examinerRows = []
  for (const s of examSessions) {
    for (const ex of FMAS_EXAMINERS) {
      examinerRows.push({
        event_id: EVENT_ID, session_id: s.id,
        faculty_name: ex.name, faculty_email: ex.email, faculty_phone: ex.phone,
        role: "chairperson", topic_title: s.session_name, session_name: s.session_name,
        status: "pending",
      })
    }
  }
  L(`  ${examinerRows.length} examiner assignments to ensure`)

  // Skip rows that already exist (by session_id + faculty_email + role)
  const { data: existing } = await supabase.from("faculty_assignments")
    .select("session_id, faculty_email, role")
    .eq("event_id", EVENT_ID).eq("role", "chairperson")
    .in("session_id", examSessions.map(s => s.id))
  const have = new Set((existing || []).map(r => `${r.session_id}|${r.faculty_email.toLowerCase()}`))
  const toInsert = examinerRows.filter(r => !have.has(`${r.session_id}|${r.faculty_email.toLowerCase()}`))
  L(`  ${toInsert.length} new examiner assignments after dedupe`)

  if (APPLY && toInsert.length) {
    const { error } = await supabase.from("faculty_assignments").insert(toInsert)
    if (error) L(`     ✗ insert examiners failed: ${error.message}`)
    else L(`     ✓ inserted ${toInsert.length} examiner assignments`)
  }
}

header(APPLY ? "DONE (apply)" : "DRY RUN COMPLETE — re-run with --apply to write")
