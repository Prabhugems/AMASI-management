#!/usr/bin/env node
/**
 * Send FMAS Examiner invitation (email only) to the 9 Gynae-track FMAS
 * examiners listed in AMASI SKILL COURSE-1 (1).docx for the 125th AMASI
 * Skill Course & FMAS Exam, Kolkata, 10-12 July 2026.
 *
 * Gynae FMAS exam is on Day 2 (Saturday, 11 July 2026), Gynae Hall:
 *   14:00 - 15:00  Theory (60 MCQ)
 *   15:00 - 17:00  Practical, OSCE & Viva Voce
 *   17:00 -        Result Compilation & Certificates
 *
 * Idempotent: skips registrations where custom_fields.fmas_examiner_invite_sent_at
 * is set, unless --force is passed.
 *
 * Default is DRY RUN. Pass --apply to actually send.
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
const RESEND_FROM = env.RESEND_FROM_EMAIL || "AMASI Events <noreply@amasi.org>"
const APP_URL = "https://collegeofmas.org.in"

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

const EVENT = {
  id: "cb26bbb1-0ab9-4e2f-a391-dcb5636c47d6",
  name: "125th AMASI Skill Course and FMAS Exam",
  short: "125th AMASI Skill Course",
  date_range: "10 - 12 July 2026",
  venue: "IPGMER / SSKM Hospital, Kolkata",
  convenor: "Dr Seeraj Ahmed",
  secretary: "Dr Roshan Shetty",
}

// 9 Gynae FMAS examiners from the doc, matched to faculty registrations
const TARGET_REG_NUMBERS = [
  "125F2028", // Dr Subrata Lal Seal
  "125F2032", // Dr Amit Basu
  "125F2030", // Dr Pushan Kundu
  "125F2029", // Dr Biswajyoti Guha
  "125F2031", // Dr Mandira Dasgupta
  "125F2047", // Dr Abhinibesh Chatterjee
  "125F2040", // Dr Abhijit Halder
  "125F2045", // Dr G S Kamilya
  "125F2046", // Dr Sudip Basu
]

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
  if (r.attendee_email.includes("@placeholder.")) return false
  if (!FORCE && r.custom_fields?.fmas_examiner_invite_sent_at) return false
  return true
})

console.log(`\nMode: ${APPLY ? "APPLY" : "DRY RUN"}${FORCE ? " (force resend)" : ""}`)
console.log(`Targets: ${targets.length} of ${TARGET_REG_NUMBERS.length} reg numbers`)
const skipped = regs.length - targets.length
if (skipped) console.log(`Skipped: ${skipped} (already sent or no real email)`)
console.log()
for (const r of targets) console.log(`  -> ${r.registration_number}  ${r.attendee_name}  ${r.attendee_email}`)

if (!APPLY) { console.log(`\n(dry run -- re-run with --apply to send)`); process.exit(0) }

function buildEmail(name, regNo, portalUrl) {
  const subject = `Invitation as FMAS Examiner -- 125th AMASI Skill Course, Kolkata (Saturday 11 July)`
  const text = `Dear Dr ${name},

Greetings from AMASI.

It is our privilege to invite you as an FMAS Examiner for the 125th AMASI Skill Course & FMAS Examination (Gynaecology Track) being conducted at IPGMER / SSKM Hospital, Kolkata.

EXAMINER ASSIGNMENT
Date:    Saturday, 11 July 2026
Venue:   Gynae Hall, IPGMER / SSKM Hospital, Kolkata

Theory Examination (60 MCQ):           14:00 - 15:00
Practical Examination, OSCE & Viva:    15:00 - 17:00
Result Compilation & Certificates:     17:00 onwards

The Gynaecology component of the course concludes on Day 2 (Saturday, 11 July) with the FMAS examination. You are welcome to plan your return travel for Saturday evening or Sunday morning.

SPEAKER PORTAL
Please confirm your participation and submit travel & accommodation requirements at:
${portalUrl}

Your Faculty Registration ID: ${regNo}

We deeply appreciate your support in evaluating the next generation of minimal access gynaecologists.

Warm regards,
${EVENT.convenor} -- Convenor, 125th AMASI Skill Course
${EVENT.secretary} -- Honorary Secretary, AMASI

Venue: ${EVENT.venue}
Dates: ${EVENT.date_range}
`
  const html = `<!DOCTYPE html><html><body style="font-family:Segoe UI,Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px;color:#1f2937;line-height:1.6">
<div style="background:linear-gradient(135deg,#7c3aed,#5b21b6);color:white;padding:28px 30px;border-radius:14px 14px 0 0;text-align:center">
  <h1 style="margin:0;font-size:22px;font-weight:700">Invitation as FMAS Examiner</h1>
  <p style="margin:8px 0 0 0;font-size:14px;opacity:0.92">125th AMASI Skill Course & FMAS Exam &middot; Kolkata</p>
</div>
<div style="background:white;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 14px 14px;padding:30px">
  <p style="margin:0 0 16px 0">Dear <strong>Dr ${name}</strong>,</p>
  <p style="margin:0 0 18px 0">Greetings from AMASI.</p>
  <p style="margin:0 0 18px 0">It is our privilege to invite you as an <strong>FMAS Examiner</strong> for the 125th AMASI Skill Course &amp; FMAS Examination (Gynaecology Track) being conducted at <strong>IPGMER / SSKM Hospital, Kolkata</strong>.</p>

  <div style="background:#faf5ff;border:1px solid #e9d5ff;border-left:4px solid #7c3aed;border-radius:10px;padding:18px 20px;margin:22px 0">
    <h3 style="margin:0 0 12px 0;color:#5b21b6;font-size:15px">Examiner Assignment</h3>
    <table style="width:100%;font-size:14px">
      <tr><td style="padding:4px 0;color:#6b7280;width:48%">Date</td><td><strong>Saturday, 11 July 2026</strong></td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Venue</td><td>Gynae Hall, IPGMER / SSKM Hospital, Kolkata</td></tr>
      <tr><td style="padding:10px 0 4px 0;color:#6b7280">Theory (60 MCQ)</td><td style="padding-top:10px">14:00 - 15:00</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Practical, OSCE &amp; Viva</td><td>15:00 - 17:00</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">Result &amp; Certificates</td><td>17:00 onwards</td></tr>
    </table>
  </div>

  <p style="margin:0 0 18px 0">The Gynaecology component of the course concludes on <strong>Day 2 (Saturday, 11 July)</strong> with the FMAS examination. You are welcome to plan your return travel for Saturday evening or Sunday morning.</p>

  <div style="text-align:center;margin:28px 0">
    <a href="${portalUrl}" style="display:inline-block;background:#7c3aed;color:white;padding:14px 30px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Confirm &amp; Submit Travel Details</a>
    <p style="margin:14px 0 0 0;font-size:12px;color:#6b7280">Faculty Registration ID: <strong>${regNo}</strong></p>
  </div>

  <p style="margin:18px 0">We deeply appreciate your support in evaluating the next generation of minimal access gynaecologists.</p>

  <p style="margin:24px 0 0 0;font-size:14px">
    Warm regards,<br>
    <strong>${EVENT.convenor}</strong> &mdash; Convenor, 125th AMASI Skill Course<br>
    <strong>${EVENT.secretary}</strong> &mdash; Honorary Secretary, AMASI
  </p>
  <p style="margin:18px 0 0 0;font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:14px">
    Venue: ${EVENT.venue} &middot; Dates: ${EVENT.date_range}
  </p>
</div>
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

const results = { sent: 0, failed: 0, failures: [] }

for (const reg of targets) {
  const name = reg.attendee_name
  const regNo = reg.registration_number
  console.log(`\n-> ${regNo} ${name} <${reg.attendee_email}>`)

  let portalToken = reg.custom_fields?.portal_token
  if (!portalToken) {
    portalToken = crypto.randomUUID()
    await supabase.from("registrations")
      .update({ custom_fields: { ...(reg.custom_fields || {}), portal_token: portalToken } })
      .eq("id", reg.id)
  }
  const portalUrl = `${APP_URL}/speaker/${portalToken}`

  const { subject, text, html } = buildEmail(name, regNo, portalUrl)
  const res = await sendEmail(reg.attendee_email, subject, html, text)
  if (!res.ok) {
    console.log(`   email FAIL:`, res.error)
    results.failed++
    results.failures.push({ regNo, name, error: res.error })
    continue
  }
  console.log(`   email ok  id=${res.id}`)
  results.sent++

  const merged = {
    ...(reg.custom_fields || {}),
    portal_token: portalToken,
    fmas_examiner_invite_sent_at: new Date().toISOString(),
    fmas_examiner_invite_email_id: res.id,
    fmas_examiner_invite_send_count: ((reg.custom_fields?.fmas_examiner_invite_send_count || 0) + 1),
  }
  await supabase.from("registrations")
    .update({ custom_fields: merged })
    .eq("id", reg.id)

  // Small throttle to be polite to Resend
  await new Promise(r => setTimeout(r, 250))
}

console.log(`\n--- Summary ---`)
console.log(`Sent:   ${results.sent}`)
console.log(`Failed: ${results.failed}`)
if (results.failures.length) console.log(`Failures:`, JSON.stringify(results.failures, null, 2))
