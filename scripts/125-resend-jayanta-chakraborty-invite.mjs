#!/usr/bin/env node
/**
 * Resend the Faculty Invitation (Email + WhatsApp) to Dr Jayanta
 * Chakraborty (125F2048, S-S7-31A "Right Colon Malignancy"). Reuses his
 * existing registration + portal token — does not touch sessions or
 * faculty_assignments (those already exist from the initial run).
 */
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const env = {}
for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const EVENT = {
  id: "cb26bbb1-0ab9-4e2f-a391-dcb5636c47d6",
  name: "125th AMASI Skill Course and FMAS Exam",
  date_range: "10 – 12 July 2026",
  venue: "IPGMER / SSKM Hospital, Kolkata",
}
const FACULTY = { name: "Jayanta Chakraborty", email: "swayamjayanta@gmail.com", phone: "9836426866" }
const APP_URL = env.NEXT_PUBLIC_APP_URL || "https://collegeofmas.org.in"
const RESEND_FROM = env.RESEND_FROM_EMAIL || "AMASI Events <noreply@resend.dev>"

const { data: regRow, error } = await supabase.from("registrations")
  .select("id, registration_number, custom_fields")
  .eq("event_id", EVENT.id).ilike("attendee_email", FACULTY.email).single()
if (error || !regRow) { console.error("Registration not found:", error); process.exit(1) }

const portalToken = regRow.custom_fields?.portal_token
if (!portalToken) { console.error("No portal_token on registration — run the original invite script first"); process.exit(1) }
const portalUrl = `${APP_URL}/speaker/${portalToken}`

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
Topic: Right Colon Malignancy
Session: 15:35–15:55, Day 2 (11 July 2026), Surgeons Hall

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
    <tr><td style="padding:4px 0;color:#6b7280">Topic</td><td>Right Colon Malignancy</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Session</td><td>15:35–15:55, Day 2 (11 July 2026), Surgeons Hall</td></tr>
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
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.RESEND_API_KEY}` },
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
    headers: { "Content-Type": "application/json", apiKey: env.GALLABOX_API_KEY, apiSecret: env.GALLABOX_API_SECRET },
    body: JSON.stringify({
      channelId: env.GALLABOX_CHANNEL_ID, channelType: "whatsapp",
      recipient: { name, phone: p },
      whatsapp: {
        type: "template",
        template: { templateName: "speaker_invitation", bodyValues: { Speaker_Name: name, Event_Name: EVENT.name, Portal_URL: portalUrl } },
      },
    }),
  })
  const j = await r.json()
  return { ok: r.ok && !!j.id, id: j.id, phone: p, error: j }
}

const { subject, html, text } = buildEmail(FACULTY.name, regRow.registration_number, portalUrl)
const emailRes = await sendEmail(FACULTY.email, subject, html, text)
console.log(emailRes.ok ? `✉  ${FACULTY.email}  ✓ ${emailRes.id}` : `✉  ${FACULTY.email}  ✗ ${JSON.stringify(emailRes.error)}`)

const waRes = await sendWA(FACULTY.phone, FACULTY.name, portalUrl)
console.log(waRes.ok ? `💬 ${waRes.phone}  ✓ ${waRes.id}` : `💬 ${waRes.phone}  ✗ ${JSON.stringify(waRes.error)}`)

const sentAt = new Date().toISOString()
if (emailRes.ok) {
  await supabase.from("message_logs").insert({
    event_id: EVENT.id, registration_id: regRow.id,
    channel: "email", provider: "resend",
    recipient: FACULTY.email, recipient_name: FACULTY.name,
    subject, message_body: text, status: "sent",
    provider_message_id: emailRes.id, sent_at: sentAt,
  })
}
if (waRes.ok) {
  await supabase.from("message_logs").insert({
    event_id: EVENT.id, registration_id: regRow.id,
    channel: "whatsapp", provider: "gallabox",
    recipient: waRes.phone, recipient_name: FACULTY.name,
    message_body: "Template: speaker_invitation (125 FMAS Kolkata - Jayanta Chakraborty RESEND, 2026-07-07)",
    status: "sent",
    provider_message_id: waRes.id, sent_at: sentAt,
  })
}

const existing = regRow.custom_fields || {}
await supabase.from("registrations").update({
  custom_fields: { ...existing, invitation_send_count: (existing.invitation_send_count || 0) + 1 },
}).eq("id", regRow.id)

console.log("Done.")
