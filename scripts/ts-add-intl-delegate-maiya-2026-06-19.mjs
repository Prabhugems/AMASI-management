#!/usr/bin/env node
/**
 * One-off: register Maiya Gunasekera (Sri Lanka) as paid international delegate.
 * - Creates a reusable "International Delegate" ticket type (USD 200, tax 0%, hidden) if not present.
 * - Inserts registration with status=confirmed, payment_status=completed.
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
const REG_PREFIX = "Technosurg2026A"
const DELEGATE_FORM_ID = "c7b8bffc-5e05-40d7-b7e5-2819fc57f711"

const INTL_TICKET = {
  name: "International Delegate",
  price: 200,
  currency: "USD",
  status: "active",
  is_hidden: true,
  tax_percentage: 0,
  sort_order: 8,
  form_id: DELEGATE_FORM_ID,
  min_per_order: 1,
  max_per_order: 1,
}

const ATTENDEE = {
  name: "Maiya Gunasekera",
  email: "maiyagunasekera@gmail.com",
  phone: "94773555553",
  institution: null,
  designation: null,
  country: "Sri Lanka",
}

// 1. Find or plan creation of intl ticket
const { data: existingIntl } = await db
  .from("ticket_types")
  .select("id, name, price, currency, status, is_hidden")
  .eq("event_id", EVENT_ID)
  .eq("name", INTL_TICKET.name)
  .maybeSingle()

let ticketId = existingIntl?.id
if (existingIntl) {
  console.log(`Ticket already exists: ${existingIntl.id}  ${existingIntl.name}  ${existingIntl.currency} ${existingIntl.price}`)
} else {
  console.log(`Will create ticket: ${INTL_TICKET.name}  ${INTL_TICKET.currency} ${INTL_TICKET.price}  hidden=${INTL_TICKET.is_hidden}`)
}

// 2. Check duplicate registration by phone OR email
const { data: dups } = await db
  .from("registrations")
  .select("registration_number, attendee_name, attendee_phone, attendee_email")
  .eq("event_id", EVENT_ID)
  .or(`attendee_phone.eq.${ATTENDEE.phone},attendee_email.eq.${ATTENDEE.email}`)

if (dups?.length) {
  console.log("\n⚠️  Existing registration matched — aborting:")
  for (const d of dups) console.log(`  · ${d.registration_number}  ${d.attendee_name}  ph=${d.attendee_phone}  em=${d.attendee_email}`)
  process.exit(1)
}

// 3. Compute next reg number
const { data: maxRows } = await db
  .from("registrations")
  .select("registration_number")
  .eq("event_id", EVENT_ID)
  .ilike("registration_number", `${REG_PREFIX}%`)
  .order("registration_number", { ascending: false })
  .limit(1)
const maxN = maxRows?.[0]?.registration_number
  ? parseInt(maxRows[0].registration_number.slice(REG_PREFIX.length), 10) || 0
  : 0
const regNumber = `${REG_PREFIX}${maxN + 1}`
console.log(`Next reg number: ${regNumber}`)

console.log(`\n--- ${APPLY ? "APPLYING" : "DRY RUN"} ---`)
console.log(`  • attendee: ${ATTENDEE.name}  ph=${ATTENDEE.phone}  em=${ATTENDEE.email}  country=${ATTENDEE.country}`)
console.log(`  • ticket:   ${INTL_TICKET.currency} ${INTL_TICKET.price}  (paid offline → status=completed)`)

if (!APPLY) {
  console.log("\n(dry run — re-run with --apply to commit)")
  process.exit(0)
}

// 4. Create ticket if needed
if (!ticketId) {
  const { data: created, error: tErr } = await db
    .from("ticket_types")
    .insert({ event_id: EVENT_ID, ...INTL_TICKET })
    .select("id")
    .single()
  if (tErr) { console.error("✗ ticket create:", tErr.message); process.exit(1) }
  ticketId = created.id
  console.log(`  ✓ created ticket: ${ticketId}`)
}

// 5. Insert registration
const { error: rErr } = await db.from("registrations").insert({
  event_id: EVENT_ID,
  ticket_type_id: ticketId,
  registration_number: regNumber,
  attendee_name: ATTENDEE.name,
  attendee_email: ATTENDEE.email,
  attendee_phone: ATTENDEE.phone,
  attendee_institution: ATTENDEE.institution,
  attendee_designation: ATTENDEE.designation,
  status: "confirmed",
  payment_status: "completed",
  quantity: 1,
  unit_price: INTL_TICKET.price,
  total_amount: INTL_TICKET.price,
})
if (rErr) { console.error("✗ registration:", rErr.message); process.exit(1) }
console.log(`  ✓ ${regNumber}  ${ATTENDEE.name}`)
