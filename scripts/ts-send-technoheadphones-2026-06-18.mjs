#!/usr/bin/env node
/**
 * Send approved Qikchat template `technoheadphones` to all confirmed TechnoSurg
 * registrations EXCEPT Exhibitors and Testing.
 * Template param {{1}} = program link.
 * Dry-run by default; pass --live.
 */
import fs from "node:fs"
import { createClient } from "@supabase/supabase-js"

const LIVE = process.argv.includes("--live")
const SAMPLE = process.argv.includes("--sample")

function loadEnv(file) {
  const env = {}
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
  }
  return env
}
const tsEnv = loadEnv("/Users/prabhubalasubramaniam/AMASI-management/.env.technosurg.local")
const db = createClient(tsEnv.NEXT_PUBLIC_SUPABASE_URL, tsEnv.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const EVENT_ID = "87c614b3-ff23-47c5-8682-87ea32aa77b9"
const QIKCHAT_URL = "https://api.qikchat.in/v1/messages"
const TEMPLATE_NAME = "technoheadphones"
const PROGRAM_LINK = "https://acesse.one/hms9lm6"

const EXCLUDE_TICKET_IDS = [
  "53fdd5d0-19da-4c0f-ad30-53702c2494a7", // Exhibitors
  "50455ee7-a1fd-4814-8e9e-5508ae44b855", // Testing
]

function formatPhone(phone) {
  let cleaned = String(phone || "").replace(/[^0-9]/g, "")
  // Strip leading zeros (e.g. "09447333551" → "9447333551")
  cleaned = cleaned.replace(/^0+/, "")
  if (cleaned.length === 10) cleaned = "91" + cleaned
  return cleaned
}

// Page through all confirmed regs (Supabase caps at 1000 by default)
async function fetchAllTargets() {
  const PAGE = 1000
  let all = []
  let from = 0
  while (true) {
    const { data, error } = await db
      .from("registrations")
      .select("id, registration_number, attendee_name, attendee_phone, ticket_type_id, ticket_types(name)")
      .eq("event_id", EVENT_ID)
      .eq("status", "confirmed")
      .not("ticket_type_id", "in", `(${EXCLUDE_TICKET_IDS.join(",")})`)
      .order("registration_number", { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    all = all.concat(data || [])
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return all
}

const regs = await fetchAllTargets()

// Dedupe by phone — many faculty/delegates can share phones if mis-typed, and
// we don't want to spam the same number twice.
const seenPhones = new Set()
const withPhone = []
const noPhone = []
for (const r of regs) {
  if (!r.attendee_phone) { noPhone.push(r); continue }
  const p = formatPhone(r.attendee_phone)
  if (seenPhones.has(p)) continue
  seenPhones.add(p)
  withPhone.push({ ...r, _intlPhone: p })
}

const byTicket = {}
for (const r of regs) {
  const tn = r.ticket_types?.name || "?"
  byTicket[tn] = (byTicket[tn] || 0) + 1
}

console.log(`Mode:                 ${LIVE ? "LIVE" : "DRY RUN"}`)
console.log(`Total confirmed regs: ${regs.length}`)
console.log(`Unique phones:        ${withPhone.length}`)
console.log(`No phone (skipped):   ${noPhone.length}\n`)
console.log("By ticket type:")
for (const [name, n] of Object.entries(byTicket).sort((a, b) => b[1] - a[1])) {
  console.log(`  · ${String(n).padStart(4)}  ${name}`)
}

if (SAMPLE || !LIVE) {
  console.log("\nFirst 10 recipients:")
  for (const r of withPhone.slice(0, 10)) {
    console.log(`  +${r._intlPhone}  ${r.registration_number}  ${r.attendee_name}  [${r.ticket_types?.name}]`)
  }
}

if (noPhone.length) {
  console.log(`\n${noPhone.length} skipped (no phone):`)
  for (const r of noPhone.slice(0, 8)) {
    console.log(`  · ${r.registration_number}  ${r.attendee_name}  [${r.ticket_types?.name}]`)
  }
  if (noPhone.length > 8) console.log(`  ... +${noPhone.length - 8} more`)
}

if (!LIVE) {
  console.log("\nDry-run. Pass --live to send.")
  process.exit(0)
}

async function sendTemplate(r) {
  const body = {
    to_contact: r._intlPhone,
    type: "template",
    template: {
      name: TEMPLATE_NAME,
      language: "en",
      components: [{
        type: "body",
        parameters: [{ type: "text", text: PROGRAM_LINK }],
      }],
    },
  }
  const res = await fetch(QIKCHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "QIKCHAT-API-KEY": tsEnv.QIKCHAT_API_KEY },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (res.ok && json.status === true) return { ok: true, id: json.data?.[0]?.id || "sent" }
  return { ok: false, error: json.message || `HTTP ${res.status}` }
}

console.log(`\n--- Sending to ${withPhone.length} numbers ---`)
const summary = { sent: 0, failed: 0 }
let i = 0
for (const r of withPhone) {
  i++
  const result = await sendTemplate(r)
  if (result.ok) {
    summary.sent++
    if (i % 50 === 0 || i === withPhone.length) console.log(`  [${i}/${withPhone.length}] sent=${summary.sent} failed=${summary.failed}`)
    await db.from("message_logs").insert({
      event_id: EVENT_ID,
      registration_id: r.id,
      channel: "whatsapp",
      provider: "qikchat",
      recipient: r.attendee_phone,
      recipient_name: r.attendee_name,
      message_body: `Template: ${TEMPLATE_NAME} | link=${PROGRAM_LINK}`,
      status: "sent",
      provider_message_id: result.id,
      sent_at: new Date().toISOString(),
    })
  } else {
    summary.failed++
    console.log(`  ✗ ${r.registration_number}  ${r.attendee_name}  +${r._intlPhone}: ${result.error}`)
    await db.from("message_logs").insert({
      event_id: EVENT_ID,
      registration_id: r.id,
      channel: "whatsapp",
      provider: "qikchat",
      recipient: r.attendee_phone,
      recipient_name: r.attendee_name,
      message_body: `Template: ${TEMPLATE_NAME} | link=${PROGRAM_LINK}`,
      status: "failed",
      error_message: result.error,
      failed_at: new Date().toISOString(),
    })
  }
  await new Promise(r => setTimeout(r, 150))
}

console.log(`\nSUMMARY  sent=${summary.sent}  failed=${summary.failed}`)
