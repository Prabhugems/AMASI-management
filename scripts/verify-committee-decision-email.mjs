#!/usr/bin/env node
// Phase 3 live-fix verification for committee-decision sync-send.
// Sibling to scripts/verify-submission-email.mjs — same proof shape, just
// targets the committee path.
//
// Prereqs:
//   - Dev server (or any deployment of this branch) reachable at API_BASE
//   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env
//   - EVENT_ID = a test event with notify_on_decision=true
//   - RECIPIENT_EMAIL = an inbox you control (the test abstract's
//     presenting_author_email will be set to this; the decision email
//     lands in this inbox)
//   - ADMIN_AUTH_COOKIE = a logged-in session cookie for an event admin/coordinator
//     OR leave empty if you've configured another auth bypass for tests
//   - Optional: REUSE_ABSTRACT_ID = if you'd rather decide on an existing
//     abstract instead of creating a fresh one
//
// What it proves:
//   1. POST /api/abstracts/<id>/committee-decision succeeds.
//   2. The response carries notification: { delivered: true }.
//   3. abstract_notifications has a fresh decision row with
//      delivery_status='sent' and a non-null sent_at.
//   4. abstract_committee_decisions has the audit-log row with the right
//      decision verb, decided_by_email snapshot, and is_override=false.
//   5. abstracts.decision_notified_at was bumped to a recent value.
//   6. (Optional manual): the email actually lands in the inbox.
//
// Usage:
//   API_BASE=http://localhost:3000 \
//   SUPABASE_URL=https://jmdwxymbgxwdsmcwbahp.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   EVENT_ID=<uuid> \
//   RECIPIENT_EMAIL=you@example.com \
//   ADMIN_AUTH_COOKIE='sb-...=...; ...' \
//   node scripts/verify-committee-decision-email.mjs

import { createClient } from "@supabase/supabase-js"

const API_BASE = process.env.API_BASE ?? "http://localhost:3000"
const EVENT_ID = process.env.EVENT_ID
const RECIPIENT_EMAIL = process.env.RECIPIENT_EMAIL
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const ADMIN_AUTH_COOKIE = process.env.ADMIN_AUTH_COOKIE ?? ""
const REUSE_ABSTRACT_ID = process.env.REUSE_ABSTRACT_ID ?? ""
const DECISION = process.env.DECISION ?? "accept_oral"

for (const [k, v] of Object.entries({ EVENT_ID, RECIPIENT_EMAIL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY })) {
  if (!v) {
    console.error(`Missing required env: ${k}`)
    process.exit(2)
  }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

console.log(`[verify] API_BASE=${API_BASE}  EVENT_ID=${EVENT_ID}  RECIPIENT_EMAIL=${RECIPIENT_EMAIL}  DECISION=${DECISION}`)

// 1. Event + settings sanity
const { data: event } = await supabase
  .from("events")
  .select("id, name, short_name")
  .eq("id", EVENT_ID)
  .single()
if (!event) {
  console.error("[verify] event not found")
  process.exit(1)
}
const { data: settings } = await supabase
  .from("abstract_settings")
  .select("notify_on_decision, reviewers_per_abstract")
  .eq("event_id", EVENT_ID)
  .single()
if (settings?.notify_on_decision === false) {
  console.error("[verify] notify_on_decision is FALSE for this event — the route will deliberately skip the send. Pick an event with notify_on_decision=true or flip the flag.")
  process.exit(1)
}
console.log(`[verify] event=${event.short_name || event.name}  notify_on_decision=${settings?.notify_on_decision}  reviewers_per_abstract=${settings?.reviewers_per_abstract}`)

// 2. Pick the abstract to decide on. Either reuse one or seed a fresh one
// via supabase admin (skipping the normal submit flow because we want a
// known-good starting state regardless of the live submission window).
let abstractId = REUSE_ABSTRACT_ID
if (!abstractId) {
  const { data: cat } = await supabase
    .from("abstract_categories")
    .select("id")
    .eq("event_id", EVENT_ID)
    .eq("is_active", true)
    .limit(1)
    .single()
  if (!cat) {
    console.error("[verify] no active category — create one or use REUSE_ABSTRACT_ID")
    process.exit(1)
  }
  const newAbstractNumber = `VERIFY-${Date.now()}`
  const { data: created, error: createErr } = await supabase
    .from("abstracts")
    .insert({
      event_id: EVENT_ID,
      category_id: cat.id,
      abstract_number: newAbstractNumber,
      title: `Phase 3 verification: committee-decision ${new Date().toISOString()}`,
      abstract_text: "Verification abstract for committee-decision sync-send proof. Safe to discard.",
      presentation_type: "paper",
      presenting_author_name: "Verify Phase3 Author",
      presenting_author_email: RECIPIENT_EMAIL,
      status: "under_review",
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single()
  if (createErr || !created) {
    console.error("[verify] failed to seed test abstract:", createErr)
    process.exit(1)
  }
  abstractId = created.id
  console.log(`[verify] seeded test abstract id=${abstractId} number=${newAbstractNumber}`)
}

// 3. Snapshot decision_notified_at BEFORE so we can assert the bump
const { data: before } = await supabase
  .from("abstracts")
  .select("decision_notified_at, status, presenting_author_email")
  .eq("id", abstractId)
  .single()
console.log(`[verify] before: status=${before?.status}  decision_notified_at=${before?.decision_notified_at}`)
if (before?.presenting_author_email?.toLowerCase() !== RECIPIENT_EMAIL.toLowerCase()) {
  console.warn(`[verify] WARNING: abstract presenting_author_email (${before?.presenting_author_email}) does not match RECIPIENT_EMAIL — the email will go to the author of record, not RECIPIENT_EMAIL.`)
}

// 4. POST the decision
const res = await fetch(`${API_BASE}/api/abstracts/${abstractId}/committee-decision`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Idempotency-Key": `verify-cd-${Date.now()}`,
    ...(ADMIN_AUTH_COOKIE ? { Cookie: ADMIN_AUTH_COOKIE } : {}),
  },
  body: JSON.stringify({
    decision: DECISION,
    notes: "Phase 3 verification — automated decision.",
    feedback_to_author: "This is the verification email body — please confirm receipt.",
    send_notification: true,
  }),
})
const json = await res.json().catch(() => ({}))
console.log(`[verify] HTTP ${res.status}`)
console.log(`[verify] response:`, JSON.stringify(json, null, 2))

if (!res.ok) {
  console.error("[verify] committee-decision rejected. Common causes: missing auth cookie, transition-illegal current state, or notify_on_decision=false.")
  process.exit(1)
}
if (!json.notification?.delivered) {
  console.error(`[verify] FAIL — notification.delivered is ${json.notification?.delivered}; error=${json.notification?.error}`)
  process.exit(1)
}

// 5. Inspect the ledger row
const { data: ledger } = await supabase
  .from("abstract_notifications")
  .select("id, notification_type, delivery_status, sent_at, recipient_email, subject, metadata")
  .eq("abstract_id", abstractId)
  .in("notification_type", ["accepted", "rejected", "revision_requested", "second_review_requested"])
  .order("created_at", { ascending: false })
  .limit(1)
const row = ledger?.[0]
console.log(`[verify] ledger row:`, JSON.stringify(row, null, 2))
if (!row) {
  console.error("[verify] FAIL — no abstract_notifications row written for the decision")
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

// 6. Inspect the audit log row
const { data: audit } = await supabase
  .from("abstract_committee_decisions")
  .select("id, decision, decided_by_email, is_override, override_reason, decided_at")
  .eq("abstract_id", abstractId)
  .order("decided_at", { ascending: false })
  .limit(1)
const auditRow = audit?.[0]
console.log(`[verify] audit row:`, JSON.stringify(auditRow, null, 2))
if (!auditRow) {
  console.error("[verify] FAIL — no abstract_committee_decisions row written")
  process.exit(1)
}
if (auditRow.decision !== DECISION) {
  console.error(`[verify] FAIL — audit decision=${auditRow.decision} (expected ${DECISION})`)
  process.exit(1)
}
if (auditRow.is_override !== false) {
  console.error(`[verify] FAIL — audit is_override=${auditRow.is_override} (expected false on first decision)`)
  process.exit(1)
}

// 7. decision_notified_at bumped?
const { data: after } = await supabase
  .from("abstracts")
  .select("decision_notified_at, status, committee_decision, committee_decision_at")
  .eq("id", abstractId)
  .single()
console.log(`[verify] after: status=${after?.status}  committee_decision=${after?.committee_decision}  decision_notified_at=${after?.decision_notified_at}`)
if (!after?.decision_notified_at) {
  console.error("[verify] FAIL — abstracts.decision_notified_at not bumped")
  process.exit(1)
}
if (before?.decision_notified_at && after.decision_notified_at <= before.decision_notified_at) {
  console.error("[verify] FAIL — decision_notified_at not advanced")
  process.exit(1)
}

console.log("[verify] OK — committee-decision sent, ledger row delivery_status='sent', audit row recorded, decision_notified_at bumped.")
console.log("[verify] Check the RECIPIENT_EMAIL inbox to confirm the actual email landed.")
