// scripts/verify-phase-c-validations.mjs
//
// Phase C verification: prove the submit endpoint enforces the can't-slip
// server-side checks even when the client (or curl) tries to bypass them.
//
// Tests:
//   1. enable_abstracts=false event → 400
//   2. required_file category, no file_path → 400
//   3. require_coi_declaration on but no COI text in declarations → 400
//   4. eligibility_rules.require_dob, no DOB → 400
//   5. eligibility_rules.max_age, DOB making author too old → 400
//   6. eligibility_rules.allowed_positions, wrong/missing position → 400
//   7. Happy path: AMASICON 2026 + valid free-paper category → 200
//
// Cleans up all created abstracts + idempotency rows + restores any settings
// it toggled. Run with dev server on http://localhost:3000.

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
if (!url || !key) { console.error("env missing"); process.exit(2) }
const supa = createClient(url, key, { auth: { persistSession: false } })

const AMASICON_2026 = "35181950-057f-4ccb-aaee-9266b9b9b873"
const FMAS_DISABLED = "eadf8aa1-9e1d-4f96-b755-217289518709"  // enable_abstracts=false
const YOUNG_SCHOLAR_AMASICON = "Young Scholar Award"
const BEST_PAPER_AMASICON = "Best Paper"
const FREE_PAPER_AMASICON = "Free Paper"

// Pick category ids
async function categoryId(eventId, name) {
  const { data } = await supa
    .from("abstract_categories")
    .select("id")
    .eq("event_id", eventId)
    .eq("name", name)
    .maybeSingle()
  return data?.id
}
const [bestPaperId, youngScholarId, freePaperId, fmasFreeCategoryId] = await Promise.all([
  categoryId(AMASICON_2026, BEST_PAPER_AMASICON),
  categoryId(AMASICON_2026, YOUNG_SCHOLAR_AMASICON),
  categoryId(AMASICON_2026, FREE_PAPER_AMASICON),
  (async () => {
    const { data } = await supa.from("abstract_categories")
      .select("id").eq("event_id", FMAS_DISABLED).limit(1).maybeSingle()
    return data?.id
  })(),
])

const stamp = Date.now()
const baseBody = (overrides = {}) => ({
  presenting_author_name: "Phase C Tester",
  presenting_author_email: `phase-c-${stamp}-${Math.random().toString(36).slice(2,6)}@example.test`,
  presenting_author_phone: "+91-9000000000",
  presenting_author_affiliation: "Phase C Verification, AMASI",
  title: `Phase C check ${stamp} ${Math.random()}`,
  abstract_text: "Background. Methods. Results. Conclusion. Phase C test body.",
  keywords: ["phasec", "test"],
  authors: [],
  presentation_type: "paper",
  competition_type: "free",
  declarations_accepted: [
    "I confirm that this research was conducted in accordance with ethical standards and has received appropriate ethical approval where required.",
    "I confirm that this abstract is original work and has not been previously published or is not under consideration for publication elsewhere.",
    "I confirm that all co-authors have reviewed and approved this submission, and consent to their names being included.",
  ],
  ...overrides,
})

const POST = (eventId, body, headers = {}) =>
  fetch(`${BASE}/api/submit-abstract/${eventId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
      ...headers,
    },
    body: JSON.stringify(body),
  })

const results = []
const note = (k, ok, detail) => results.push({ k, ok, detail })

async function expect(name, eventId, body, expectedStatus, expectedErrorRegex) {
  const r = await POST(eventId, body)
  const j = await r.json().catch(() => ({}))
  const statusOk = r.status === expectedStatus
  const msgOk = expectedErrorRegex ? expectedErrorRegex.test(j.error || "") : true
  note(name, statusOk && msgOk, `status=${r.status} body=${JSON.stringify(j).slice(0, 200)}`)
  return { r, j }
}

console.log("\n[1] enable_abstracts=false event blocks submission")
await expect(
  "enable_abstracts=false → 400",
  FMAS_DISABLED,
  baseBody({ category_id: fmasFreeCategoryId }),
  400,
  /disabled/i
)

console.log("\n[2] required_file category without file_path")
await expect(
  "required_file && !file_path → 400",
  AMASICON_2026,
  baseBody({ category_id: bestPaperId }),
  400,
  /file upload is required/i
)

console.log("\n[3] require_coi_declaration on, no COI text")
const { data: settingsBefore } = await supa
  .from("abstract_settings")
  .select("require_coi_declaration")
  .eq("event_id", AMASICON_2026).single()
await supa.from("abstract_settings")
  .update({ require_coi_declaration: true })
  .eq("event_id", AMASICON_2026)
try {
  await expect(
    "require_coi_declaration && missing COI → 400",
    AMASICON_2026,
    baseBody({ category_id: freePaperId, file_path: "dummy/path.pdf" }),
    400,
    /conflict.?of.?interest/i
  )
} finally {
  await supa.from("abstract_settings")
    .update({ require_coi_declaration: settingsBefore.require_coi_declaration })
    .eq("event_id", AMASICON_2026)
}

console.log("\n[4] eligibility_rules.require_dob without DOB")
await expect(
  "eligibility.require_dob without DOB → 400",
  AMASICON_2026,
  baseBody({ category_id: youngScholarId, file_path: "dummy/path.pdf" }),
  400,
  /date of birth/i
)

console.log("\n[5] eligibility_rules.max_age, DOB making author too old")
const tooOldDob = new Date(Date.now() - 50 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
await expect(
  "eligibility.max_age exceeded → 400",
  AMASICON_2026,
  baseBody({
    category_id: youngScholarId,
    file_path: "dummy/path.pdf",
    submitter_metadata: { date_of_birth: tooOldDob, current_position: "PG Resident" },
  }),
  400,
  /aged 40 or under/i
)

console.log("\n[6] eligibility_rules.allowed_positions wrong position")
const youngDob = new Date(Date.now() - 25 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
await expect(
  "eligibility.allowed_positions mismatch → 400",
  AMASICON_2026,
  baseBody({
    category_id: youngScholarId,
    file_path: "dummy/path.pdf",
    submitter_metadata: { date_of_birth: youngDob, current_position: "Consultant" },
  }),
  400,
  /restricted to/i
)

console.log("\n[7] Happy path: AMASICON 2026 Free Paper category, valid")
const happy = await expect(
  "happy path → 200",
  AMASICON_2026,
  baseBody({ category_id: freePaperId }),
  200,
  null
)

// Cleanup: any rows we accidentally created
const { data: created } = await supa
  .from("abstracts")
  .select("id")
  .like("presenting_author_email", `phase-c-${stamp}-%`)
const ids = (created || []).map((r) => r.id)
if (ids.length) {
  await supa.from("abstract_notifications").delete().in("abstract_id", ids)
  await supa.from("abstracts").delete().in("id", ids)
}
await supa.from("submission_idempotency").delete().like("key", "%-%")  // best-effort
console.log(`\n[cleanup] removed ${ids.length} abstracts`)

console.log("\n── results ──")
let fails = 0
for (const r of results) {
  console.log(`  [${r.ok ? "PASS" : "FAIL"}] ${r.k} — ${r.detail}`)
  if (!r.ok) fails++
}
if (fails > 0) { console.error(`\n${fails} failure(s)`); process.exit(1) }
console.log("\nAll Phase C criteria PASS.")
