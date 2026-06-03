#!/usr/bin/env node
// Import the 126 FMAS Delhi Programme + Faculty from Airtable into the AMASI event.
// Event: 8e497ba9-f83b-4a66-9be5-1714f0d8669b
// Airtable base: appjYiLPVxEt3Dk1k, Programme table tblxzSjFmWGXJUd9i
//
// Source of Programme records is a pre-fetched JSON dump at /tmp/airtable-programme.json
// (see DUMP_PATH below). Each row becomes one `sessions` row + one `faculty_assignments`
// row (when faculty info is present). Faculty masters are upserted into the `faculty` table.

import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const EVENT_ID = "8e497ba9-f83b-4a66-9be5-1714f0d8669b"
const DUMP_PATH = "/tmp/airtable-programme.json"
const DRY_RUN = process.argv.includes("--dry-run")

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(envPath)) return
  const raw = fs.readFileSync(envPath, "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    const [, k, v] = m
    if (!process.env[k]) process.env[k] = v.replace(/^["']|["']$/g, "").trim()
  }
}
loadEnv()

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
  { auth: { persistSession: false } }
)

// ---------- helpers ----------

// Airtable stores wall-clock time in UTC; the event is in IST. Convert to IST.
function utcToIstParts(iso) {
  if (!iso) return null
  const d = new Date(iso)
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000)
  const yyyy = ist.getUTCFullYear()
  const mm = String(ist.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(ist.getUTCDate()).padStart(2, "0")
  const HH = String(ist.getUTCHours()).padStart(2, "0")
  const MM = String(ist.getUTCMinutes()).padStart(2, "0")
  return { date: `${yyyy}-${mm}-${dd}`, time: `${HH}:${MM}:00` }
}

function splitTitleAndName(raw) {
  if (!raw) return { title: null, name: "" }
  let name = raw.trim().replace(/\s+/g, " ")
  let title = null
  const m = name.match(/^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Shri\.?)\s+/i)
  if (m) {
    title = m[1].replace(/\.$/, "")
    name = name.slice(m[0].length).trim()
  }
  return { title, name }
}

function roleFromPost(post) {
  const p = (post || "").toLowerCase()
  if (p.includes("chair")) return "chairperson"
  if (p.includes("moderator")) return "moderator"
  if (p.includes("panel")) return "panelist"
  return "speaker"
}

function token32() {
  return crypto.randomBytes(16).toString("hex")
}

// ---------- load + normalize ----------

const dump = JSON.parse(fs.readFileSync(DUMP_PATH, "utf8"))
const FIELDS = {
  sno: "fldX5X0gzpH6Z6Xq2",
  date: "fld3t2qb8fNzaoh1o",
  start: "fld7YvEaE9hKqX9XY",
  end: "fldcawcB53TRDw7T1",
  topic: "fldJ6O7my6IBLZFvE",
  hall: "fldJuDEvU4atB3Rex",
  duration: "fldnNmZ2vQ35vsV2w",
  session: "fldO0k87eJxTWpXgC",
  post: "fldAGPC0fLNmoFlTP",
  fullName: "fldF4ySeCt8alyZ9Y",
  phoneLookup: "fldFlzREdjm9Flnip",
  emailLookup: "flduiF5zubxqsiIMb",
}

function firstLookup(value) {
  if (!value || !value.valuesByLinkedRecordId) return null
  const entries = Object.values(value.valuesByLinkedRecordId)
  if (!entries.length) return null
  const arr = entries[0]
  if (!Array.isArray(arr) || !arr.length) return null
  return arr[0]
}

const rows = []
for (const rec of dump.records) {
  const c = rec.cellValuesByFieldId
  if (c[FIELDS.sno] == null) continue // skip blank rows
  const startParts = utcToIstParts(c[FIELDS.start])
  const endParts = utcToIstParts(c[FIELDS.end])
  if (!startParts) continue
  rows.push({
    sno: c[FIELDS.sno],
    date: c[FIELDS.date] || startParts.date,
    start_time: startParts.time,
    end_time: endParts ? endParts.time : startParts.time,
    duration_minutes: c[FIELDS.duration] || null,
    topic: (c[FIELDS.topic] || "").trim(),
    hall: c[FIELDS.hall] || null,
    session_group: c[FIELDS.session]?.name || null, // "Session 1" etc.
    post: c[FIELDS.post]?.name || null,
    rawName: (c[FIELDS.fullName] || "").trim(),
    email: (firstLookup(c[FIELDS.emailLookup]) || "").toString().toLowerCase().trim(),
    phone: (() => {
      const v = firstLookup(c[FIELDS.phoneLookup])
      if (v == null) return null
      const s = String(v).trim()
      return s || null
    })(),
  })
}

rows.sort((a, b) => a.sno - b.sno)
console.log(`Loaded ${rows.length} programme entries`)

// ---------- 1. upsert faculty masters ----------

const facultyByEmail = new Map()
for (const r of rows) {
  if (!r.email || !r.email.includes("@")) continue
  const { title, name } = splitTitleAndName(r.rawName)
  if (!name) continue
  const existing = facultyByEmail.get(r.email)
  facultyByEmail.set(r.email, {
    name,
    title: title || existing?.title || null,
    email: r.email,
    phone: r.phone || existing?.phone || null,
  })
}

console.log(`${facultyByEmail.size} unique faculty (by email)`)

const facultyIdByEmail = new Map()
let facultyCreated = 0
let facultyUpdated = 0

if (!DRY_RUN) {
  for (const f of facultyByEmail.values()) {
    const { data: existing } = await db
      .from("faculty")
      .select("id, phone, title")
      .eq("email", f.email)
      .maybeSingle()

    if (existing) {
      facultyIdByEmail.set(f.email, existing.id)
      const patch = {}
      if (!existing.phone && f.phone) patch.phone = f.phone
      if (!existing.title && f.title) patch.title = f.title
      if (Object.keys(patch).length) {
        patch.updated_at = new Date().toISOString()
        await db.from("faculty").update(patch).eq("id", existing.id)
        facultyUpdated++
      }
    } else {
      const { data: inserted, error } = await db
        .from("faculty")
        .insert({
          name: f.name,
          title: f.title,
          email: f.email,
          phone: f.phone,
          country: "India",
          status: "active",
          total_events: 0,
          total_sessions: 0,
        })
        .select("id")
        .single()
      if (error) {
        console.error(`Faculty insert failed for ${f.email}:`, error.message)
        continue
      }
      facultyIdByEmail.set(f.email, inserted.id)
      facultyCreated++
    }
  }
}

console.log(`Faculty: created=${facultyCreated} updated=${facultyUpdated}`)

// ---------- 2. group rows into sessions (one session per topic block) ----------
// Group key: date|start|hall|topic. Multiple faculty on the same slot → one session,
// multiple faculty_assignments. This mirrors how the existing /api/program/import-json
// route groups (it groups speakers when the same topic has multiple lecturers).

const sessionMap = new Map()
for (const r of rows) {
  const key = `${r.date}|${r.start_time}|${r.hall || ""}|${r.topic}`
  if (!sessionMap.has(key)) {
    sessionMap.set(key, {
      key,
      session_name: r.topic || `${r.session_group || "Session"} – ${r.sno}`,
      session_type: "lecture",
      session_date: r.date,
      start_time: r.start_time,
      end_time: r.end_time,
      duration_minutes: r.duration_minutes,
      hall: r.hall,
      specialty_track: r.hall === "Gynae Hall" ? "Gynaecology" : null,
      session_code: r.session_group || null,
      assignments: [],
    })
  }
  const s = sessionMap.get(key)
  // Skip rows where only a title remains (e.g. "Dr", "Dr.") — these are
  // intentionally empty in Airtable (TBA faculty).
  const stripped = r.rawName.replace(/^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Shri\.?)\s*$/i, "").trim()
  if (stripped) {
    s.assignments.push({
      faculty_name: r.rawName,
      faculty_email: r.email || null,
      faculty_phone: r.phone || null,
      role: roleFromPost(r.post),
    })
  }
}

const sessions = Array.from(sessionMap.values())
console.log(`Will create ${sessions.length} unique sessions, ${sessions.reduce((n, s) => n + s.assignments.length, 0)} faculty assignments`)

if (DRY_RUN) {
  console.log("\n--- DRY RUN preview (first 5) ---")
  for (const s of sessions.slice(0, 5)) {
    console.log(JSON.stringify({ ...s, key: undefined }, null, 2))
  }
  console.log("...")
  process.exit(0)
}

// ---------- 3. insert sessions + faculty_assignments ----------

let sessionsInserted = 0
let assignmentsInserted = 0
const errors = []

for (const s of sessions) {
  const speakerNames = s.assignments
    .filter((a) => a.role === "speaker")
    .map((a) => a.faculty_name)
  const moderatorNames = s.assignments
    .filter((a) => a.role === "moderator")
    .map((a) => a.faculty_name)
  const chairNames = s.assignments
    .filter((a) => a.role === "chairperson")
    .map((a) => a.faculty_name)

  const description = s.assignments.length
    ? s.assignments.map((a) => `${a.faculty_name} (${a.role})`).join(", ")
    : null

  const { data: inserted, error } = await db
    .from("sessions")
    .insert({
      event_id: EVENT_ID,
      session_name: s.session_name,
      session_code: s.session_code,
      session_type: s.session_type,
      session_date: s.session_date,
      start_time: s.start_time,
      end_time: s.end_time,
      duration_minutes: s.duration_minutes,
      hall: s.hall,
      specialty_track: s.specialty_track,
      description,
      speakers: speakerNames.length ? speakerNames.join(", ") : null,
      chairpersons: chairNames.length ? chairNames.join(", ") : null,
      moderators: moderatorNames.length ? moderatorNames.join(", ") : null,
      status: "scheduled",
    })
    .select("id")
    .single()

  if (error) {
    errors.push({ session: s.session_name, error: error.message })
    continue
  }
  sessionsInserted++

  for (const a of s.assignments) {
    const { error: aErr } = await db.from("faculty_assignments").insert({
      event_id: EVENT_ID,
      session_id: inserted.id,
      faculty_id: a.faculty_email ? facultyIdByEmail.get(a.faculty_email) || null : null,
      faculty_name: a.faculty_name,
      faculty_email: a.faculty_email,
      faculty_phone: a.faculty_phone,
      role: a.role,
      topic_title: s.session_name,
      session_date: s.session_date,
      start_time: s.start_time,
      end_time: s.end_time,
      hall: s.hall,
      session_name: s.session_name,
      invitation_token: token32(),
      status: "pending",
    })
    if (aErr) {
      errors.push({ session: s.session_name, faculty: a.faculty_name, error: aErr.message })
    } else {
      assignmentsInserted++
    }
  }
}

console.log(`\nDone. sessions=${sessionsInserted}/${sessions.length}, assignments=${assignmentsInserted}`)
if (errors.length) {
  console.log(`Errors (${errors.length}):`)
  for (const e of errors.slice(0, 20)) console.log(" -", JSON.stringify(e))
}
