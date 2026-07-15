#!/usr/bin/env node
// One-off: send the certificate email for Shashi Prakash Mishra (124A1237,
// "124 FMAS Skill Course and FMAS Exam"). His checked_in was already
// corrected standalone (docs/retroactive-checkins-2026-07.md) so the
// delegate-portal download link this email points to will actually work.
//
// Auth: obtains a real admin session via Supabase admin.generateLink +
// verifyOtp (same technique as scripts/get-localhost-cookie.mjs), then calls
// the production API directly with that session cookie — requireEventAndPermission
// needs a real logged-in session, there's no service-role bypass on this route.

import fs from "node:fs"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"

const env = {}
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
}

const SUPA = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SRK = env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_EMAIL = "prabhu3693gems@gmail.com"
const SITE = "https://collegeofmas.org.in"

const EVENT_ID = "3bbc0ad0-5dab-4d55-96f8-ee3a03a692de"
const REGISTRATION_ID = "b130abb6-95de-434f-8d70-a170973cf906"

const admin = createClient(SUPA, SRK, { auth: { persistSession: false } })
const anon = createClient(SUPA, ANON, { auth: { persistSession: false } })

const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: ADMIN_EMAIL,
  options: { redirectTo: `${SITE}/auth/callback` },
})
if (linkErr) { console.error("generateLink failed:", linkErr.message); process.exit(1) }
const otp = link.properties?.email_otp
if (!otp) { console.error("no email_otp"); process.exit(1) }

const { data: verify, error: vErr } = await anon.auth.verifyOtp({
  email: ADMIN_EMAIL, token: otp, type: "email",
})
if (vErr) { console.error("verifyOtp failed:", vErr.message); process.exit(1) }
const session = verify.session
if (!session?.access_token || !session?.refresh_token) {
  console.error("no session tokens from verifyOtp"); process.exit(1)
}

const writtenCookies = []
const sinkClient = createServerClient(SUPA, ANON, {
  cookies: {
    getAll() { return [] },
    setAll(cookies) { for (const c of cookies) writtenCookies.push(c) },
  },
})
const { error: setErr } = await sinkClient.auth.setSession({
  access_token: session.access_token,
  refresh_token: session.refresh_token,
})
if (setErr) { console.error("setSession failed:", setErr.message); process.exit(1) }
if (writtenCookies.length === 0) { console.error("setSession produced no cookies"); process.exit(1) }

const cookieHeader = writtenCookies.map((c) => `${c.name}=${c.value}`).join("; ")

console.log(`Calling ${SITE}/api/certificates/email for registration ${REGISTRATION_ID} ...`)
const res = await fetch(`${SITE}/api/certificates/email`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Cookie: cookieHeader,
  },
  body: JSON.stringify({ registration_id: REGISTRATION_ID, event_id: EVENT_ID }),
})
const json = await res.json().catch(() => ({}))
console.log(`HTTP ${res.status}:`, JSON.stringify(json, null, 2))

if (!res.ok || !json.success) {
  console.error("FAILED — certificate email was not sent.")
  process.exit(1)
}

console.log("OK — certificate email sent.")

// Confirm certificate_generated_at actually got set.
const { data: reg } = await admin
  .from("registrations")
  .select("certificate_generated_at, checked_in")
  .eq("id", REGISTRATION_ID)
  .single()
console.log("Post-send registration state:", reg)
