#!/usr/bin/env node
/**
 * Disposable TEST registration for QA-verifying the print renderer — both
 * the existing 4x3 Brother Label flow (must stay unaffected) and the new
 * 62x86 Brother QL flow. Event: 127 FMAS Course. Using one synthetic
 * registration for all print-renderer QA means no real attendee's
 * checked_in/badge_printed flags are ever touched by this work.
 *
 * Default dry-run; pass --apply to write.
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

const EVENT_ID = "81d9da71-c745-4897-bb47-f363207a6223" // 127 FMAS Course
const TEST_EMAIL = "test-brother-ql-verify@internal.test"

console.log(APPLY ? "APPLY MODE — changes WILL be written" : "DRY RUN — no writes")

const { data: existingReg } = await supabase
  .from("registrations").select("id, registration_number")
  .eq("event_id", EVENT_ID).eq("attendee_email", TEST_EMAIL).maybeSingle()

if (existingReg) {
  console.log(`✓ Test registration already exists: ${existingReg.registration_number} — reusing`)
  process.exit(0)
}

const { data: anyTicketType } = await supabase
  .from("ticket_types").select("id, name").eq("event_id", EVENT_ID).limit(1).maybeSingle()
const { data: maxReg } = await supabase
  .from("registrations").select("registration_number")
  .eq("event_id", EVENT_ID).like("registration_number", "127A%")
  .order("registration_number", { ascending: false }).limit(1).maybeSingle()
const nextSeq = maxReg ? parseInt(maxReg.registration_number.slice(4), 10) + 1 : 1
const regNo = `127A${nextSeq}`

console.log(`+ ${regNo}: TEST Brother QL <${TEST_EMAIL}> (ticket type: ${anyTicketType?.name || "none found"})`)
if (APPLY) {
  const { data: inserted, error } = await supabase.from("registrations").insert({
    event_id: EVENT_ID,
    ticket_type_id: anyTicketType?.id || null,
    registration_number: regNo,
    attendee_name: "TEST Brother QL",
    attendee_email: TEST_EMAIL,
    attendee_designation: "QA Test",
    attendee_institution: "AMASI QA",
    status: "confirmed",
    payment_status: "completed",
    unit_price: 0, tax_amount: 0, discount_amount: 0, total_amount: 0,
    currency: "INR", quantity: 1,
    participation_mode: "offline",
    confirmed_at: new Date().toISOString(),
    notes: "DISPOSABLE — created for Brother QL/4x3 print-renderer QA. Safe to delete after verification.",
  }).select().single()
  if (error) { console.error("Registration insert failed:", error); process.exit(1) }
  console.log(`✓ created ${inserted.registration_number}`)
} else {
  console.log("(dry run — re-run with --apply to write)")
}
