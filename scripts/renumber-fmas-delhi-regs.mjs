#!/usr/bin/env node
// Renumber FMAS Delhi registrations:
//   Chairpersons → 127F2001, 127F2002, ...
//   Speakers     → 127F3001, 127F3002, ...
// Ordering: by each person's earliest faculty_assignment session_date + start_time.

import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const EVENT_ID = "8e497ba9-f83b-4a66-9be5-1714f0d8669b"
const CHAIR_PREFIX = "127F2"
const SPEAKER_PREFIX = "127F3"
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

// Earliest assignment time per (role, normalized name)
const { data: asgns } = await db
  .from("faculty_assignments")
  .select("role,faculty_name,faculty_email,session_date,start_time")
  .eq("event_id", EVENT_ID)
const sortKeyByPerson = new Map()
for (const a of asgns) {
  const nameKey = normalize(a.faculty_name)
  const emailKey = (a.faculty_email || "").toLowerCase().trim()
  for (const key of [nameKey, emailKey].filter(Boolean)) {
    const k = `${a.role}|${key}`
    const t = `${a.session_date}T${a.start_time}`
    const prev = sortKeyByPerson.get(k)
    if (!prev || t < prev) sortKeyByPerson.set(k, t)
  }
}

// Helper: pick the earliest assignment time for a registration
function timeForReg(reg, role) {
  const byEmail = sortKeyByPerson.get(`${role}|${(reg.attendee_email || "").toLowerCase().trim()}`)
  if (byEmail) return byEmail
  const byName = sortKeyByPerson.get(`${role}|${normalize(reg.attendee_name)}`)
  return byName || "9999-99-99T99:99:99" // unmatched → push to end
}

const { data: regs } = await db
  .from("registrations")
  .select("id,attendee_name,attendee_email,attendee_designation,registration_number")
  .eq("event_id", EVENT_ID)

const chairs = regs.filter((r) => r.attendee_designation === "Chairperson")
const speakers = regs.filter((r) => r.attendee_designation === "Speaker")
const other = regs.filter(
  (r) => r.attendee_designation !== "Chairperson" && r.attendee_designation !== "Speaker"
)

chairs.sort((a, b) => {
  const t = timeForReg(a, "chairperson").localeCompare(timeForReg(b, "chairperson"))
  return t || a.attendee_name.localeCompare(b.attendee_name)
})
speakers.sort((a, b) => {
  const t = timeForReg(a, "speaker").localeCompare(timeForReg(b, "speaker"))
  return t || a.attendee_name.localeCompare(b.attendee_name)
})

function pad(n, width = 3) {
  return String(n).padStart(width, "0")
}

const plan = []
chairs.forEach((r, i) => {
  plan.push({
    id: r.id,
    name: r.attendee_name,
    old: r.registration_number,
    new: `${CHAIR_PREFIX}${pad(i + 1)}`,
  })
})
speakers.forEach((r, i) => {
  plan.push({
    id: r.id,
    name: r.attendee_name,
    old: r.registration_number,
    new: `${SPEAKER_PREFIX}${pad(i + 1)}`,
  })
})

console.log(`Chairs: ${chairs.length}  Speakers: ${speakers.length}  Other (untouched): ${other.length}`)
console.log("\n=== plan ===")
for (const p of plan) console.log(`  ${p.old.padEnd(20)} -> ${p.new}  ${p.name}`)

if (DRY_RUN) {
  console.log("\n(dry run — no changes made)")
  process.exit(0)
}

// Two-phase rename to dodge any UNIQUE constraint on registration_number:
// phase 1 -> temp tag, phase 2 -> final number.
const stamp = Date.now()
for (const p of plan) {
  await db
    .from("registrations")
    .update({ registration_number: `TMP-${stamp}-${p.id.slice(0, 8)}` })
    .eq("id", p.id)
}
let updated = 0
const errors = []
for (const p of plan) {
  const { error } = await db
    .from("registrations")
    .update({ registration_number: p.new, updated_at: new Date().toISOString() })
    .eq("id", p.id)
  if (error) errors.push({ name: p.name, error: error.message })
  else updated++
}
console.log(`\nRenumbered ${updated}/${plan.length} registrations`)
if (errors.length) {
  console.log("Errors:")
  for (const e of errors) console.log(" -", e.name, e.error)
}
