#!/usr/bin/env node
/**
 * Send Faculty Invitation (Email + Gallabox WhatsApp speaker_invitation)
 * to the 17 Gynae faculty whose contact info was either backfilled (14)
 * or newly added (3) on 2026-06-28 from the v-1 program doc.
 *
 * Idempotent: skips any reg whose custom_fields.invitation_status === 'sent'
 * unless --force is passed.
 *
 * Default dry-run; pass --apply to send.
 */
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const APPLY = process.argv.includes("--apply")
const FORCE = process.argv.includes("--force")

const env = {}
for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const RESEND_API_KEY = env.RESEND_API_KEY
const RESEND_FROM = env.RESEND_FROM_EMAIL || "AMASI Events <noreply@resend.dev>"
const APP_URL = "https://collegeofmas.org.in"

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

const EVENT = {
  id: "cb26bbb1-0ab9-4e2f-a391-dcb5636c47d6",
  name: "125th AMASI Skill Course and FMAS Exam",
  date_range: "10 – 12 July 2026",
  venue: "IPGMER / SSKM Hospital, Kolkata",
}

const TARGET_REG_NUMBERS = [
  // 14 backfilled
  "125F2028","125F2029","125F2030","125F2031","125F2032","125F2034","125F2035",
  "125F2036","125F2038","125F2040","125F2041","125F2042","125F2043","125F2044",
  // 3 newly added
  "125F2045","125F2046","125F2047",
]

// Fetch Gallabox creds
const { data: commSettings } = await supabase
  .from("communication_settings")
  .select("whatsapp_api_key, whatsapp_access_token, whatsapp_phone_number_id")
  .eq("whatsapp_provider", "gallabox")
  .not("whatsapp_api_key", "is", null)
  .limit(1).single()
const GALLABOX = {
  apiKey: commSettings.whatsapp_api_key,
  apiSecret: commSettings.whatsapp_access_token,
  channelId: commSettings.whatsapp_phone_number_id,
}

const { data: regs, error: regErr } = await supabase
  .from("registrations")
  .select("id, registration_number, attendee_name, attendee_email, attendee_phone, custom_fields")
  .eq("event_id", EVENT.id)
  .in("registration_number", TARGET_REG_NUMBERS)
  .order("registration_number")
if (regErr) { console.error("Fetch failed:", regErr); process.exit(1) }

const targets = regs.filter(r => {
  if (!r.attendee_email) return false
  if (r.attendee_email.includes("@amasi.local")) return false
  if (!FORCE && r.custom_fields?.invitation_status === "sent") return false
  return true
})
console.log(`\nMode: ${APPLY ? "APPLY" : "DRY RUN"}${FORCE ? " (force resend)" : ""}`)
console.log(`Targets: ${targets.length} of ${TARGET_REG_NUMBERS.length} reg numbers`)
const skipped = regs.length - targets.length
if (skipped) console.log(`Skipped: ${skipped} (already sent or no real email)`)
console.log()
for (const r of targets) console.log(`  → ${r.registration_number}  ${r.attendee_name}  ${r.attendee_email}  ${r.attendee_phone || "(no phone)"}`)

if (!APPLY) { console.log(`\n(dry run — re-run with --apply to send)`); process.exit(0) }

function buildEmail(name, regNo, portalUrl) {
  const subject = `🎉 Welcome to 125th AMASI Skill Course, Dr ${name}! Your Faculty Registration is Confirmed`
  const text = `Dear Dr. ${name},

Greetings from AMASI!

We are delighted to confirm your faculty registration for the 125th AMASI Skill Course and FMAS Exam.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 REGISTRATION DETAILS

Registration ID: ${regNo}
Event: ${EVENT.name}
Date: ${EVENT.date_range}
Venue: ${EVENT.venue}
Convenor: Dr Seeraj Ahmed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 WHAT'S NEXT?

1️⃣ Save the dates in your calendar (10–12 July 2026)
2️⃣ Confirm your travel & accommodation through the speaker portal
3️⃣ Review your assigned topic & session timing
4️⃣ Upload your headshot & short bio for the program book

🔗 Your Speaker Portal:
${portalUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

We look forward to your active participation!

Warm regards,
The Organizing Committee
125th AMASI Skill Course & FMAS Exam
Kolkata, 10 – 12 July 2026
`
  const html = `<!DOCTYPE html><html><body style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1f2937;line-height:1.6">
<h2 style="color:#7c3aed">🎉 Welcome to the 125th AMASI Skill Course, Dr ${name}!</h2>
<p>Greetings from AMASI!</p>
<p>We are delighted to confirm your <strong>faculty registration</strong> for the 125th AMASI Skill Course and FMAS Exam.</p>
<div style="background:#f9fafb;border-radius:10px;padding:20px;margin:20px 0">
  <h3 style="margin:0 0 10px 0">📋 Registration Details</h3>
  <table style="width:100%">
    <tr><td style="padding:4px 0;color:#6b7280">Registration ID</td><td><strong>${regNo}</strong></td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Event</td><td>${EVENT.name}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Date</td><td>${EVENT.date_range}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Venue</td><td>${EVENT.venue}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Convenor</td><td>Dr Seeraj Ahmed</td></tr>
  </table>
</div>
<h3>📌 What's Next?</h3>
<ol>
  <li>Save the dates in your calendar (10–12 July 2026)</li>
  <li>Confirm your travel &amp; accommodation through the speaker portal</li>
  <li>Review your assigned topic &amp; session timing</li>
  <li>Upload your headshot &amp; short bio for the program book</li>
</ol>
<div style="text-align:center;margin:30px 0">
  <a href="${portalUrl}" style="background:#7c3aed;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600">Open Speaker Portal</a>
</div>
<p>We look forward to your active participation!</p>
<p style="margin-top:30px"><strong>Warm regards,</strong><br>The Organizing Committee<br>125th AMASI Skill Course &amp; FMAS Exam<br>Kolkata, 10 – 12 July 2026</p>
</body></html>`
  return { subject, text, html }
}

async function sendEmail(to, subject, html, text) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html, text }),
  })
  const j = await r.json()
  return { ok: r.ok && !!j.id, id: j.id, error: j }
}

async function sendWA(phone, name, portalUrl) {
  let p = phone.replace(/[^0-9]/g, "")
  if (p.length === 10) p = "91" + p
  const r = await fetch("https://server.gallabox.com/devapi/messages/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json", apiKey: GALLABOX.apiKey, apiSecret: GALLABOX.apiSecret },
    body: JSON.stringify({
      channelId: GALLABOX.channelId, channelType: "whatsapp",
      recipient: { name, phone: p },
      whatsapp: {
        type: "template",
        template: {
          templateName: "speaker_invitation",
          bodyValues: { Speaker_Name: name, Event_Name: EVENT.name, Portal_URL: portalUrl },
        },
      },
    }),
  })
  const j = await r.json()
  return { ok: r.ok && !!j.id, id: j.id, phone: p, error: j }
}

const results = { email_sent: 0, email_failed: 0, wa_sent: 0, wa_failed: 0, wa_skipped_no_phone: 0 }

for (const reg of targets) {
  const name = reg.attendee_name
  const regNo = reg.registration_number
  console.log(`\n→ ${regNo} ${name}`)

  let portalToken = reg.custom_fields?.portal_token
  if (!portalToken) {
    portalToken = crypto.randomUUID()
    await supabase.from("registrations")
      .update({ custom_fields: { ...(reg.custom_fields || {}), portal_token: portalToken } })
      .eq("id", reg.id)
  }
  const portalUrl = `${APP_URL}/speaker/${portalToken}`

  const { subject, html, text } = buildEmail(name, regNo, portalUrl)
  const emailRes = await sendEmail(reg.attendee_email, subject, html, text)
  if (emailRes.ok) { results.email_sent++; console.log(`  ✉  ${reg.attendee_email}  ✓ ${emailRes.id}`) }
  else { results.email_failed++; console.log(`  ✉  ${reg.attendee_email}  ✗ ${JSON.stringify(emailRes.error)}`) }

  let waRes = null
  if (reg.attendee_phone) {
    waRes = await sendWA(reg.attendee_phone, name, portalUrl)
    if (waRes.ok) { results.wa_sent++; console.log(`  💬 ${waRes.phone}  ✓ ${waRes.id}`) }
    else { results.wa_failed++; console.log(`  💬 ${waRes.phone}  ✗ ${JSON.stringify(waRes.error)}`) }
  } else { results.wa_skipped_no_phone++; console.log(`  💬 (no phone — skipped)`) }

  const sentAt = new Date().toISOString()
  if (emailRes.ok) {
    await supabase.from("message_logs").insert({
      event_id: EVENT.id, registration_id: reg.id,
      channel: "email", provider: "resend",
      recipient: reg.attendee_email, recipient_name: name,
      subject, message_body: text, status: "sent",
      provider_message_id: emailRes.id, sent_at: sentAt,
    })
  }
  if (waRes?.ok) {
    await supabase.from("message_logs").insert({
      event_id: EVENT.id, registration_id: reg.id,
      channel: "whatsapp", provider: "gallabox",
      recipient: waRes.phone, recipient_name: name,
      message_body: "Template: speaker_invitation (125 FMAS Kolkata - updated faculty batch 2026-06-28)",
      status: "sent",
      provider_message_id: waRes.id, sent_at: sentAt,
    })
  }

  const existing = reg.custom_fields || {}
  await supabase.from("registrations").update({
    custom_fields: {
      ...existing, portal_token: portalToken,
      invitation_status: emailRes.ok ? "sent" : existing.invitation_status,
      invitation_sent_at: emailRes.ok ? sentAt : existing.invitation_sent_at,
      invitation_email_id: emailRes.ok ? emailRes.id : existing.invitation_email_id,
      invitation_whatsapp_id: waRes?.ok ? waRes.id : existing.invitation_whatsapp_id,
      invitation_send_count: (existing.invitation_send_count || 0) + 1,
    },
  }).eq("id", reg.id)

  await new Promise(r => setTimeout(r, 600))
}

console.log(`\n=== Summary ===`)
console.log(`Emails:    ${results.email_sent} sent, ${results.email_failed} failed`)
console.log(`WhatsApp:  ${results.wa_sent} sent, ${results.wa_failed} failed, ${results.wa_skipped_no_phone} skipped`)
