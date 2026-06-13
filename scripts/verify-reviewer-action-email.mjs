#!/usr/bin/env node
// Phase verification for reviewer-action sync-send (decline / flag_mismatch /
// request_extension). The reviewer-action POST is reviewer-token-authenticated,
// NOT admin-authenticated — so this script does NOT need an ADMIN_AUTH_COOKIE.
//
// What it proves end-to-end:
//   1. POST /api/abstracts/<id>/reviewer-action succeeds with the reviewer token.
//   2. The response carries notifications: { recipients, sent, failed, details }.
//   3. abstract_notifications has one row per committee recipient with
//      delivery_status='sent' and a non-null sent_at.
//   4. (Optional manual): the email actually lands in each recipient's inbox.
//
// Side effects: the script SEEDS temp rows (team_member committee entry,
// abstract, reviewer pool, assignment) and CLEANS THEM UP at the end. If the
// run is interrupted, the test rows linger — the SQL at the bottom shows how
// to find/remove them by tag.
//
// Usage:
//   API_BASE=http://localhost:3000 \
//   SUPABASE_URL=https://jmdwxymbgxwdsmcwbahp.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   EVENT_ID=<uuid> \
//   RECIPIENT_EMAIL=you@example.com \
//   ACTION=decline \
//   node scripts/verify-reviewer-action-email.mjs

import { createClient } from "@supabase/supabase-js"
import { randomUUID } from "node:crypto"

const API_BASE = process.env.API_BASE ?? "http://localhost:3000"
const EVENT_ID = process.env.EVENT_ID
const RECIPIENT_EMAIL = process.env.RECIPIENT_EMAIL
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const ACTION = process.env.ACTION ?? "decline" // decline | flag_mismatch | request_extension

for (const [k, v] of Object.entries({ EVENT_ID, RECIPIENT_EMAIL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY })) {
  if (!v) { console.error(`Missing required env: ${k}`); process.exit(2) }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const tag = `verify-ra-${Date.now()}`
console.log(`[verify] tag=${tag}  EVENT_ID=${EVENT_ID}  ACTION=${ACTION}  RECIPIENT=${RECIPIENT_EMAIL}`)

let teamMemberId, abstractId, reviewerPoolId, assignmentId
const cleanup = []

try {
  // 1. Seed a temporary committee team_member pointing at RECIPIENT_EMAIL.
  // Use a clearly tagged name so it's identifiable in the dashboard if
  // cleanup ever fails.
  const { data: existingTm } = await supabase
    .from("team_members")
    .select("id, event_ids")
    .eq("email", RECIPIENT_EMAIL.toLowerCase())
    .maybeSingle()

  if (existingTm) {
    // Already exists — just ensure this event is in event_ids. Track whether
    // we added it so cleanup can revert.
    const eventIds = new Set([...(existingTm.event_ids ?? []), EVENT_ID])
    teamMemberId = existingTm.id
    if (!(existingTm.event_ids ?? []).includes(EVENT_ID)) {
      const original = existingTm.event_ids ?? []
      await supabase
        .from("team_members")
        .update({ event_ids: Array.from(eventIds) })
        .eq("id", teamMemberId)
      cleanup.push(async () => {
        await supabase.from("team_members").update({ event_ids: original }).eq("id", teamMemberId)
      })
      console.log(`[verify] added ${EVENT_ID} to existing team_member ${teamMemberId}`)
    } else {
      console.log(`[verify] reusing existing team_member ${teamMemberId} (already had event)`)
    }
  } else {
    const { data: newTm, error } = await supabase
      .from("team_members")
      .insert({
        email: RECIPIENT_EMAIL.toLowerCase(),
        name: `Verify Reviewer-Action [${tag}]`,
        role: "committee_member",
        event_ids: [EVENT_ID],
        is_active: true,
      })
      .select("id")
      .single()
    if (error || !newTm) throw new Error(`team_members seed failed: ${error?.message}`)
    teamMemberId = newTm.id
    cleanup.push(async () => { await supabase.from("team_members").delete().eq("id", teamMemberId) })
    console.log(`[verify] seeded team_member ${teamMemberId}`)
  }

  // 2. Seed a temp abstract on the event (status=under_review so a pending
  // assignment is plausible).
  const { data: cat } = await supabase
    .from("abstract_categories")
    .select("id")
    .eq("event_id", EVENT_ID)
    .eq("is_active", true)
    .limit(1)
    .single()
  if (!cat) throw new Error("no active category on event")

  const abstractNumber = `${tag}-ABS`
  const { data: a, error: aErr } = await supabase
    .from("abstracts")
    .insert({
      event_id: EVENT_ID,
      category_id: cat.id,
      abstract_number: abstractNumber,
      title: `[${tag}] reviewer-action verification abstract`,
      abstract_text: "Verification abstract for reviewer-action sync-send. Safe to discard.",
      presentation_type: "paper",
      presenting_author_name: "Verify RA Author",
      presenting_author_email: RECIPIENT_EMAIL.toLowerCase(),
      status: "under_review",
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single()
  if (aErr || !a) throw new Error(`abstract seed failed: ${aErr?.message}`)
  abstractId = a.id
  cleanup.push(async () => { await supabase.from("abstracts").delete().eq("id", abstractId) })
  console.log(`[verify] seeded abstract ${abstractId} (${abstractNumber})`)

  // 3. Seed a temp reviewer in the reviewer pool + a pending assignment.
  const accessToken = `verify-token-${randomUUID()}`
  const reviewerEmail = `verify-reviewer-${tag}@example.com`
  const { data: rp, error: rpErr } = await supabase
    .from("abstract_reviewer_pool")
    .insert({
      event_id: EVENT_ID,
      email: reviewerEmail,
      name: `Verify Reviewer [${tag}]`,
      access_token: accessToken,
    })
    .select("id")
    .single()
  if (rpErr || !rp) throw new Error(`reviewer_pool seed failed: ${rpErr?.message}`)
  reviewerPoolId = rp.id
  cleanup.push(async () => { await supabase.from("abstract_reviewer_pool").delete().eq("id", reviewerPoolId) })
  console.log(`[verify] seeded reviewer_pool ${reviewerPoolId}  token=${accessToken.slice(0,16)}…`)

  const dueDate = new Date(Date.now() + 7 * 86400000).toISOString()
  const { data: asn, error: asnErr } = await supabase
    .from("abstract_review_assignments")
    .insert({
      abstract_id: abstractId,
      reviewer_id: reviewerPoolId,
      review_round: 1,
      status: "pending",
      due_date: dueDate,
      assigned_at: new Date().toISOString(),
    })
    .select("id")
    .single()
  if (asnErr || !asn) throw new Error(`assignment seed failed: ${asnErr?.message}`)
  assignmentId = asn.id
  cleanup.push(async () => { await supabase.from("abstract_review_assignments").delete().eq("id", assignmentId) })
  console.log(`[verify] seeded assignment ${assignmentId}`)

  // 4. POST the reviewer action
  const bodyByAction = {
    decline: {
      action: "decline",
      reviewer_token: accessToken,
      reason: "not_my_specialty",
      declined_notes: "Phase verify — auto-decline",
      suggested_reviewer_email: "alt-reviewer@example.com",
    },
    flag_mismatch: {
      action: "flag_mismatch",
      reviewer_token: accessToken,
      reason: "Sounds more like a Robotic paper",
      suggested_category: "Robotic",
    },
    request_extension: {
      action: "request_extension",
      reviewer_token: accessToken,
      reason: "Travel — Phase verify",
      extension_days: 3,
    },
  }
  const reqBody = bodyByAction[ACTION]
  if (!reqBody) throw new Error(`unknown ACTION: ${ACTION}`)

  const res = await fetch(`${API_BASE}/api/abstracts/${abstractId}/reviewer-action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reqBody),
  })
  const json = await res.json().catch(() => ({}))
  console.log(`[verify] HTTP ${res.status}`)
  console.log(`[verify] response:`, JSON.stringify(json, null, 2))
  if (!res.ok) throw new Error("reviewer-action rejected")

  if (!json.notifications) throw new Error("response missing notifications field")
  const n = json.notifications
  if (n.skipped) throw new Error(`notifications skipped (recipients=${n.recipients}). Check committee staffing.`)
  if (n.sent < 1) throw new Error(`notifications.sent=${n.sent} (expected >=1)`)

  // 5. Inspect ledger rows. One per recipient.
  const expectedType =
    ACTION === "decline" ? "reviewer_declined"
    : ACTION === "flag_mismatch" ? "category_mismatch"
    : "extension_requested"
  const { data: ledger } = await supabase
    .from("abstract_notifications")
    .select("id, notification_type, delivery_status, sent_at, recipient_email, subject, metadata")
    .eq("abstract_id", abstractId)
    .eq("notification_type", expectedType)
    .order("created_at", { ascending: false })
  console.log(`[verify] ledger rows (${ledger?.length ?? 0}):`, JSON.stringify(ledger, null, 2))
  if (!ledger?.length) throw new Error("no ledger rows written")
  for (const r of ledger) {
    if (r.delivery_status !== "sent") throw new Error(`row to ${r.recipient_email} delivery_status=${r.delivery_status}`)
    if (!r.sent_at) throw new Error(`row to ${r.recipient_email} sent_at null`)
  }

  console.log("[verify] OK — reviewer-action sent, ledger rows all delivery_status='sent', per-recipient send confirmed.")
  console.log(`[verify] Check ${RECIPIENT_EMAIL} inbox to confirm the actual email landed (look for tag ${tag}).`)
} catch (err) {
  console.error("[verify] FAIL:", err.message)
  process.exitCode = 1
} finally {
  // Always cleanup, reverse order
  for (const fn of cleanup.reverse()) {
    try { await fn() } catch (e) { console.error("[cleanup] failed:", e?.message ?? e) }
  }
  // Also wipe the notifications written during the run (cascade from abstract delete already covers it)
  if (abstractId) {
    await supabase.from("abstract_notifications").delete().eq("abstract_id", abstractId)
  }
  console.log(`[verify] cleanup done (tag ${tag})`)
}
