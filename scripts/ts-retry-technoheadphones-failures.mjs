#!/usr/bin/env node
/**
 * Re-send the `technoheadphones` template to recipients whose first send failed
 * (per Qikchat DLR). Skips anyone whose latest status was delivered/read/sent.
 * Dry-run by default; pass --live.
 */
import fs from "node:fs"
import { createClient } from "@supabase/supabase-js"

const LIVE = process.argv.includes("--live")
const env = {}
for (const line of fs.readFileSync("/Users/prabhubalasubramaniam/AMASI-management/.env.technosurg.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const EVENT_ID = "87c614b3-ff23-47c5-8682-87ea32aa77b9"
const QIKCHAT_URL = "https://api.qikchat.in/v1/messages"
const TEMPLATE_NAME = "technoheadphones"
const PROGRAM_LINK = "https://acesse.one/hms9lm6"

function formatPhone(phone) {
  let cleaned = String(phone || "").replace(/[^0-9]/g, "")
  cleaned = cleaned.replace(/^0+/, "")
  if (cleaned.length === 10) cleaned = "91" + cleaned
  return cleaned
}

// Step 1: gather the provider_message_ids for the recent technoheadphones blast
let logs = []
let from = 0
while (true) {
  const { data, error } = await db.from("message_logs")
    .select("id, registration_id, recipient, recipient_name, provider_message_id, sent_at")
    .eq("event_id", EVENT_ID)
    .eq("status", "sent")
    .ilike("message_body", "%technoheadphones%")
    .order("sent_at", { ascending: true })
    .range(from, from + 999)
  if (error) throw error
  logs = logs.concat(data || [])
  if (!data || data.length < 1000) break
  from += 1000
}

// Step 2: poll Qikchat for each to find the failures
console.log(`Polling ${logs.length} messages to find failures...`)
const failures = []
let i = 0
for (const log of logs) {
  i++
  const res = await fetch(`${QIKCHAT_URL}?msgid=${log.provider_message_id}`, {
    headers: { "QIKCHAT-API-KEY": env.QIKCHAT_API_KEY },
  })
  const json = await res.json().catch(() => ({}))
  const status = json?.message?.payload?.message?.status
  if (status === "failed") failures.push(log)
  if (i % 100 === 0) console.log(`  [${i}/${logs.length}] failures so far: ${failures.length}`)
  await new Promise(r => setTimeout(r, 40))
}
console.log(`\n${failures.length} failed sends found.`)

// Step 3: get current attendee_phone (in case it was updated) and build retry list
const regIds = [...new Set(failures.map(f => f.registration_id))].filter(Boolean)
const { data: regs } = await db.from("registrations")
  .select("id, registration_number, attendee_name, attendee_phone")
  .in("id", regIds)
const regMap = new Map((regs || []).map(r => [r.id, r]))

const retryList = []
const seen = new Set()
for (const f of failures) {
  const reg = regMap.get(f.registration_id)
  const rawPhone = reg?.attendee_phone || f.recipient
  if (!rawPhone) continue
  const intl = formatPhone(rawPhone)
  // Basic sanity: Indian numbers should be 12 digits (91 + 10)
  if (intl.length < 11 || intl.length > 13) {
    console.log(`  ✗ skip bad phone: ${reg?.registration_number || f.registration_id} ${reg?.attendee_name || f.recipient_name} -> ${intl}`)
    continue
  }
  if (seen.has(intl)) continue
  seen.add(intl)
  retryList.push({
    id: f.id,
    registration_id: f.registration_id,
    registration_number: reg?.registration_number,
    attendee_name: reg?.attendee_name || f.recipient_name,
    attendee_phone: rawPhone,
    _intlPhone: intl,
  })
}

console.log(`Retry list: ${retryList.length} unique numbers to re-send.`)

if (!LIVE) {
  console.log("\nFirst 8:")
  for (const r of retryList.slice(0, 8)) {
    console.log(`  +${r._intlPhone}  ${r.registration_number}  ${r.attendee_name}`)
  }
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
    headers: { "Content-Type": "application/json", "QIKCHAT-API-KEY": env.QIKCHAT_API_KEY },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (res.ok && json.status === true) return { ok: true, id: json.data?.[0]?.id || "sent" }
  return { ok: false, error: json.message || `HTTP ${res.status}` }
}

console.log(`\n--- Retrying ${retryList.length} numbers ---`)
const summary = { sent: 0, failed: 0 }
let n = 0
for (const r of retryList) {
  n++
  const result = await sendTemplate(r)
  if (result.ok) {
    summary.sent++
    if (n % 50 === 0 || n === retryList.length) console.log(`  [${n}/${retryList.length}] sent=${summary.sent} failed=${summary.failed}`)
    await db.from("message_logs").insert({
      event_id: EVENT_ID,
      registration_id: r.registration_id,
      channel: "whatsapp",
      provider: "qikchat",
      recipient: r.attendee_phone,
      recipient_name: r.attendee_name,
      message_body: `Template: ${TEMPLATE_NAME} | link=${PROGRAM_LINK} | retry`,
      status: "sent",
      provider_message_id: result.id,
      sent_at: new Date().toISOString(),
    })
  } else {
    summary.failed++
    console.log(`  ✗ ${r.registration_number} ${r.attendee_name} +${r._intlPhone}: ${result.error}`)
  }
  await new Promise(r => setTimeout(r, 150))
}

console.log(`\nRETRY SUMMARY  api_accepted=${summary.sent}  api_rejected=${summary.failed}`)
console.log("Run ts-poll-technoheadphones-status.mjs again in ~1 min to see actual DLR.")
