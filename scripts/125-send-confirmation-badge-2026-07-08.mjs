#!/usr/bin/env node
/**
 * For the same 7 supplement delegates (125A1210-125A1216) who already got
 * the `welcome_template` WhatsApp: send registration confirmation email +
 * badge email + badge WhatsApp. Does NOT resend the welcome message.
 */
import fs from "node:fs"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

const env = {}
for (const line of fs.readFileSync(
  "/Users/prabhubalasubramaniam/amasi-faculty-management/.env.local",
  "utf8"
).split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const resend = new Resend(env.RESEND_API_KEY)
const BASE_URL = "https://collegeofmas.org.in"

const EVENT_ID = "cb26bbb1-0ab9-4e2f-a391-dcb5636c47d6"
const TARGETS = [
  "125A1210","125A1211","125A1212","125A1213",
  "125A1214","125A1215","125A1216",
]

const { data: regs, error: regErr } = await db
  .from("registrations")
  .select(`
    id, registration_number, attendee_name, attendee_email, attendee_phone,
    checkin_token, total_amount, payment_status, status,
    ticket_type:ticket_types(name)
  `)
  .eq("event_id", EVENT_ID)
  .in("registration_number", TARGETS)
if (regErr) { console.error(regErr); process.exit(1) }

const { data: event } = await db
  .from("events")
  .select("name, short_name, start_date, venue_name, city")
  .eq("id", EVENT_ID)
  .single()

const eventName = event?.short_name || event?.name || "Event"
const eventVenue = event?.venue_name ? `${event.venue_name}${event.city ? `, ${event.city}` : ""}` : ""

const map = new Map(regs.map((r) => [r.registration_number, r]))
const missing = TARGETS.filter((t) => !map.has(t))
if (missing.length) {
  console.error("ABORT: missing registration_numbers in DB:", missing)
  process.exit(1)
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ))
}

async function sendConfirmationEmail(r) {
  const res = await fetch(`${BASE_URL}/api/email/registration-confirmation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": env.SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      registration_id: r.id,
      registration_number: r.registration_number,
      attendee_name: r.attendee_name,
      attendee_email: r.attendee_email,
      event_id: EVENT_ID,
      event_name: eventName,
      event_date: event?.start_date || "",
      event_venue: eventVenue,
      ticket_name: r.ticket_type?.name || "",
      quantity: 1,
      total_amount: Number(r.total_amount) || 0,
      payment_method: "razorpay",
      payment_status: r.payment_status,
    }),
  })
  const ok = res.ok
  const json = await res.json().catch(() => ({}))
  return { ok, error: ok ? null : (json?.error || `HTTP ${res.status}`) }
}

async function sendBadgeEmail(r) {
  const badgeUrl = `${BASE_URL}/api/badge/${r.checkin_token}/download`
  const subject = `Your Badge for ${eventName}`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">${escapeHtml(eventName)}</h1>
      </div>
      <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef;">
        <h2 style="color: #333; margin: 0 0 20px 0;">Hello ${escapeHtml(r.attendee_name)}!</h2>
        <p style="color: #666; line-height: 1.6;">Your event badge is ready! You can download and print it before arriving at the event.</p>
        <div style="background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #666; width: 40%;">Name:</td><td style="padding: 8px 0; color: #333; font-weight: bold;">${escapeHtml(r.attendee_name)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Registration #:</td><td style="padding: 8px 0; color: #333; font-weight: bold;">${escapeHtml(r.registration_number)}</td></tr>
            ${r.ticket_type?.name ? `<tr><td style="padding: 8px 0; color: #666;">Ticket Type:</td><td style="padding: 8px 0; color: #333;">${escapeHtml(r.ticket_type.name)}</td></tr>` : ""}
          </table>
        </div>
        ${eventVenue ? `<p style="color: #666; line-height: 1.6;"><strong>Venue:</strong> ${escapeHtml(eventVenue)}</p>` : ""}
        <div style="text-align: center; margin-top: 30px;">
          <a href="${badgeUrl}" style="display: inline-block; background: #1e3a5f; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Download Your Badge</a>
        </div>
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">Print this badge and bring it to the event for faster check-in.</p>
      </div>
    </div>
  `
  const result = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL || "AMASI Events <noreply@resend.dev>",
    to: [r.attendee_email],
    subject,
    html,
  })
  const ok = !result.error
  await db.from("email_logs").insert({
    registration_id: r.id,
    event_id: EVENT_ID,
    recipient_email: r.attendee_email,
    subject,
    template_type: "badge",
    status: ok ? "sent" : "failed",
    provider: "resend",
    provider_message_id: result.data?.id ?? null,
    error: ok ? null : (result.error?.message || JSON.stringify(result.error)),
  })
  return { ok, error: ok ? null : result.error?.message }
}

async function sendBadgeWhatsapp(r) {
  const res = await fetch(`${BASE_URL}/api/kiosk/whatsapp-badge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_id: EVENT_ID, registration_id: r.id }),
  })
  const json = await res.json().catch(() => ({}))
  const ok = res.ok && json.success
  await db.from("message_logs").insert({
    event_id: EVENT_ID,
    registration_id: r.id,
    channel: "whatsapp",
    provider: "gallabox",
    recipient: r.attendee_phone,
    recipient_name: r.attendee_name,
    subject: null,
    message_body: "Template: delegate_login (badge link)",
    status: ok ? "sent" : "failed",
    error_message: ok ? null : (json.message || `HTTP ${res.status}`),
    sent_at: ok ? new Date().toISOString() : null,
    failed_at: ok ? null : new Date().toISOString(),
  })
  return { ok, error: ok ? null : json.message }
}

let stats = { emailOk: 0, emailFail: 0, badgeOk: 0, badgeFail: 0, waOk: 0, waFail: 0 }

for (const regNum of TARGETS) {
  const r = map.get(regNum)
  console.log(`\n=== ${regNum}  ${r.attendee_name}  ${r.attendee_email} ===`)

  const confRes = await sendConfirmationEmail(r)
  console.log(`  confirmation email: ${confRes.ok ? "OK" : "FAIL " + confRes.error}`)
  confRes.ok ? stats.emailOk++ : stats.emailFail++
  await new Promise((res) => setTimeout(res, 600))

  const badgeRes = await sendBadgeEmail(r)
  console.log(`  badge email:        ${badgeRes.ok ? "OK" : "FAIL " + badgeRes.error}`)
  badgeRes.ok ? stats.badgeOk++ : stats.badgeFail++
  await new Promise((res) => setTimeout(res, 600))

  const waRes = await sendBadgeWhatsapp(r)
  console.log(`  badge whatsapp:     ${waRes.ok ? "OK" : "FAIL " + waRes.error}`)
  waRes.ok ? stats.waOk++ : stats.waFail++
  await new Promise((res) => setTimeout(res, 1000))
}

console.log("\n=== Summary ===")
console.log(`Confirmation email: ${stats.emailOk} ok, ${stats.emailFail} failed`)
console.log(`Badge email:        ${stats.badgeOk} ok, ${stats.badgeFail} failed`)
console.log(`Badge WhatsApp:     ${stats.waOk} ok, ${stats.waFail} failed`)
