#!/usr/bin/env node
/**
 * One-off: configure faculty numbering for the TechnoSurg event and rename
 * the existing wrong record (P Senthilnathan → TECH-F-1001).
 *
 * Prereq: run the migration `20260605_faculty_registration_numbering.sql`
 * against the technosurg DB first. This script then:
 *   1. Sets faculty_registration_prefix='TECH-F-', start=1001, suffix=''
 *   2. Updates P Senthilnathan's registration_number to TECH-F-1001
 *   3. Sets current_faculty_registration_number = 1001 so the next faculty
 *      registration becomes TECH-F-1002.
 *
 * Run with: node scripts/setup-technosurg-faculty-numbering.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

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

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim()
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const TECHNOSURG_EVENT_ID = "87c614b3-ff23-47c5-8682-87ea32aa77b9"
const WRONG_REG_NUMBER = "Technosurg2026A1001"
const TARGET_REG_NUMBER = "TECH-F-1001"
const TARGET_EMAIL = "senthilnathan94@gmail.com"

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// --- Step 0: sanity check ---
const { data: event, error: eventErr } = await db
  .from("events")
  .select("id, name")
  .eq("id", TECHNOSURG_EVENT_ID)
  .maybeSingle()

if (eventErr || !event) {
  console.error("TechnoSurg event not found:", eventErr?.message)
  process.exit(1)
}
console.log(`Target event: ${event.name} (${event.id})`)

// --- Step 1: configure faculty numbering on event_settings ---
const { data: existingSettings, error: settingsReadErr } = await db
  .from("event_settings")
  .select("event_id, faculty_registration_prefix, current_faculty_registration_number")
  .eq("event_id", TECHNOSURG_EVENT_ID)
  .maybeSingle()

if (settingsReadErr) {
  console.error("event_settings read error:", settingsReadErr.message)
  process.exit(1)
}

if (!existingSettings) {
  console.error("No event_settings row for TechnoSurg event. Create one first via the admin UI.")
  process.exit(1)
}

const { error: settingsUpdateErr } = await db
  .from("event_settings")
  .update({
    faculty_registration_prefix: "TECH-F-",
    faculty_registration_start_number: 1001,
    faculty_registration_suffix: "",
    // Will set to 1001 after the rename so the next faculty becomes TECH-F-1002.
    current_faculty_registration_number: 1001,
  })
  .eq("event_id", TECHNOSURG_EVENT_ID)

if (settingsUpdateErr) {
  console.error("event_settings update error:", settingsUpdateErr.message)
  process.exit(1)
}
console.log("✓ event_settings: faculty_registration_prefix='TECH-F-', start=1001, counter=1001")

// --- Step 2: rename P Senthilnathan ---
const { data: existingReg, error: regReadErr } = await db
  .from("registrations")
  .select("id, registration_number, attendee_name, attendee_email")
  .eq("event_id", TECHNOSURG_EVENT_ID)
  .eq("registration_number", WRONG_REG_NUMBER)
  .maybeSingle()

if (regReadErr) {
  console.error("registrations read error:", regReadErr.message)
  process.exit(1)
}

if (!existingReg) {
  console.warn(`No registration found with number ${WRONG_REG_NUMBER}. Skipping rename.`)
  process.exit(0)
}

if (existingReg.attendee_email?.toLowerCase() !== TARGET_EMAIL.toLowerCase()) {
  console.error(
    `Refusing to rename: registration ${WRONG_REG_NUMBER} belongs to ${existingReg.attendee_email}, not ${TARGET_EMAIL}.`
  )
  process.exit(1)
}

// Make sure TARGET_REG_NUMBER isn't already taken by someone else.
const { data: collision } = await db
  .from("registrations")
  .select("id, attendee_name, attendee_email")
  .eq("registration_number", TARGET_REG_NUMBER)
  .maybeSingle()

if (collision && collision.id !== existingReg.id) {
  console.error(`Collision: ${TARGET_REG_NUMBER} is already used by ${collision.attendee_name} (${collision.attendee_email})`)
  process.exit(1)
}

const { error: renameErr } = await db
  .from("registrations")
  .update({ registration_number: TARGET_REG_NUMBER })
  .eq("id", existingReg.id)

if (renameErr) {
  console.error("rename error:", renameErr.message)
  process.exit(1)
}

console.log(`✓ Renamed ${existingReg.attendee_name} (${existingReg.attendee_email}): ${WRONG_REG_NUMBER} → ${TARGET_REG_NUMBER}`)
console.log("\nDone. Next faculty registration on TechnoSurg will be TECH-F-1002.")
