#!/usr/bin/env node
/**
 * Send the technosurg_welcome WhatsApp template to every confirmed registration
 * on the TechnoSurg event (delegates + faculty) that has not already received
 * it (cross-checked against message_logs).
 */
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
const PORTAL_BASE = "https://technosurg.gemhospitals.com"
const TEMPLATE_NAME = "technosurg_welcome"
const QIKCHAT_URL = "https://api.qikchat.in/v1/messages"

const { data: event } = await db
  .from("events")
  .select("name, short_name")
  .eq("id", EVENT_ID)
  .single()
const eventName = event?.short_name || event?.name || "Event"

const { data: regs } = await db
  .from("registrations")
  .select("id, registration_number, attendee_name, attendee_email, attendee_phone, status")
  .eq("event_id", EVENT_ID)
  .eq("status", "confirmed")

const confirmedWithPhone = regs.filter((r) => r.attendee_phone)

// Pull already-sent (successful) recipients from message_logs
const { data: logs } = await db
  .from("message_logs")
  .select("registration_id")
  .eq("event_id", EVENT_ID)
  .eq("channel", "whatsapp")
  .eq("status", "sent")
  .ilike("message_body", `%${TEMPLATE_NAME}%`)
const alreadySent = new Set((logs || []).map((l) => l.registration_id))

const toSend = confirmedWithPhone.filter((r) => !alreadySent.has(r.id))
console.log(`Event: ${eventName}`)
console.log(`Total confirmed w/ phone: ${confirmedWithPhone.length}`)
console.log(`Already sent: ${alreadySent.size}`)
console.log(`Sending now: ${toSend.length}\n`)

function formatPhone(phone) {
  let cleaned = String(phone || "").replace(/[^0-9]/g, "")
  if (cleaned.length === 10) cleaned = "91" + cleaned
  return cleaned
}

async function sendTemplate(phone, name, regNumber) {
  const formattedPhone = formatPhone(phone)
  const portalUrl = `${PORTAL_BASE}/my?q=${encodeURIComponent(formattedPhone)}`
  const body = {
    to_contact: formattedPhone,
    type: "template",
    template: {
      name: TEMPLATE_NAME,
      language: "en",
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: name },
            { type: "text", text: eventName },
            { type: "text", text: regNumber },
            { type: "text", text: portalUrl },
          ],
        },
      ],
    },
  }
  const res = await fetch(QIKCHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "QIKCHAT-API-KEY": env.QIKCHAT_API_KEY,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (res.ok && json.status === true) {
    return { ok: true, id: json.data?.[0]?.id || "sent" }
  }
  return { ok: false, error: json.message || `HTTP ${res.status}` }
}

const summary = { sent: 0, failed: 0 }
let i = 0
for (const r of toSend) {
  i++
  const result = await sendTemplate(r.attendee_phone, r.attendee_name, r.registration_number)
  if (result.ok) {
    summary.sent++
    if (i % 25 === 0 || i === toSend.length) console.log(`  [${i}/${toSend.length}] ✓ ${r.registration_number} ${r.attendee_name}`)
    await db.from("message_logs").insert({
      event_id: EVENT_ID,
      registration_id: r.id,
      channel: "whatsapp",
      provider: "qikchat",
      recipient: r.attendee_phone,
      recipient_name: r.attendee_name,
      message_body: `Template: ${TEMPLATE_NAME}`,
      status: "sent",
      provider_message_id: result.id,
      sent_at: new Date().toISOString(),
    })
  } else {
    summary.failed++
    console.log(`  [${i}/${toSend.length}] ✗ ${r.registration_number} ${r.attendee_name} <${r.attendee_phone}>: ${result.error}`)
    await db.from("message_logs").insert({
      event_id: EVENT_ID,
      registration_id: r.id,
      channel: "whatsapp",
      provider: "qikchat",
      recipient: r.attendee_phone,
      recipient_name: r.attendee_name,
      message_body: `Template: ${TEMPLATE_NAME}`,
      status: "failed",
      error_message: result.error,
      failed_at: new Date().toISOString(),
    })
  }
  await new Promise((r) => setTimeout(r, 200))
}

console.log(`\n--- Summary ---`)
console.log(`Sent: ${summary.sent}`)
console.log(`Failed: ${summary.failed}`)
