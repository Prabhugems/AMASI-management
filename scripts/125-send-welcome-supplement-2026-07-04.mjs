#!/usr/bin/env node
/**
 * One-shot send of Gallabox `welcome_template` to the 7 supplement delegates
 * of the 125th AMASI Skill Course (CSV batch 125-fmas-kolkata-csv-2026-07-04-supplement)
 * who never received any welcome message — CSV import bypasses the normal
 * registration flow that would have sent this automatically.
 *
 * Hardcoded recipient list — will NOT pick up future additions.
 */
import fs from "node:fs"
import { createClient } from "@supabase/supabase-js"

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

const EVENT_ID = "cb26bbb1-0ab9-4e2f-a391-dcb5636c47d6"
const TEMPLATE = "welcome_template"

const TARGETS = [
  "125A1210","125A1211","125A1212","125A1213",
  "125A1214","125A1215","125A1216",
]

function formatPhone(phone) {
  let cleaned = String(phone || "").replace(/[^0-9]/g, "")
  if (cleaned.length === 10) cleaned = "91" + cleaned
  return cleaned
}

async function sendGallabox(phone, name, bodyValues) {
  const body = {
    channelId: env.GALLABOX_CHANNEL_ID,
    channelType: "whatsapp",
    recipient: { name, phone: formatPhone(phone) },
    whatsapp: {
      type: "template",
      template: { templateName: TEMPLATE, bodyValues },
    },
  }
  const r = await fetch("https://server.gallabox.com/devapi/messages/whatsapp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.GALLABOX_API_KEY,
      apisecret: env.GALLABOX_API_SECRET,
    },
    body: JSON.stringify(body),
  })
  const json = await r.json().catch(() => ({}))
  return {
    ok: r.ok,
    status: r.status,
    messageId: json?.messageId || json?.data?.messageId || json?.id || null,
    error: r.ok ? null : (json?.message || json?.error || `HTTP ${r.status}`),
  }
}

const { data: regs, error: regErr } = await db
  .from("registrations")
  .select("id, registration_number, attendee_name, attendee_phone, attendee_email, status")
  .eq("event_id", EVENT_ID)
  .in("registration_number", TARGETS)
if (regErr) { console.error(regErr); process.exit(1) }

const map = new Map(regs.map((r) => [r.registration_number, r]))
const missing = TARGETS.filter((t) => !map.has(t))
if (missing.length) {
  console.error("ABORT: missing registration_numbers in DB:", missing)
  process.exit(1)
}

console.log(`Targets : ${TARGETS.length}`)
console.log("")

let okCount = 0, failCount = 0
for (const regNum of TARGETS) {
  const r = map.get(regNum)
  if (r.status !== "confirmed") {
    console.log(`SKIP ${regNum} status=${r.status}`)
    continue
  }
  const phone = formatPhone(r.attendee_phone)
  const name = r.attendee_name || "Delegate"

  process.stdout.write(`→ ${regNum}  ${name.padEnd(22)}  ${phone}  ${(r.attendee_email || "").padEnd(30)} ... `)
  const res = await sendGallabox(r.attendee_phone, name, { Name: name })

  const status = res.ok ? "sent" : "failed"
  await db.from("message_logs").insert({
    event_id: EVENT_ID,
    registration_id: r.id,
    channel: "whatsapp",
    provider: "gallabox",
    recipient: phone,
    recipient_name: name,
    subject: null,
    message_body: `Template: ${TEMPLATE} | Name=${name}`,
    status,
    provider_message_id: res.messageId || null,
    error_message: res.error || null,
    sent_at: res.ok ? new Date().toISOString() : null,
    failed_at: res.ok ? null : new Date().toISOString(),
  })

  if (res.ok) { okCount++; console.log(`OK  (id=${res.messageId || "?"})`) }
  else        { failCount++; console.log(`FAIL ${res.status} ${res.error}`) }

  await new Promise((r) => setTimeout(r, 1000))
}

console.log("")
console.log(`Done. Sent=${okCount}  Failed=${failCount}`)
process.exit(failCount > 0 ? 2 : 0)
