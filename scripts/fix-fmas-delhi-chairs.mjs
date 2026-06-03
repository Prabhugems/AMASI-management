#!/usr/bin/env node
// Convert the 9 standalone "Chairperson - Session N" session rows into chairperson
// assignments on the first lecture of each session group, then delete the standalone rows.

import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const EVENT_ID = "8e497ba9-f83b-4a66-9be5-1714f0d8669b"

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

const { data: chairSessions } = await db
  .from("sessions")
  .select("id,session_code,session_date,start_time,end_time,hall")
  .eq("event_id", EVENT_ID)
  .ilike("session_name", "Chairperson - %")

const { data: allSessions } = await db
  .from("sessions")
  .select("id,session_name,session_code,session_date,start_time")
  .eq("event_id", EVENT_ID)
  .order("session_date")
  .order("start_time")

let moved = 0
let deleted = 0

for (const cs of chairSessions) {
  const target = allSessions.find(
    (s) =>
      s.id !== cs.id &&
      s.session_code === cs.session_code &&
      s.session_date === cs.session_date &&
      !s.session_name.startsWith("Chairperson - ")
  )
  if (!target) {
    console.log(`No lecture found for code=${cs.session_code} on ${cs.session_date}, skipping`)
    continue
  }

  // Move chair assignments off the standalone row onto the first lecture.
  const { data: chairs, error: aErr } = await db
    .from("faculty_assignments")
    .update({
      session_id: target.id,
      role: "chairperson",
      session_name: `${cs.session_code} – Chairperson`,
      topic_title: null,
      updated_at: new Date().toISOString(),
    })
    .eq("event_id", EVENT_ID)
    .eq("session_id", cs.id)
    .select("id")
  if (aErr) {
    console.error(`Failed to reassign chairs for ${cs.session_code}:`, aErr.message)
    continue
  }
  moved += chairs?.length || 0

  // Delete the now-empty standalone chair session.
  const { error: dErr } = await db.from("sessions").delete().eq("id", cs.id)
  if (dErr) {
    console.error(`Delete failed for chair session ${cs.session_code}:`, dErr.message)
    continue
  }
  deleted++
}

console.log(`Moved ${moved} chair assignments, deleted ${deleted} standalone chair sessions`)

// Summary
const { count: sCount } = await db
  .from("sessions")
  .select("id", { count: "exact", head: true })
  .eq("event_id", EVENT_ID)
const { count: cCount } = await db
  .from("faculty_assignments")
  .select("id", { count: "exact", head: true })
  .eq("event_id", EVENT_ID)
  .eq("role", "chairperson")
const { count: spCount } = await db
  .from("faculty_assignments")
  .select("id", { count: "exact", head: true })
  .eq("event_id", EVENT_ID)
  .eq("role", "speaker")
console.log(`Now: ${sCount} sessions, ${spCount} speakers, ${cCount} chairpersons`)
