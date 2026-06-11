#!/usr/bin/env node
/**
 * Send the canonical TechnoSurg welcome email to the 19 comp delegates
 * inserted via ts-add-comp-delegates-2026-06-11.mjs.
 *
 * Mirrors ts-send-welcome-email-missed-5.mjs exactly.
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
const FROM = "TechnoSurg <noreply@gemhospitals.com>"
const SUBJECT = "Welcome to Technosurg 2026-ITC chola Chennai"
const PORTAL = "https://technosurg.gemhospitals.com/my"

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

const { data: regs, error: rErr } = await db
  .from("registrations")
  .select("id, registration_number, attendee_name, attendee_email")
  .eq("event_id", EVENT_ID)
  .in("attendee_email", TARGET_EMAILS)
if (rErr) { console.error(rErr); process.exit(1) }
const byEmail = new Map(regs.map(r => [r.attendee_email, r]))

const summary = { sent: 0, failed: 0 }
let i = 0
for (const email of TARGET_EMAILS) {
  i++
  const reg = byEmail.get(email)
  if (!reg) {
    console.log(`[${i}/${TARGET_EMAILS.length}] ✗ no registration for ${email}`)
    summary.failed++
    continue
  }
  const name = reg.attendee_name
  const html = bodyHtml(name)
  const text = bodyText(name)

  let res
  try {
    res = await resend.emails.send({
      from: FROM,
      to: [reg.attendee_email],
      subject: SUBJECT,
      html, text,
    })
  } catch (err) {
    res = { error: { message: err.message } }
  }

  if (res?.error) {
    summary.failed++
    const msg = res.error.message || JSON.stringify(res.error)
    console.log(`[${i}/${TARGET_EMAILS.length}] ✗ ${reg.registration_number} <${reg.attendee_email}>: ${msg}`)
    await db.from("message_logs").insert({
      event_id: EVENT_ID,
      registration_id: reg.id,
      channel: "email",
      provider: "default",
      recipient: reg.attendee_email,
      recipient_name: name,
      subject: SUBJECT,
      message_body: text,
      status: "failed",
      error_message: msg,
      failed_at: new Date().toISOString(),
    })
  } else {
    summary.sent++
    console.log(`[${i}/${TARGET_EMAILS.length}] ✓ ${reg.registration_number} ${name} <${reg.attendee_email}>  id=${res?.data?.id}`)
    await db.from("message_logs").insert({
      event_id: EVENT_ID,
      registration_id: reg.id,
      channel: "email",
      provider: "default",
      recipient: reg.attendee_email,
      recipient_name: name,
      subject: SUBJECT,
      message_body: text,
      status: "sent",
      provider_message_id: res?.data?.id,
      sent_at: new Date().toISOString(),
    })
  }

  if (i < TARGET_EMAILS.length) await new Promise(r => setTimeout(r, 650))
}

console.log(`\n--- Summary ---`)
console.log(`Sent:   ${summary.sent}`)
console.log(`Failed: ${summary.failed}`)
