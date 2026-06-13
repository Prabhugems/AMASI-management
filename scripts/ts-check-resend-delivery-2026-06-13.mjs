#!/usr/bin/env node
/**
 * Check actual delivery status of the 174 welcome emails sent today
 * (2026-06-13) via Resend. "sent" in our message_logs just means Resend
 * accepted the request — it does NOT mean delivered. This script asks Resend
 * for each message's last_event and groups them so we can see bounces /
 * delivered_delayed / complained / etc.
 */
import fs from "node:fs"
import { Resend } from "resend"
import { createClient } from "@supabase/supabase-js"

function loadEnv(file) {
  const env = {}
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
  }
  return env
}
const amasiEnv = loadEnv("/Users/prabhubalasubramaniam/AMASI-management/.env.local")
const tsEnv = loadEnv("/Users/prabhubalasubramaniam/AMASI-management/.env.technosurg.local")

const resend = new Resend(amasiEnv.RESEND_API_KEY)
const db = createClient(tsEnv.NEXT_PUBLIC_SUPABASE_URL, tsEnv.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const EVENT_ID = "87c614b3-ff23-47c5-8682-87ea32aa77b9"
const SINCE = "2026-06-13T00:00:00Z" // today's batch only

// Pull today's sent emails from message_logs
const { data: logs, error } = await db
  .from("message_logs")
  .select("id, registration_id, recipient, recipient_name, provider_message_id, sent_at")
  .eq("event_id", EVENT_ID)
  .eq("channel", "email")
  .eq("status", "sent")
  .gte("sent_at", SINCE)
  .not("provider_message_id", "is", null)
  .order("sent_at", { ascending: true })
if (error) { console.error(error); process.exit(1) }

console.log(`Found ${logs.length} sent email logs since ${SINCE}\n`)

const byStatus = new Map()
const detail = []

for (let i = 0; i < logs.length; i++) {
  const l = logs[i]
  let last_event = "(error)"
  let extra = ""
  try {
    const res = await resend.emails.get(l.provider_message_id)
    if (res?.error) {
      last_event = `error: ${res.error.message || JSON.stringify(res.error)}`
    } else {
      const d = res.data || res
      last_event = d.last_event || d.status || "(unknown)"
      if (d.to) extra = ` to=${JSON.stringify(d.to)}`
    }
  } catch (e) {
    last_event = `exception: ${e.message}`
  }
  byStatus.set(last_event, (byStatus.get(last_event) || 0) + 1)
  detail.push({ rec: l.recipient, name: l.recipient_name, id: l.provider_message_id, last_event })
  if ((i + 1) % 25 === 0) console.log(`  ... ${i + 1}/${logs.length}`)
  await new Promise(r => setTimeout(r, 550)) // <2 req/s to stay under Resend limit
}

console.log("\n--- Status counts ---")
for (const [k, v] of [...byStatus.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(28)} ${v}`)
}

const nonDelivered = detail.filter(d => d.last_event !== "delivered")
if (nonDelivered.length) {
  console.log(`\n--- Non-"delivered" (${nonDelivered.length}) ---`)
  for (const d of nonDelivered) {
    console.log(`  [${d.last_event}]  ${d.name}  <${d.rec}>  id=${d.id}`)
  }
}
