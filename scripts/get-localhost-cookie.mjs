// One-shot: programmatically obtain a Supabase SSR session cookie for the
// localhost dev server.
//
// login-complete does NOT set cookies (it only validates a token + computes
// redirect). Cookies are normally set browser-side by the Supabase JS client.
// To emulate that server-side, we run setSession against a real
// createServerClient with a custom cookie sink — the library writes the cookies
// it would normally hand to a browser into our sink, and we harvest those.
//
// Stdout: a single Cookie header value to pass to subsequent fetches.

import fs from "node:fs"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"

function loadEnv() {
  const raw = fs.readFileSync(".env.local", "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    const [, k, v] = m
    if (!process.env[k]) process.env[k] = v.replace(/^["']|["']$/g, "").trim()
  }
}
loadEnv()

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL.trim()
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim()
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY.trim()
const EMAIL = process.argv[2] || "prabhu3693gems@gmail.com"
const SITE = process.env.SITE || "http://localhost:3000"

const admin = createClient(SUPA, SRK, { auth: { persistSession: false } })
const anon = createClient(SUPA, ANON, { auth: { persistSession: false } })

// 1. Generate magic link → email_otp
const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: EMAIL,
  options: { redirectTo: `${SITE}/auth/callback` },
})
if (linkErr) { console.error("generateLink failed:", linkErr.message); process.exit(1) }
const otp = link.properties?.email_otp
if (!otp) { console.error("no email_otp"); process.exit(1) }

// 2. Exchange OTP for a real session
const { data: verify, error: vErr } = await anon.auth.verifyOtp({
  email: EMAIL, token: otp, type: "email",
})
if (vErr) { console.error("verifyOtp failed:", vErr.message); process.exit(1) }
const session = verify.session
if (!session?.access_token || !session?.refresh_token) {
  console.error("no session tokens from verifyOtp")
  process.exit(1)
}

// 3. Get the cookies @supabase/ssr would write for that session.
// We create a real server client with a sink-only cookie handler and call
// setSession; the library serializes the session in the exact format
// getApiUser's server client expects to read.
const writtenCookies = []
const sinkClient = createServerClient(SUPA, ANON, {
  cookies: {
    getAll() { return [] },
    setAll(cookies) {
      for (const c of cookies) writtenCookies.push(c)
    },
  },
})

const { error: setErr } = await sinkClient.auth.setSession({
  access_token: session.access_token,
  refresh_token: session.refresh_token,
})
if (setErr) { console.error("setSession failed:", setErr.message); process.exit(1) }

if (writtenCookies.length === 0) {
  console.error("setSession produced no cookies — library version mismatch?")
  process.exit(1)
}

const cookieHeader = writtenCookies
  .map(c => `${c.name}=${c.value}`)
  .join("; ")
console.log(cookieHeader)
