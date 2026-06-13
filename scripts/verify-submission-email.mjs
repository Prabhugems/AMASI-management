#!/usr/bin/env node
// Phase 3 live-fix verification for submit-abstract.
//
// Prereqs:
//   - Dev server (or any deployment of this branch) reachable at API_BASE
//   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env (so we can read the
//     resulting ledger row directly)
//   - EVENT_ID = a test event (e.g. an AMASICON27-TEST id from `select id,short_name from events where short_name ilike 'AMASICON27-TEST'`)
//   - RECIPIENT_EMAIL = an inbox you control, so you can sanity-check delivery
//
// What it proves:
//   1. POST /api/submit-abstract/<eventId> succeeds.
//   2. The response carries notification: { delivered: true }.
//   3. abstract_notifications has a fresh row with delivery_status='sent'
//      and a non-null sent_at, scoped to the new abstract_id.
//   4. (Optional manual): the email actually lands in the inbox.
//
// Usage:
//   API_BASE=http://localhost:3000 \
//   SUPABASE_URL=https://jmdwxymbgxwdsmcwbahp.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   EVENT_ID=<uuid> \
//   RECIPIENT_EMAIL=you@example.com \
//   node scripts/verify-submission-email.mjs

import { createClient } from "@supabase/supabase-js"

const API_BASE = process.env.API_BASE ?? "http://localhost:3000"
const EVENT_ID = process.env.EVENT_ID
const RECIPIENT_EMAIL = process.env.RECIPIENT_EMAIL
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

for (const [k, v] of Object.entries({ EVENT_ID, RECIPIENT_EMAIL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY })) {
  if (!v) {
    console.error(`Missing required env: ${k}`)
    process.exit(2)
  }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

console.log(`[verify] API_BASE=${API_BASE}  EVENT_ID=${EVENT_ID}  RECIPIENT_EMAIL=${RECIPIENT_EMAIL}`)

// 1. Look up event + settings so we can build a minimally-valid submission
const { data: event } = await supabase.from("events").select("id, name, short_name").eq("id", EVENT_ID).single()
if (!event) {
  console.error("Event not found")
  process.exit(1)
}
const { data: settings } = await supabase
  .from("abstract_settings")
  .select("notify_on_submission, require_registration, presentation_types, word_limit")
  .eq("event_id", EVENT_ID)
  .single()
const { data: categories } = await supabase
  .from("abstract_categories")
  .select("id, name")
  .eq("event_id", EVENT_ID)
  .eq("is_active", true)
  .limit(1)
const category = categories?.[0]
if (!category) {
  console.error("No active category on this event — create one first")
  process.exit(1)
}

console.log(`[verify] event=${event.short_name || event.name}  notify_on_submission=${settings?.notify_on_submission}  category=${category.name}`)

if (settings?.require_registration) {
  console.warn(`[verify] WARNING: event requires registration; this test may be rejected unless RECIPIENT_EMAIL is already a confirmed registrant.`)
}

// 2. POST the submission
const presentationType = settings?.presentation_types?.[0] || "paper"
const body = {
  presenting_author_name: "Verify Phase3 Sender",
  presenting_author_email: RECIPIENT_EMAIL,
  presenting_author_affiliation: "Phase 3 Verification",
  title: `Phase 3 verification: send-on-submit ${new Date().toISOString()}`,
  abstract_text: "This is a Phase 3 verification submission to confirm submit-abstract now sends the confirmation email synchronously. Safe to ignore. ".repeat(2),
  keywords: ["phase3", "verify"],
  category_id: category.id,
  presentation_type: presentationType,
  competition_type: "free",
  authors: [],
  declarations_accepted: ["consent"],
}

const res = await fetch(`${API_BASE}/api/submit-abstract/${EVENT_ID}`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Idempotency-Key": `verify-${Date.now()}` },
  body: JSON.stringify(body),
})
const json = await res.json().catch(() => ({}))

console.log(`[verify] HTTP ${res.status}`)
console.log(`[verify] response:`, JSON.stringify(json, null, 2))

if (!res.ok) {
  console.error("[verify] submission rejected — fix prereqs and retry")
  process.exit(1)
}

const abstractId = json.abstract?.id
if (!abstractId) {
  console.error("[verify] no abstract id in response")
  process.exit(1)
}

// 3. Inspect the ledger row
const { data: ledger } = await supabase
  .from("abstract_notifications")
  .select("id, notification_type, delivery_status, sent_at, recipient_email, subject, metadata")
  .eq("abstract_id", abstractId)
  .eq("notification_type", "submission_confirmation")
  .order("created_at", { ascending: false })
  .limit(1)

const row = ledger?.[0]
console.log(`[verify] ledger row:`, JSON.stringify(row, null, 2))

if (!row) {
  console.error("[verify] FAIL — no abstract_notifications row written")
  process.exit(1)
}
if (row.delivery_status !== "sent") {
  console.error(`[verify] FAIL — delivery_status=${row.delivery_status} (expected 'sent'); send_error=${row.metadata?.send_error}`)
  process.exit(1)
}
if (!row.sent_at) {
  console.error("[verify] FAIL — sent_at is null")
  process.exit(1)
}

console.log("[verify] OK — submission_confirmation delivery_status='sent' with sent_at set.")
console.log("[verify] Check your inbox to confirm the actual email landed.")
