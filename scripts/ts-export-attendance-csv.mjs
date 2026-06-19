#!/usr/bin/env node
/**
 * Export all confirmed TechnoSurg registrations to CSV for venue attendance.
 * Columns: Name, Phone, TNMC Registration, Day 1, Day 2 (Day 1/2 blank for manual marking).
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
const TNMC_FIELD_ID = "e6f89c4a-0de9-4f1b-a85e-99c099a09b41"
const OUT = path.join(process.cwd(), "technosurg-attendance.csv")

const PAGE = 1000
let all = []
let from = 0
for (;;) {
  const { data, error } = await db
    .from("registrations")
    .select("attendee_name, attendee_phone, custom_fields, registration_number")
    .eq("event_id", EVENT_ID)
    .eq("status", "confirmed")
    .range(from, from + PAGE - 1)
  if (error) { console.error(error.message); process.exit(1) }
  all.push(...data)
  if (data.length < PAGE) break
  from += PAGE
}

function csvCell(v) {
  const s = v == null ? "" : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

const rows = all
  .map(r => ({
    name: (r.attendee_name || "").trim(),
    phone: (r.attendee_phone || "").trim(),
    tnmc: (r.custom_fields?.[TNMC_FIELD_ID] || "").toString().trim(),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }))

const header = ["Name", "Phone", "TNMC Registration", "Day 1", "Day 2"]
const lines = [header.join(",")]
for (const r of rows) {
  lines.push([csvCell(r.name), csvCell(r.phone), csvCell(r.tnmc), "", ""].join(","))
}
fs.writeFileSync(OUT, lines.join("\n") + "\n", "utf8")

const tnmcFilled = rows.filter(r => r.tnmc).length
const phoneFilled = rows.filter(r => r.phone).length
console.log(`Wrote ${OUT}`)
console.log(`Rows: ${rows.length}`)
console.log(`  with phone: ${phoneFilled}`)
console.log(`  with TNMC reg: ${tnmcFilled}`)
