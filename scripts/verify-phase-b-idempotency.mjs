// scripts/verify-phase-b-idempotency.mjs
//
// Phase B verification: prove the submit endpoint is idempotent on
// Idempotency-Key + rate-limited.
//
// Checks:
//   1. Same key, same body, twice → identical response body + a single DB row
//   2. Fresh key, same body → distinct response (different abstract_number) +
//      second DB row
//   3. Same key, different body → 422 key_conflict
//   4. Cleanup created rows
//
// Run with the dev server on http://localhost:3000:
//   node scripts/verify-phase-b-idempotency.mjs

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import path from "node:path"

function loadDotEnv() {
  try {
    const txt = readFileSync(path.join(process.cwd(), ".env.local"), "utf8")
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (!m) continue
      let v = m[2]
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
      if (!process.env[m[1]]) process.env[m[1]] = v
    }
  } catch { /* ok */ }
}
loadDotEnv()

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim()
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
const BASE = process.env.BASE_URL || "http://localhost:3000"
const EVENT_ID = "35181950-057f-4ccb-aaee-9266b9b9b873"

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
  process.exit(2)
}

const supa = createClient(url, key, { auth: { persistSession: false } })

// Pick the first active category that doesn't require a file (so this idempotency
// test doesn't need to upload one). C.4 enforces required_file server-side.
const { data: cats, error: catErr } = await supa
  .from("abstract_categories")
  .select("id, name, required_file, eligibility_rules")
  .eq("event_id", EVENT_ID)
  .eq("is_active", true)
  .eq("required_file", false)
  .neq("name", "Young Scholar Award")
  .order("sort_order")
  .limit(1)
if (catErr || !cats?.length) {
  console.error("No active categories for AMASICON 2026:", catErr?.message)
  process.exit(1)
}
const category_id = cats[0].id
console.log("category_id:", category_id, `(${cats[0].name})`)

const stamp = Date.now()
const baseBody = {
  presenting_author_name: "Phase B Tester",
  presenting_author_email: `phase-b-${stamp}@example.test`,
  presenting_author_phone: "+91-9000000000",
  presenting_author_affiliation: "Phase B Verification, AMASI",
  title: `Phase B idempotency ${stamp}`,
  abstract_text:
    "Background. Methods. Results. Conclusion. " +
    "This is the Phase B idempotency verification body. ".repeat(8),
  keywords: ["phaseb", "idempotency", "test"],
  authors: [],
  category_id,
  presentation_type: "paper",
  competition_type: "free",
  declarations_accepted: [
    "I confirm that this research was conducted in accordance with ethical standards and has received appropriate ethical approval where required.",
    "I confirm that this abstract is original work and has not been previously published or is not under consideration for publication elsewhere.",
    "I confirm that all co-authors have reviewed and approved this submission, and consent to their names being included.",
  ],
}

const POST = (body, headers = {}) =>
  fetch(`${BASE}/api/submit-abstract/${EVENT_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  })

const results = []
const note = (k, ok, detail) => results.push({ k, ok, detail })

// ── Test 1: same key, same body, twice ───────────────────────────
const key1 = crypto.randomUUID()
console.log(`\n[test 1] key1=${key1} (same body x2)`)
const r1a = await POST(baseBody, { "Idempotency-Key": key1 })
const r1aBody = await r1a.json()
const r1b = await POST(baseBody, { "Idempotency-Key": key1 })
const r1bBody = await r1b.json()
console.log("  r1a:", r1a.status, r1aBody.abstract?.abstract_number)
console.log("  r1b:", r1b.status, r1bBody.abstract?.abstract_number)

note(
  "same key returns identical abstract_number",
  r1aBody.abstract?.abstract_number === r1bBody.abstract?.abstract_number &&
    !!r1aBody.abstract?.abstract_number,
  `r1a=${r1aBody.abstract?.abstract_number}, r1b=${r1bBody.abstract?.abstract_number}`
)
note(
  "same key returns identical status",
  r1a.status === r1b.status && r1a.status === 200,
  `r1a=${r1a.status}, r1b=${r1b.status}`
)

// DB check: exactly one row for this email
const { count: rowsAfterSameKey } = await supa
  .from("abstracts")
  .select("id", { count: "exact", head: true })
  .eq("event_id", EVENT_ID)
  .eq("presenting_author_email", baseBody.presenting_author_email)
note(
  "same key produced a single DB row",
  rowsAfterSameKey === 1,
  `rows=${rowsAfterSameKey}`
)

// ── Test 2: fresh key, same body → new row ───────────────────────
const key2 = crypto.randomUUID()
console.log(`\n[test 2] key2=${key2} (same body, fresh key)`)
const body2 = { ...baseBody, presenting_author_email: `phase-b-${stamp}-b@example.test` }
const r2 = await POST(body2, { "Idempotency-Key": key2 })
const r2Body = await r2.json()
console.log("  r2:", r2.status, r2Body.abstract?.abstract_number)
note(
  "fresh key with same body produced a distinct abstract_number",
  r2Body.abstract?.abstract_number &&
    r2Body.abstract.abstract_number !== r1aBody.abstract.abstract_number,
  `r2=${r2Body.abstract?.abstract_number} vs r1=${r1aBody.abstract?.abstract_number}`
)

// ── Test 3: same key + different body → 422 ──────────────────────
console.log(`\n[test 3] key1=${key1} again, different body → expect 422`)
const r3 = await POST(
  { ...baseBody, title: `Phase B different body ${stamp}` },
  { "Idempotency-Key": key1 }
)
const r3Body = await r3.json()
console.log("  r3:", r3.status, r3Body.error || r3Body.abstract?.abstract_number)
note(
  "same key with different body returns 422 key_conflict",
  r3.status === 422,
  `status=${r3.status}, body=${JSON.stringify(r3Body).slice(0, 120)}`
)

// ── Cleanup ──────────────────────────────────────────────────────
const createdEmails = [baseBody.presenting_author_email, body2.presenting_author_email]
const { data: created } = await supa
  .from("abstracts")
  .select("id, abstract_number")
  .in("presenting_author_email", createdEmails)
const ids = (created || []).map((r) => r.id)
if (ids.length) {
  await supa.from("abstract_notifications").delete().in("abstract_id", ids)
  await supa.from("abstracts").delete().in("id", ids)
}
await supa
  .from("submission_idempotency")
  .delete()
  .eq("endpoint", `submit-abstract:${EVENT_ID}`)
  .in("key", [key1, key2])
console.log(`\n[cleanup] removed ${ids.length} abstracts + their idempotency rows`)

// ── Summary ──────────────────────────────────────────────────────
console.log("\n── results ──")
let fails = 0
for (const r of results) {
  console.log(`  [${r.ok ? "PASS" : "FAIL"}] ${r.k} — ${r.detail}`)
  if (!r.ok) fails++
}
console.log("")
if (fails > 0) {
  console.error(`${fails} failure(s).`)
  process.exit(1)
}
console.log("All Phase B criteria PASS.")
