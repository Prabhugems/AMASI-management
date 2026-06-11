#!/usr/bin/env node
/**
 * Send the technosurg_welcome WhatsApp template to the 19 comp delegates
 * inserted via ts-add-comp-delegates-2026-06-11.mjs.
 *
 * Targets are looked up by email so we don't fan out to anyone else.
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

const TARGET_EMAILS = [
  "joynerabraham@gmail.com",
  "drsk1287@gmail.com",
  "vijayadwarak3@gmail.com",
  "shyamprashadk22@gmail.com",
  "dr.c.kamal@gmail.com",
  "barathiraja.kbr@gmail.com",
  "jothivelg@hotmail.com",
  "drpsk88@gmail.com",
  "vikram.hpb@gmail.com",
  "kinggandhi@gmail.com",
  "vsarath1010@gmail.com",
  "drneelamekam.k@srmhospitals.com",
  "suganthsarvesh@gmail.com",
  "guhanrj@gmail.com",
  "rajamsgs2016@gmail.com",
  "dro_surana@yahoo.co.in",
  "vijayalakshmi.gunasekaran88@gmail.com",
  "spksradha@gmail.com",
  "cpradeepmmc@gmail.com",
]

const { data: event } = await db
  .from("events")
  .select("name, short_name")
  .eq("id", EVENT_ID)
  .single()
const eventName = event?.short_name || event?.name || "Event"
console.log(`Event name for template: ${eventName}`)

const { data: regs, error: regErr } = await db
  .from("registrations")
  .select("id, registration_number, attendee_name, attendee_email, attendee_phone")
  .eq("event_id", EVENT_ID)
  .in("attendee_email", TARGET_EMAILS)
  .order("created_at", { ascending: true })

if (regErr) { console.error(regErr); process.exit(1) }

console.log(`Recipients matched: ${regs.length} of ${TARGET_EMAILS.length}\n`)
const matchedEmails = new Set(regs.map(r => r.attendee_email))
for (const e of TARGET_EMAILS) {
  if (!matchedEmails.has(e)) console.log(`  ! no registration for ${e}`)
}

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

const summary = { sent: 0, failed: 0, skipped: 0 }
for (const r of regs) {
  if (!r.attendee_phone) {
    summary.skipped++
    console.log(`  · skip (no phone): ${r.attendee_name} <${r.attendee_email}>`)
    continue
  }
  const result = await sendTemplate(r.attendee_phone, r.attendee_name, r.registration_number)
  if (result.ok) {
    summary.sent++
    console.log(`  ✓ ${r.attendee_name} <${r.attendee_phone}> — ${result.id}`)
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
    console.log(`  ✗ ${r.attendee_name} <${r.attendee_phone}>: ${result.error}`)
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

console.log("\n--- Summary ---")
console.log(`Sent:    ${summary.sent}`)
console.log(`Failed:  ${summary.failed}`)
console.log(`Skipped: ${summary.skipped}`)
