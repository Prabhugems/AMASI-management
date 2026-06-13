#!/usr/bin/env node
/**
 * Send technosurg_welcome WhatsApp template to every confirmed registration
 * in the TechnoSurg event that still has no SENT WhatsApp message_log entry.
 *
 * Re-queries message_logs at run time, so if the prior batch
 * (ts-batch-2026-06-13-notify.mjs) already covered today's 39, this picks up
 * only the remainder.
 *
 * Skips: regs with no phone, and any duplicate phone-numbers within this run.
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
const PORTAL_BASE = "https://technosurg.gemhospitals.com"
const QIKCHAT_URL = "https://api.qikchat.in/v1/messages"
const WA_TEMPLATE = "technosurg_welcome"

// Hard exclude today's 39 — the concurrent ts-batch-2026-06-13-notify.mjs
// covers them in its STEP C, and may not have logged yet when this script
// queries message_logs. Belt-and-suspenders to prevent double-WA on them.
const EXCLUDE_EMAILS = new Set([
  "vimalakarreddy@gmail.com","docam@rediffmail.com","mdurai07@gmail.com",
  "drasekar1969@gmail.com","vishnuvarthanselvaraj@gmail.com","rknithi2000@yahoo.co.in",
  "drlogu.mannu@gmail.com","surgnutty@gmail.com","drdurairavi@gmail.com",
  "dr.aravind88@gmail.com","lohit.sai1991@gmail.com","jjebinlevi@gmail.com",
  "preethiyaswt@gmail.com","ilakkiya.sekar@gmail.com","schandranmbbsmd@gmail.com",
  "ilakkiya22@gmail.com","hbknaveenkumar@gmail.com","dinesh.ssr82@yahoo.co.in",
  "ajay2king555@gmail.com","kgbstanley@gmail.com","dr.sivamarieswaran@gmail.com",
  "dr.devamadhu@gmail.com","drcyril1074@gmail.com","gastrosurgeondrks@gmail.com",
  "drgayathrisamy@gmail.com","jeeyes1@gmail.com","rafiq.dr.anwar@gmail.com",
  "divya.ravi.chennai@gmail.com","meenanivi1995@gmail.com","aishu90rangesh@gmail.com",
  "preethi.drsar@gmail.com","nandhugm.25@gmail.com","sangetamurugan1990@gmail.com",
  "himapavan95@gmail.com","drmarivelmuruganofficial@gmail.com","kanisanju09@gmail.com",
  "drumeshraj21@gmail.com","guruganesh84@sbmch.com","dr.sunithajayarani@gmail.com",
])

const { data: event } = await db
  .from("events")
  .select("name, short_name")
  .eq("id", EVENT_ID)
  .single()
const eventName = event?.short_name || event?.name || "Event"
console.log(`Event name for template: ${eventName}`)

const { data: regs } = await db
  .from("registrations")
  .select("id, registration_number, attendee_name, attendee_email, attendee_phone")
  .eq("event_id", EVENT_ID)
  .eq("status", "confirmed")

const { data: waLogs } = await db
  .from("message_logs")
  .select("registration_id")
  .eq("event_id", EVENT_ID)
  .eq("channel", "whatsapp")
  .eq("status", "sent")
const waSentIds = new Set((waLogs || []).map(r => r.registration_id).filter(Boolean))

const candidates = regs
  .filter(r => !waSentIds.has(r.id))
  .filter(r => !EXCLUDE_EMAILS.has((r.attendee_email || "").toLowerCase()))
const withPhone = candidates.filter(r => r.attendee_phone)
const noPhone = candidates.filter(r => !r.attendee_phone)
console.log(`Total confirmed: ${regs.length}`)
console.log(`Already WA-sent: ${waSentIds.size}`)
console.log(`Missing WA candidates: ${candidates.length}`)
console.log(`  with phone: ${withPhone.length}`)
console.log(`  no phone (will skip): ${noPhone.length}`)

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
      name: WA_TEMPLATE,
      language: "en",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: name },
          { type: "text", text: eventName },
          { type: "text", text: regNumber },
          { type: "text", text: portalUrl },
        ],
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

const seenPhone = new Set()
const summary = { sent: 0, failed: 0, skipped: 0, dupPhone: 0 }
let i = 0
for (const r of withPhone) {
  i++
  const formatted = formatPhone(r.attendee_phone)
  if (seenPhone.has(formatted)) {
    summary.dupPhone++
    console.log(`[${i}/${withPhone.length}] · dup phone in run, skip: ${r.registration_number} ${r.attendee_name} ${formatted}`)
    continue
  }
  seenPhone.add(formatted)
  const result = await sendTemplate(r.attendee_phone, r.attendee_name, r.registration_number)
  if (result.ok) {
    summary.sent++
    console.log(`[${i}/${withPhone.length}] ✓ ${r.registration_number} ${r.attendee_name} ${formatted} — ${result.id}`)
    await db.from("message_logs").insert({
      event_id: EVENT_ID, registration_id: r.id, channel: "whatsapp", provider: "qikchat",
      recipient: r.attendee_phone, recipient_name: r.attendee_name,
      message_body: `Template: ${WA_TEMPLATE}`, status: "sent",
      provider_message_id: result.id, sent_at: new Date().toISOString(),
    })
  } else {
    summary.failed++
    console.log(`[${i}/${withPhone.length}] ✗ ${r.registration_number} ${r.attendee_name} ${formatted}: ${result.error}`)
    await db.from("message_logs").insert({
      event_id: EVENT_ID, registration_id: r.id, channel: "whatsapp", provider: "qikchat",
      recipient: r.attendee_phone, recipient_name: r.attendee_name,
      message_body: `Template: ${WA_TEMPLATE}`, status: "failed",
      error_message: result.error, failed_at: new Date().toISOString(),
    })
  }
  await new Promise(r => setTimeout(r, 200))
}

console.log("\n--- Summary ---")
console.log(`Sent:        ${summary.sent}`)
console.log(`Failed:      ${summary.failed}`)
console.log(`Dup phone:   ${summary.dupPhone}`)
console.log(`No-phone skipped (not attempted): ${noPhone.length}`)
