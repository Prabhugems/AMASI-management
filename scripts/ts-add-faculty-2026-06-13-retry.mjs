#!/usr/bin/env node
/**
 * Retry of 2 faculty inserts after the 2026-06-13 batch hit a stale
 * event_settings.current_faculty_registration_number (said 1174, but
 * TECH-F-1175/1176 already existed). This time we compute the real max
 * from registrations.registration_number directly, then bump from there.
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

const FACULTY = [
  { name: "Vimalakar Reddy", phone: "8220721103", email: "vimalakarreddy@gmail.com" },
  { name: "Ameet Kumar",     phone: "6002092231", email: "docam@rediffmail.com" },
]

function normalisePhone(v) {
  if (!v) return null
  return String(v).replace(/[^0-9]/g, "") || null
}

// --- Real max TECH-F-XXXX in DB ---
const { data: facRows, error: fErr } = await db
  .from("registrations")
  .select("registration_number")
  .eq("event_id", EVENT_ID)
  .like("registration_number", "TECH-F-%")
if (fErr) { console.error("max-read err:", fErr); process.exit(1) }

let maxNum = 0
for (const r of facRows || []) {
  const m = /^TECH-F-(\d+)$/.exec(r.registration_number || "")
  if (m) maxNum = Math.max(maxNum, Number(m[1]))
}
console.log(`Real max TECH-F number in DB: ${maxNum} (next mint = ${maxNum + 1})`)

// --- Resolve badge template ---
async function resolveBadgeTemplateId(ticketTypeId) {
  const { data: specific } = await db
    .from("badge_templates")
    .select("id, name")
    .eq("event_id", EVENT_ID)
    .contains("ticket_type_ids", [ticketTypeId])
    .limit(1)
  if (specific?.[0]) return specific[0]
  const { data: def } = await db
    .from("badge_templates")
    .select("id, name")
    .eq("event_id", EVENT_ID)
    .eq("is_default", true)
    .limit(1)
  return def?.[0] || null
}
const facultyBadgeTpl = await resolveBadgeTemplateId(FACULTY_TICKET_ID)
console.log(`Badge template (faculty): ${facultyBadgeTpl ? `${facultyBadgeTpl.name} [${facultyBadgeTpl.id}]` : "(none — will skip auto-ready)"}`)

// --- Dup check by email ---
const allEmails = FACULTY.map(r => r.email.trim().toLowerCase())
const { data: dupRows } = await db
  .from("registrations")
  .select("attendee_email")
  .eq("event_id", EVENT_ID)
  .in("attendee_email", allEmails)
const dupSet = new Set((dupRows || []).map(r => (r.attendee_email || "").toLowerCase()))
if (dupSet.size) {
  console.log("\nFound duplicates — will skip:")
  for (const e of dupSet) console.log(`  · ${e}`)
}

const nowIso = new Date().toISOString()
let counter = maxNum
const results = { inserted: 0, skipped: 0, failed: 0 }

console.log("\n--- FACULTY ---")
for (const f of FACULTY) {
  const email = f.email.trim().toLowerCase()
  if (dupSet.has(email)) {
    results.skipped++
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
    results.failed++
    console.log(`  ✗ ${f.name} <${email}>: ${error.message}`)
  } else {
    counter = nextNum
    results.inserted++
    console.log(`  ✓ ${regNumber}  ${f.name}  <${email}>${facultyBadgeTpl ? "  [badge ready]" : ""}`)
  }
}

if (results.inserted > 0) {
  const { error: cErr } = await db
    .from("event_settings")
    .update({ current_faculty_registration_number: counter })
    .eq("event_id", EVENT_ID)
  if (cErr) console.log(`  ! failed to bump counter: ${cErr.message}`)
  else console.log(`✓ event_settings.current_faculty_registration_number → ${counter}`)

  const { data: t } = await db
    .from("ticket_types")
    .select("quantity_sold, name")
    .eq("id", FACULTY_TICKET_ID)
    .single()
  const next = (t?.quantity_sold || 0) + results.inserted
  await db.from("ticket_types").update({ quantity_sold: next }).eq("id", FACULTY_TICKET_ID)
  console.log(`✓ ticket "${t?.name}" quantity_sold → ${next}`)

  if (facultyBadgeTpl) {
    const { data: row } = await db
      .from("badge_templates")
      .select("badges_generated_count, name")
      .eq("id", facultyBadgeTpl.id)
      .single()
    const nextBadge = (row?.badges_generated_count || 0) + results.inserted
    await db.from("badge_templates").update({ badges_generated_count: nextBadge }).eq("id", facultyBadgeTpl.id)
    console.log(`✓ badge template "${row?.name}" badges_generated_count → ${nextBadge}`)
  }
}

console.log("\n--- SUMMARY ---")
console.log(`Faculty: inserted=${results.inserted}  skipped=${results.skipped}  failed=${results.failed}`)
