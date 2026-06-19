#!/usr/bin/env node
/**
 * One-off: backfill registrations.checked_in for attendees who received an
 * audio device via the audio-desk but weren't otherwise checked in.
 * Uses earliest audio_device_assignments.assigned_at as the check-in time.
 *
 * Use --apply to commit. Default is dry-run.
 */
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

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

// All audio assignments for this event
const { data: assignments, error } = await db
  .from("audio_device_assignments")
  .select("registration_id, assigned_at")
  .eq("event_id", EVENT_ID)
if (error) { console.error("✗", error.message); process.exit(1) }

// Earliest assignment per registration_id
const earliest = new Map()
for (const a of assignments || []) {
  const t = earliest.get(a.registration_id)
  if (!t || new Date(a.assigned_at) < new Date(t)) {
    earliest.set(a.registration_id, a.assigned_at)
  }
}
console.log(`audio_device_assignments: ${assignments.length}  distinct attendees: ${earliest.size}`)

// Load their current checked_in state
const ids = Array.from(earliest.keys())
const regs = []
for (let i = 0; i < ids.length; i += 200) {
  const slice = ids.slice(i, i + 200)
  const { data } = await db
    .from("registrations")
    .select("id, registration_number, attendee_name, checked_in, checked_in_at")
    .in("id", slice)
  regs.push(...(data || []))
}
const needsBackfill = regs.filter(r => !r.checked_in)
console.log(`already checked_in: ${regs.length - needsBackfill.length}  needs backfill: ${needsBackfill.length}`)

console.log(`\n--- ${APPLY ? "APPLYING" : "DRY RUN"} ---`)
const summary = { updated: 0, failed: 0 }
for (const r of needsBackfill) {
  const when = earliest.get(r.id)
  if (!APPLY) {
    console.log(`  • would mark ${r.registration_number}  ${r.attendee_name}  at ${when}`)
    summary.updated++
    continue
  }
  const { error: uErr } = await db
    .from("registrations")
    .update({ checked_in: true, checked_in_at: when })
    .eq("id", r.id)
    .eq("checked_in", false) // race-safe: only if still false
  if (uErr) {
    summary.failed++
    console.log(`  ✗ ${r.registration_number}: ${uErr.message}`)
  } else {
    summary.updated++
  }
}

console.log(`\nSUMMARY  updated=${summary.updated}  failed=${summary.failed}`)
if (!APPLY) console.log("\n(dry run — re-run with --apply to commit)")
