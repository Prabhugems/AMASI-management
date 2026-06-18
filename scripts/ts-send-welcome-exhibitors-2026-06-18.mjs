#!/usr/bin/env node
/**
 * Send technosurg_welcome WhatsApp + email to the 9 delegates uploaded today
 * (Source: ~/Downloads/Share techno surge sun.xlsx).
 * Dry-run by default; pass --live.
 */
import fs from "node:fs"
import { Resend } from "resend"
import { createClient } from "@supabase/supabase-js"

const LIVE = process.argv.includes("--live")
function loadEnv(file) {
  const env = {}
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
  }
  return env
}
const amasiEnv = loadEnv("/Users/prabhubalasubramaniam/AMASI-management/.env.local")
const tsEnv    = loadEnv("/Users/prabhubalasubramaniam/AMASI-management/.env.technosurg.local")
const resend = new Resend(amasiEnv.RESEND_API_KEY)
const db = createClient(tsEnv.NEXT_PUBLIC_SUPABASE_URL, tsEnv.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const EVENT_ID = "87c614b3-ff23-47c5-8682-87ea32aa77b9"
const PORTAL_BASE = "https://technosurg.gemhospitals.com"
const PORTAL = `${PORTAL_BASE}/my`
const TEMPLATE_NAME = "technosurg_welcome"
const QIKCHAT_URL = "https://api.qikchat.in/v1/messages"
const FROM = "TechnoSurg <noreply@gemhospitals.com>"
const SUBJECT = "Welcome to Technosurg 2026-ITC chola Chennai"
const PLACEHOLDER_EMAIL_DOMAIN = "noemail.local"

// Target: everyone on the Exhibitors ticket
const EXHIBITOR_TICKET_ID = "53fdd5d0-19da-4c0f-ad30-53702c2494a7"

const { data: event } = await db.from("events").select("name, short_name").eq("id", EVENT_ID).single()
const eventName = event?.short_name || event?.name || "Event"

const { data: regs } = await db
  .from("registrations")
  .select("id, registration_number, attendee_name, attendee_email, attendee_phone")
  .eq("event_id", EVENT_ID)
  .eq("ticket_type_id", EXHIBITOR_TICKET_ID)
  .order("registration_number", { ascending: true })

console.log(`Event: ${eventName}`)
console.log(`Mode:  ${LIVE ? "LIVE" : "DRY RUN"}`)
console.log(`Exhibitor recipients: ${regs.length}\n`)

function formatPhone(phone) {
  let cleaned = String(phone || "").replace(/[^0-9]/g, "")
  if (cleaned.length === 10) cleaned = "91" + cleaned
  return cleaned
}
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

console.log("--- Recipients ---")
for (const r of regs) {
  const noEmail = !r.attendee_email || r.attendee_email.endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`)
  console.log(`  ${r.registration_number}  ${r.attendee_name}  +${formatPhone(r.attendee_phone)}  <${r.attendee_email}>${noEmail ? "  (skip email)" : ""}`)
}

if (!LIVE) {
  console.log("\nDry-run. Pass --live to send.")
  process.exit(0)
}

async function sendWhatsApp(r) {
  const phone = formatPhone(r.attendee_phone)
  const portalUrl = `${PORTAL_BASE}/my?q=${encodeURIComponent(phone)}`
  const body = {
    to_contact: phone,
    type: "template",
    template: {
      name: TEMPLATE_NAME,
      language: "en",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: r.attendee_name },
          { type: "text", text: eventName },
          { type: "text", text: r.registration_number },
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
console.log("\n--- WhatsApp ---")
for (const r of regs) {
  if (!r.attendee_phone) {
    waSummary.skipped++
    console.log(`  · skip (no phone): ${r.registration_number} ${r.attendee_name}`)
    continue
  }
  const result = await sendWhatsApp(r)
  if (result.ok) {
    waSummary.sent++
    console.log(`  ✓ ${r.registration_number}  ${r.attendee_name} — ${result.id}`)
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
    waSummary.failed++
    console.log(`  ✗ ${r.registration_number}  ${r.attendee_name}: ${result.error}`)
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
  await new Promise(r => setTimeout(r, 200))
}

const emSummary = { sent: 0, failed: 0, skipped: 0 }
console.log("\n--- Email ---")
let i = 0
for (const r of regs) {
  i++
  if (!r.attendee_email || r.attendee_email.endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`)) {
    emSummary.skipped++
    console.log(`  · skip (no real email): ${r.registration_number} ${r.attendee_name}`)
    continue
  }
  const name = r.attendee_name
  let res
  try {
    res = await resend.emails.send({
      from: FROM,
      to: [r.attendee_email],
      subject: SUBJECT,
      html: bodyHtml(name),
      text: bodyText(name),
    })
  } catch (err) {
    res = { error: { message: err.message } }
  }
  if (res?.error) {
    emSummary.failed++
    const msg = res.error.message || JSON.stringify(res.error)
    console.log(`  ✗ ${r.registration_number} ${name} <${r.attendee_email}>: ${msg}`)
    await db.from("message_logs").insert({
      event_id: EVENT_ID,
      registration_id: r.id,
      channel: "email",
      provider: "default",
      recipient: r.attendee_email,
      recipient_name: name,
      subject: SUBJECT,
      message_body: bodyText(name),
      status: "failed",
      error_message: msg,
      failed_at: new Date().toISOString(),
    })
  } else {
    emSummary.sent++
    console.log(`  ✓ ${r.registration_number} ${name} <${r.attendee_email}>  id=${res?.data?.id}`)
    await db.from("message_logs").insert({
      event_id: EVENT_ID,
      registration_id: r.id,
      channel: "email",
      provider: "default",
      recipient: r.attendee_email,
      recipient_name: name,
      subject: SUBJECT,
      message_body: bodyText(name),
      status: "sent",
      provider_message_id: res?.data?.id,
      sent_at: new Date().toISOString(),
    })
  }
  if (i < regs.length) await new Promise(r => setTimeout(r, 650))
}

console.log("\n--- Summary ---")
console.log(`WhatsApp: sent=${waSummary.sent} failed=${waSummary.failed} skipped=${waSummary.skipped}`)
console.log(`Email:    sent=${emSummary.sent} failed=${emSummary.failed} skipped=${emSummary.skipped}`)
