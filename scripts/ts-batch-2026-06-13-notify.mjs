#!/usr/bin/env node
/**
 * 2026-06-13 follow-up batch for TechnoSurg:
 *   (a) auto-ready badges for the 57 confirmed regs missing badge_generated_at
 *       (skips the 1 "Testing" ticket-type row)
 *   (b) send welcome email to the ~174 confirmed regs that have no sent email
 *       in message_logs
 *   (c) send technosurg_welcome WhatsApp to today's 39 newly-added regs only
 *
 * Each step is gated so we know exactly what happened.
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

const RESEND_KEY = amasiEnv.RESEND_API_KEY
if (!RESEND_KEY) { console.error("Missing RESEND_API_KEY in .env.local"); process.exit(1) }
const resend = new Resend(RESEND_KEY)

const db = createClient(tsEnv.NEXT_PUBLIC_SUPABASE_URL, tsEnv.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const EVENT_ID = "87c614b3-ff23-47c5-8682-87ea32aa77b9"
const TESTING_TICKET_ID = "50455ee7-a1fd-4814-8e9e-5508ae44b855"
const FROM = "TechnoSurg <noreply@gemhospitals.com>"
const SUBJECT = "Welcome to Technosurg 2026-ITC chola Chennai"
const PORTAL = "https://technosurg.gemhospitals.com/my"
const PORTAL_BASE = "https://technosurg.gemhospitals.com"
const QIKCHAT_URL = "https://api.qikchat.in/v1/messages"
const WA_TEMPLATE = "technosurg_welcome"

const TODAY_BATCH_EMAILS = new Set([
  "vimalakarreddy@gmail.com",
  "docam@rediffmail.com",
  "mdurai07@gmail.com",
  "drasekar1969@gmail.com",
  "vishnuvarthanselvaraj@gmail.com",
  "rknithi2000@yahoo.co.in",
  "drlogu.mannu@gmail.com",
  "surgnutty@gmail.com",
  "drdurairavi@gmail.com",
  "dr.aravind88@gmail.com",
  "lohit.sai1991@gmail.com",
  "jjebinlevi@gmail.com",
  "preethiyaswt@gmail.com",
  "ilakkiya.sekar@gmail.com",
  "schandranmbbsmd@gmail.com",
  "ilakkiya22@gmail.com",
  "hbknaveenkumar@gmail.com",
  "dinesh.ssr82@yahoo.co.in",
  "ajay2king555@gmail.com",
  "kgbstanley@gmail.com",
  "dr.sivamarieswaran@gmail.com",
  "dr.devamadhu@gmail.com",
  "drcyril1074@gmail.com",
  "gastrosurgeondrks@gmail.com",
  "drgayathrisamy@gmail.com",
  "jeeyes1@gmail.com",
  "rafiq.dr.anwar@gmail.com",
  "divya.ravi.chennai@gmail.com",
  "meenanivi1995@gmail.com",
  "aishu90rangesh@gmail.com",
  "preethi.drsar@gmail.com",
  "nandhugm.25@gmail.com",
  "sangetamurugan1990@gmail.com",
  "himapavan95@gmail.com",
  "drmarivelmuruganofficial@gmail.com",
  "kanisanju09@gmail.com",
  "drumeshraj21@gmail.com",
  "guruganesh84@sbmch.com",
  "dr.sunithajayarani@gmail.com",
])

// ===== (a) Auto-ready badges =====
console.log("\n========== STEP A: Auto-ready badges ==========")

const { data: notReady } = await db
  .from("registrations")
  .select("id, registration_number, attendee_name, ticket_type_id")
  .eq("event_id", EVENT_ID)
  .eq("status", "confirmed")
  .is("badge_generated_at", null)
console.log(`Found ${notReady.length} confirmed regs with no badge_generated_at.`)

const tplCache = new Map()
async function resolveTemplate(ticketTypeId) {
  if (tplCache.has(ticketTypeId)) return tplCache.get(ticketTypeId)
  const { data: specific } = await db
    .from("badge_templates")
    .select("id, name")
    .eq("event_id", EVENT_ID)
    .contains("ticket_type_ids", [ticketTypeId])
    .limit(1)
  if (specific?.[0]) { tplCache.set(ticketTypeId, specific[0]); return specific[0] }
  const { data: def } = await db
    .from("badge_templates")
    .select("id, name")
    .eq("event_id", EVENT_ID)
    .eq("is_default", true)
    .limit(1)
  const out = def?.[0] || null
  tplCache.set(ticketTypeId, out)
  return out
}

const nowIso = new Date().toISOString()
const bumpByTpl = new Map()
const badgeResults = { ready: 0, skipped: 0, failed: 0 }
for (const r of notReady) {
  if (r.ticket_type_id === TESTING_TICKET_ID) {
    badgeResults.skipped++
    console.log(`  · skip Testing row: ${r.registration_number} ${r.attendee_name}`)
    continue
  }
  const tpl = await resolveTemplate(r.ticket_type_id)
  if (!tpl) {
    badgeResults.failed++
    console.log(`  ✗ no template for ticket ${r.ticket_type_id}: ${r.registration_number}`)
    continue
  }
  const { error } = await db
    .from("registrations")
    .update({ badge_generated_at: nowIso, badge_template_id: tpl.id })
    .eq("id", r.id)
  if (error) {
    badgeResults.failed++
    console.log(`  ✗ ${r.registration_number}: ${error.message}`)
  } else {
    badgeResults.ready++
    bumpByTpl.set(tpl.id, (bumpByTpl.get(tpl.id) || 0) + 1)
    console.log(`  ✓ ${r.registration_number} ${r.attendee_name} → ${tpl.name}`)
  }
}
for (const [tplId, by] of bumpByTpl) {
  const { data: row } = await db
    .from("badge_templates")
    .select("badges_generated_count, name")
    .eq("id", tplId)
    .single()
  const next = (row?.badges_generated_count || 0) + by
  await db.from("badge_templates").update({ badges_generated_count: next }).eq("id", tplId)
  console.log(`✓ badge template "${row?.name}" badges_generated_count → ${next}`)
}
console.log(`STEP A summary: ready=${badgeResults.ready}  skipped=${badgeResults.skipped}  failed=${badgeResults.failed}`)

// ===== (b) Send welcome email to all missing =====
console.log("\n========== STEP B: Welcome email to missing ==========")

const { data: allConfirmed } = await db
  .from("registrations")
  .select("id, registration_number, attendee_name, attendee_email, attendee_phone, ticket_type_id, created_at")
  .eq("event_id", EVENT_ID)
  .eq("status", "confirmed")

const { data: emailLogs } = await db
  .from("message_logs")
  .select("registration_id")
  .eq("event_id", EVENT_ID)
  .eq("channel", "email")
  .eq("status", "sent")
const emailedIds = new Set((emailLogs || []).map(r => r.registration_id).filter(Boolean))

const emailTargets = allConfirmed.filter(r => !emailedIds.has(r.id) && r.attendee_email)
console.log(`Email targets: ${emailTargets.length}`)

function bodyText(name) {
  return `Dear Dr. ${name},

Greetings from GEM Hospital, Chennai, and the Organising Committee of GEM TechnoSurg 2026.

It gives us immense pleasure to welcome you to GEM TechnoSurg 2026 – India’s First Technology & Surgery Conclave, to be held at the iconic ITC Grand Chola, Chennai.

We sincerely thank you for your registration and for being a part of this landmark event. Your participation contributes to what promises to be a truly unique gathering of surgeons, clinicians, innovators, researchers, engineers, industry leaders, and healthcare visionaries from across India and around the world.

GEM TechnoSurg 2026 marks the beginning of a new chapter in healthcare innovation. This conclave is designed to explore the transformative impact of Artificial Intelligence, Robotics, Fluorescence-Guided Surgery, Advanced Imaging, Digital Health, and Emerging Technologies on the future of surgical care.

The scientific programme will feature distinguished national and international faculty, live and recorded surgical demonstrations, keynote addresses, expert panel discussions, technology showcases and collaborative discussions aimed at shaping the future of surgery.

Beyond the academic experience, we look forward to extending the warm hospitality of Chennai, a city renowned for its rich culture, heritage, and medical excellence. We hope your time at GEM TechnoSurg 2026 will be both professionally enriching and personally memorable.

For your convenience, we have created a dedicated delegate portal where you may download your conference entry badge, register an accompanying person, and access accommodation options with special conference rates. Kindly visit:

${PORTAL}

We are honoured to welcome you to this historic conclave and look forward to your valued participation.

With warm regards,

Dr. Senthilnathan P
Organising Secretary, GEM TechnoSurg 2026
Director & Chief Surgeon, GEM Hospital, Chennai`
}
function bodyHtml(name) {
  const esc = (s) => String(s).replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111;max-width:640px;line-height:1.6;">
<p>Dear Dr. ${esc(name)},</p>
<p>Greetings from GEM Hospital, Chennai, and the Organising Committee of GEM TechnoSurg 2026.</p>
<p>It gives us immense pleasure to welcome you to GEM TechnoSurg 2026 – India’s First Technology &amp; Surgery Conclave, to be held at the iconic ITC Grand Chola, Chennai.</p>
<p>We sincerely thank you for your registration and for being a part of this landmark event. Your participation contributes to what promises to be a truly unique gathering of surgeons, clinicians, innovators, researchers, engineers, industry leaders, and healthcare visionaries from across India and around the world.</p>
<p>GEM TechnoSurg 2026 marks the beginning of a new chapter in healthcare innovation. This conclave is designed to explore the transformative impact of Artificial Intelligence, Robotics, Fluorescence-Guided Surgery, Advanced Imaging, Digital Health, and Emerging Technologies on the future of surgical care.</p>
<p>The scientific programme will feature distinguished national and international faculty, live and recorded surgical demonstrations, keynote addresses, expert panel discussions, technology showcases and collaborative discussions aimed at shaping the future of surgery.</p>
<p>Beyond the academic experience, we look forward to extending the warm hospitality of Chennai, a city renowned for its rich culture, heritage, and medical excellence. We hope your time at GEM TechnoSurg 2026 will be both professionally enriching and personally memorable.</p>
<p>For your convenience, we have created a dedicated delegate portal where you may download your conference entry badge, register an accompanying person, and access accommodation options with special conference rates. Kindly visit:</p>
<p><a href="${PORTAL}">${PORTAL}</a></p>
<p>We are honoured to welcome you to this historic conclave and look forward to your valued participation.</p>
<p>With warm regards,</p>
<p>Dr. Senthilnathan P<br/>Organising Secretary, GEM TechnoSurg 2026<br/>Director &amp; Chief Surgeon, GEM Hospital, Chennai</p>
</div>`
}

const emailSummary = { sent: 0, failed: 0 }
let i = 0
for (const reg of emailTargets) {
  i++
  const name = reg.attendee_name
  const html = bodyHtml(name)
  const text = bodyText(name)
  let res
  try {
    res = await resend.emails.send({ from: FROM, to: [reg.attendee_email], subject: SUBJECT, html, text })
  } catch (err) {
    res = { error: { message: err.message } }
  }
  if (res?.error) {
    emailSummary.failed++
    const msg = res.error.message || JSON.stringify(res.error)
    console.log(`[${i}/${emailTargets.length}] ✗ ${reg.registration_number} <${reg.attendee_email}>: ${msg}`)
    await db.from("message_logs").insert({
      event_id: EVENT_ID, registration_id: reg.id, channel: "email", provider: "default",
      recipient: reg.attendee_email, recipient_name: name, subject: SUBJECT, message_body: text,
      status: "failed", error_message: msg, failed_at: new Date().toISOString(),
    })
  } else {
    emailSummary.sent++
    console.log(`[${i}/${emailTargets.length}] ✓ ${reg.registration_number} ${name} <${reg.attendee_email}>  id=${res?.data?.id}`)
    await db.from("message_logs").insert({
      event_id: EVENT_ID, registration_id: reg.id, channel: "email", provider: "default",
      recipient: reg.attendee_email, recipient_name: name, subject: SUBJECT, message_body: text,
      status: "sent", provider_message_id: res?.data?.id, sent_at: new Date().toISOString(),
    })
  }
  if (i < emailTargets.length) await new Promise(r => setTimeout(r, 650))
}
console.log(`STEP B summary: sent=${emailSummary.sent}  failed=${emailSummary.failed}`)

// ===== (c) WhatsApp to today's 39 only =====
console.log("\n========== STEP C: WhatsApp to today's 39 only ==========")

const { data: event } = await db
  .from("events")
  .select("name, short_name")
  .eq("id", EVENT_ID)
  .single()
const eventName = event?.short_name || event?.name || "Event"
console.log(`Event name for template: ${eventName}`)

const todayList = allConfirmed.filter(r => TODAY_BATCH_EMAILS.has((r.attendee_email || "").toLowerCase()))
console.log(`Matched today's batch: ${todayList.length} of ${TODAY_BATCH_EMAILS.size}`)

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
      name: WA_TEMPLATE, language: "en",
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
    headers: { "Content-Type": "application/json", "QIKCHAT-API-KEY": tsEnv.QIKCHAT_API_KEY },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (res.ok && json.status === true) return { ok: true, id: json.data?.[0]?.id || "sent" }
  return { ok: false, error: json.message || `HTTP ${res.status}` }
}

const waSummary = { sent: 0, failed: 0, skipped: 0 }
for (const r of todayList) {
  if (!r.attendee_phone) {
    waSummary.skipped++
    console.log(`  · skip (no phone): ${r.attendee_name} <${r.attendee_email}>`)
    continue
  }
  const result = await sendTemplate(r.attendee_phone, r.attendee_name, r.registration_number)
  if (result.ok) {
    waSummary.sent++
    console.log(`  ✓ ${r.registration_number} ${r.attendee_name} <${r.attendee_phone}> — ${result.id}`)
    await db.from("message_logs").insert({
      event_id: EVENT_ID, registration_id: r.id, channel: "whatsapp", provider: "qikchat",
      recipient: r.attendee_phone, recipient_name: r.attendee_name,
      message_body: `Template: ${WA_TEMPLATE}`, status: "sent",
      provider_message_id: result.id, sent_at: new Date().toISOString(),
    })
  } else {
    waSummary.failed++
    console.log(`  ✗ ${r.registration_number} ${r.attendee_name} <${r.attendee_phone}>: ${result.error}`)
    await db.from("message_logs").insert({
      event_id: EVENT_ID, registration_id: r.id, channel: "whatsapp", provider: "qikchat",
      recipient: r.attendee_phone, recipient_name: r.attendee_name,
      message_body: `Template: ${WA_TEMPLATE}`, status: "failed",
      error_message: result.error, failed_at: new Date().toISOString(),
    })
  }
  await new Promise(r => setTimeout(r, 200))
}
console.log(`STEP C summary: sent=${waSummary.sent}  failed=${waSummary.failed}  skipped=${waSummary.skipped}`)

console.log("\n========== ALL DONE ==========")
console.log(`(a) Badges ready:  ready=${badgeResults.ready}  skipped=${badgeResults.skipped}  failed=${badgeResults.failed}`)
console.log(`(b) Emails:        sent=${emailSummary.sent}  failed=${emailSummary.failed}`)
console.log(`(c) WhatsApp 39:   sent=${waSummary.sent}  failed=${waSummary.failed}  skipped=${waSummary.skipped}`)
