#!/usr/bin/env node
/**
 * Add Dr Jayanta Chakraborty as NEW faculty for 125th AMASI Skill Course
 * (Kolkata) — "Right Colon Malignancy", a new 20-min slot inserted at
 * 15:35 on Day 2 (right after S-S7-31, before S-S7-32).
 *
 * Sameer Rege's existing talks (S-S7-29, S-S7-31, S-S7-32) are NOT touched.
 * Everything on the Surgery track after 15:35 on Day 2 shifts +20 min:
 *   S-S7-32  15:35-16:00 -> 15:55-16:20
 *   S-S8-33  16:10-16:40 -> 16:30-17:00
 *   S-S8-34  16:40-17:10 -> 17:00-17:30
 *   S-S8-35  17:10-17:30 -> 17:30-17:50
 * (Gynae track G-D3-* runs in parallel and is untouched.)
 *
 * Source: WhatsApp msgs from Dr Tamonas Chaudhuri, 2026-07-06 / 07.
 *
 * Default dry-run; pass --apply to write + send.
 */
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const APPLY = process.argv.includes("--apply")

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
const NEW_SESSION_CODE = "S-S7-31A"
const NEW_START = "15:35:00"
const NEW_END = "15:55:00"
const SHIFT_MINUTES = 20
const SHIFT_CODES = ["S-S7-32", "S-S8-33", "S-S8-34", "S-S8-35"]

const FACULTY = {
  name: "Jayanta Chakraborty",
  email: "swayamjayanta@gmail.com",
  phone: "9836426866",
}
const APP_URL = env.NEXT_PUBLIC_APP_URL || "https://collegeofmas.org.in"
const RESEND_FROM = env.RESEND_FROM_EMAIL || "AMASI Events <noreply@resend.dev>"

const log = []
function L(msg) { log.push(msg); console.log(msg) }
function header(t) { L(""); L("=".repeat(72)); L(t); L("=".repeat(72)) }
function addMinutes(hhmmss, mins) {
  const [h, m, s] = hhmmss.split(":").map(Number)
  const d = new Date(2000, 0, 1, h, m, s)
  d.setMinutes(d.getMinutes() + mins)
  return d.toTimeString().slice(0, 8)
}

header(APPLY ? "APPLY MODE — changes WILL be written + sent" : "DRY RUN — no writes, no sends")

// Reference session to copy hall/track/date from
const { data: ref, error: refErr } = await supabase
  .from("sessions")
  .select("id, session_date, day_number, hall, specialty_track")
  .eq("event_id", EVENT.id).eq("session_code", "S-S7-31").single()
if (refErr || !ref) { console.error("Reference session S-S7-31 not found:", refErr); process.exit(1) }

header("1. Insert new session")
L(`  + ${NEW_SESSION_CODE}: "Right Colon Malignancy" — ${NEW_START}-${NEW_END}, ${ref.hall}`)
let newSessionId = null
const { data: existingNew } = await supabase.from("sessions")
  .select("id").eq("event_id", EVENT.id).eq("session_code", NEW_SESSION_CODE).maybeSingle()
if (existingNew) {
  L(`  ✓ ${NEW_SESSION_CODE} already exists — reusing`)
  newSessionId = existingNew.id
} else if (APPLY) {
  const { data: inserted, error } = await supabase.from("sessions").insert({
    event_id: EVENT.id,
    session_code: NEW_SESSION_CODE,
    session_name: "Right Colon Malignancy",
    session_type: "lecture",
    day_number: ref.day_number,
    session_date: ref.session_date,
    start_time: NEW_START,
    end_time: NEW_END,
    duration_minutes: 20,
    hall: ref.hall,
    specialty_track: ref.specialty_track,
    status: "scheduled",
    speakers: FACULTY.name,
    speakers_text: `${FACULTY.name} <${FACULTY.email}>`,
    import_batch_id: "125-add-jayanta-chakraborty-2026-07-07",
  }).select().single()
  if (error) { console.error("Session insert failed:", error); process.exit(1) }
  newSessionId = inserted.id
  L(`  ✓ ${NEW_SESSION_CODE} created`)
}

header("2. Shift downstream Surgery-track sessions +20 min")
for (const code of SHIFT_CODES) {
  const { data: s } = await supabase.from("sessions")
    .select("id, session_name, start_time, end_time")
    .eq("event_id", EVENT.id).eq("session_code", code).single()
  if (!s) { L(`  ⚠ ${code}: not found, skipping`); continue }
  const newStart = addMinutes(s.start_time, SHIFT_MINUTES)
  const newEnd = addMinutes(s.end_time, SHIFT_MINUTES)
  L(`  ${code} "${s.session_name}": ${s.start_time.slice(0,5)}-${s.end_time.slice(0,5)} → ${newStart.slice(0,5)}-${newEnd.slice(0,5)}`)
  if (APPLY) {
    const { error } = await supabase.from("sessions").update({
      start_time: newStart, end_time: newEnd,
    }).eq("id", s.id)
    if (error) L(`     ✗ update failed: ${error.message}`)
    else L(`     ✓ shifted`)
  }
}

header("3. Faculty registration")
const { data: anyFaculty } = await supabase.from("registrations")
  .select("ticket_type_id")
  .eq("event_id", EVENT.id).like("registration_number", "125F2%")
  .limit(1).maybeSingle()
const FACULTY_TICKET_TYPE_ID = anyFaculty?.ticket_type_id

const { data: maxReg } = await supabase.from("registrations")
  .select("registration_number")
  .eq("event_id", EVENT.id).like("registration_number", "125F2%")
  .order("registration_number", { ascending: false }).limit(1).maybeSingle()
const nextSeq = maxReg ? parseInt(maxReg.registration_number.slice(4), 10) + 1 : 2048
const regNo = `125F${nextSeq}`

let regRow = null
const { data: existingReg } = await supabase.from("registrations")
  .select("id, registration_number, custom_fields")
  .eq("event_id", EVENT.id).ilike("attendee_email", FACULTY.email).maybeSingle()

if (existingReg) {
  L(`  Registration already exists: ${existingReg.registration_number} — reusing`)
  regRow = existingReg
} else {
  L(`  + ${regNo}: ${FACULTY.name} <${FACULTY.email}> ${FACULTY.phone}`)
  if (APPLY) {
    const { data: inserted, error } = await supabase.from("registrations").insert({
      event_id: EVENT.id,
      ticket_type_id: FACULTY_TICKET_TYPE_ID,
      registration_number: regNo,
      attendee_name: FACULTY.name,
      attendee_email: FACULTY.email,
      attendee_phone: FACULTY.phone,
      status: "confirmed",
      payment_status: "completed",
      unit_price: 0, tax_amount: 0, discount_amount: 0, total_amount: 0,
      currency: "INR", quantity: 1,
      participation_mode: "offline",
      confirmed_at: new Date().toISOString(),
      notes: "Faculty - Skill Course, added 2026-07-07 (new talk: Right Colon Malignancy, S-S7-31A)",
    }).select().single()
    if (error) { console.error("Insert failed:", error); process.exit(1) }
    regRow = inserted
    L(`  ✓ ${regNo} created`)
  }
}

header("4. Faculty assignment")
if (APPLY) {
  const { error: insErr } = await supabase.from("faculty_assignments").insert({
    event_id: EVENT.id, session_id: newSessionId,
    faculty_name: FACULTY.name, faculty_email: FACULTY.email, faculty_phone: FACULTY.phone,
    role: "speaker", topic_title: "Right Colon Malignancy", session_name: "Right Colon Malignancy",
    status: "pending",
  })
  if (insErr) L(`  ✗ insert failed: ${insErr.message}`)
  else L(`  ✓ inserted ${FACULTY.name} as speaker on ${NEW_SESSION_CODE}`)
}

header("5. Send Faculty Invitation (Email + WhatsApp)")
if (!APPLY) {
  L(`  (dry run — re-run with --apply to write + send)`)
  process.exit(0)
}

let portalToken = regRow.custom_fields?.portal_token
if (!portalToken) {
  portalToken = crypto.randomUUID()
  await supabase.from("registrations")
    .update({ custom_fields: { ...(regRow.custom_fields || {}), portal_token: portalToken } })
    .eq("id", regRow.id)
}
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
Session: ${NEW_START.slice(0,5)}–${NEW_END.slice(0,5)}, Day 2 (11 July 2026), ${ref.hall}

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
    <tr><td style="padding:4px 0;color:#6b7280">Session</td><td>${NEW_START.slice(0,5)}–${NEW_END.slice(0,5)}, Day 2 (11 July 2026), ${ref.hall}</td></tr>
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

const { subject, html, text } = buildEmail(FACULTY.name, regRow.registration_number, portalUrl)
const emailRes = await sendEmail(FACULTY.email, subject, html, text)
if (emailRes.ok) L(`  ✉  ${FACULTY.email}  ✓ ${emailRes.id}`)
else L(`  ✉  ${FACULTY.email}  ✗ ${JSON.stringify(emailRes.error)}`)

const waRes = await sendWA(FACULTY.phone, FACULTY.name, portalUrl)
if (waRes.ok) L(`  💬 ${waRes.phone}  ✓ ${waRes.id}`)
else L(`  💬 ${waRes.phone}  ✗ ${JSON.stringify(waRes.error)}`)

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
    message_body: "Template: speaker_invitation (125 FMAS Kolkata - Jayanta Chakraborty, Right Colon Malignancy, 2026-07-07)",
    status: "sent",
    provider_message_id: waRes.id, sent_at: sentAt,
  })
}

const existing = regRow.custom_fields || {}
await supabase.from("registrations").update({
  custom_fields: {
    ...existing, portal_token: portalToken,
    invitation_status: emailRes.ok ? "sent" : existing.invitation_status,
    invitation_sent_at: emailRes.ok ? sentAt : existing.invitation_sent_at,
    invitation_email_id: emailRes.ok ? emailRes.id : existing.invitation_email_id,
    invitation_whatsapp_id: waRes.ok ? waRes.id : existing.invitation_whatsapp_id,
    invitation_send_count: (existing.invitation_send_count || 0) + 1,
  },
}).eq("id", regRow.id)

header("DONE")
