#!/usr/bin/env node
/**
 * Poll Qikchat for delivery status of every technoheadphones message we sent
 * tonight, categorize, and write a CSV of failures.
 */
import fs from "node:fs"
import { createClient } from "@supabase/supabase-js"

const env = {}
for (const line of fs.readFileSync("/Users/prabhubalasubramaniam/AMASI-management/.env.technosurg.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const EVENT_ID = "87c614b3-ff23-47c5-8682-87ea32aa77b9"

// Fetch all logged technoheadphones sends from this evening
let all = []
let from = 0
const PAGE = 1000
while (true) {
  const { data, error } = await db.from("message_logs")
    .select("id, registration_id, recipient, recipient_name, provider_message_id, sent_at")
    .eq("event_id", EVENT_ID)
    .eq("status", "sent")
    .ilike("message_body", "%technoheadphones%")
    .order("sent_at", { ascending: true })
    .range(from, from + PAGE - 1)
  if (error) throw error
  all = all.concat(data || [])
  if (!data || data.length < PAGE) break
  from += PAGE
}
console.log(`Polling ${all.length} messages...`)

const buckets = { delivered: [], read: [], failed: [], sent: [], unknown: [] }
let i = 0
for (const log of all) {
  i++
  const res = await fetch(`https://api.qikchat.in/v1/messages?msgid=${log.provider_message_id}`, {
    headers: { "QIKCHAT-API-KEY": env.QIKCHAT_API_KEY },
  })
  const json = await res.json().catch(() => ({}))
  const status = json?.message?.payload?.message?.status || "unknown"
  ;(buckets[status] || buckets.unknown).push({ ...log, _status: status })
  if (i % 100 === 0) {
    console.log(`  [${i}/${all.length}] delivered=${buckets.delivered.length} read=${buckets.read.length} sent=${buckets.sent.length} failed=${buckets.failed.length} unknown=${buckets.unknown.length}`)
  }
  await new Promise(r => setTimeout(r, 50))
}

console.log(`\n--- Final ---`)
console.log(`delivered: ${buckets.delivered.length}`)
console.log(`read:      ${buckets.read.length}`)
console.log(`sent:      ${buckets.sent.length}  (queued at provider, not yet delivered)`)
console.log(`failed:    ${buckets.failed.length}`)
console.log(`unknown:   ${buckets.unknown.length}`)

const lines = ["recipient,recipient_name,registration_id,provider_message_id,qikchat_status"]
for (const cat of ["failed", "sent", "unknown"]) {
  for (const r of buckets[cat]) {
    lines.push(`${r.recipient},"${(r.recipient_name || "").replace(/"/g, '""')}",${r.registration_id},${r.provider_message_id},${r._status}`)
  }
}
const csvPath = "/Users/prabhubalasubramaniam/Downloads/technoheadphones-not-delivered.csv"
fs.writeFileSync(csvPath, lines.join("\n"))
console.log(`\nCSV written: ${csvPath}`)
