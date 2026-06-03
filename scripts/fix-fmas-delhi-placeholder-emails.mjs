#!/usr/bin/env node
// Replace @placeholder.speaker emails on FMAS Delhi speaker registrations with the
// real email from the faculty master (matched by normalized name).

import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const EVENT_ID = "8e497ba9-f83b-4a66-9be5-1714f0d8669b"
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

function normalizeName(raw) {
  return (raw || "")
    .toLowerCase()
    .replace(/^(dr|prof|mr|mrs|ms|shri)\.?\s+/i, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const { data: regs } = await db
  .from("registrations")
  .select("id, attendee_name, attendee_email, attendee_phone")
  .eq("event_id", EVENT_ID)
  .ilike("attendee_email", "%@placeholder.speaker")

let updated = 0
const unmatched = []

for (const r of regs) {
  const key = normalizeName(r.attendee_name)
  // Faculty master is ~2k rows — name-based ilike per registration is cheaper than
  // paginating the whole table client-side.
  const { data: candidates } = await db
    .from("faculty")
    .select("id, name, email, phone")
    .ilike("name", `%${r.attendee_name}%`)
    .not("email", "is", null)
  const match = (candidates || []).find((f) => normalizeName(f.name) === key)
  if (!match) {
    unmatched.push(r.attendee_name)
    continue
  }
  if (DRY_RUN) {
    console.log(`  ${r.attendee_name}: ${r.attendee_email} -> ${match.email}`)
    updated++
    continue
  }
  const patch = {
    attendee_email: match.email,
    updated_at: new Date().toISOString(),
  }
  if (!r.attendee_phone && match.phone) patch.attendee_phone = match.phone
  const { error } = await db.from("registrations").update(patch).eq("id", r.id)
  if (error) {
    console.error(`Failed to update ${r.attendee_name}:`, error.message)
    continue
  }
  updated++
}

console.log(`\nUpdated ${updated}/${regs.length} registrations`)
if (unmatched.length) {
  console.log(`Unmatched (${unmatched.length}):`)
  for (const n of unmatched) console.log(" -", n)
}
