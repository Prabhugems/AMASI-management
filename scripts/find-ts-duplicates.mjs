#!/usr/bin/env node
import fs from "node:fs"
import { createClient } from "@supabase/supabase-js"

const env = {}
for (const line of fs.readFileSync(
  "/Users/prabhubalasubramaniam/AMASI-management/.env.technosurg.local",
  "utf8"
).split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const EVENT_ID = "87c614b3-ff23-47c5-8682-87ea32aa77b9"

const { data: regs } = await db
  .from("registrations")
  .select("id, registration_number, attendee_name, attendee_email, attendee_phone, status, ticket_type:ticket_types(name), created_at")
  .eq("event_id", EVENT_ID)
  .order("created_at", { ascending: true })

console.log(`Total registrations: ${regs.length}`)

// Group by normalised email
const byEmail = new Map()
for (const r of regs) {
  const k = (r.attendee_email || "").toLowerCase().trim()
  if (!k) continue
  if (!byEmail.has(k)) byEmail.set(k, [])
  byEmail.get(k).push(r)
}

const dupEmails = [...byEmail.entries()].filter(([, v]) => v.length > 1)
console.log(`\nDuplicate emails: ${dupEmails.length}`)
for (const [email, rows] of dupEmails) {
  console.log(`\n${email} (${rows.length} rows):`)
  for (const r of rows) {
    console.log(`  ${r.registration_number} | ${r.attendee_name} | ${r.ticket_type?.name || "?"} | ${r.status} | ${r.created_at}`)
  }
}

// Also check phone duplicates
const byPhone = new Map()
for (const r of regs) {
  let k = (r.attendee_phone || "").replace(/[^0-9]/g, "")
  if (!k) continue
  if (k.length === 12 && k.startsWith("91")) k = k.slice(2) // normalise 91xxx → xxx for comparison
  if (!byPhone.has(k)) byPhone.set(k, [])
  byPhone.get(k).push(r)
}

const dupPhones = [...byPhone.entries()].filter(([, v]) => v.length > 1)
console.log(`\nDuplicate phones: ${dupPhones.length}`)
for (const [phone, rows] of dupPhones) {
  // Skip if it's the same email duplicate already shown
  const emails = new Set(rows.map((r) => (r.attendee_email || "").toLowerCase()))
  if (emails.size === 1) continue
  console.log(`\n${phone} (${rows.length} rows, different emails):`)
  for (const r of rows) {
    console.log(`  ${r.registration_number} | ${r.attendee_name} | ${r.attendee_email} | ${r.ticket_type?.name || "?"} | ${r.status}`)
  }
}
