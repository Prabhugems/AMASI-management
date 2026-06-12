// scripts/verify-phase-a-upload.mjs
//
// Verifies a single abstract submission produced by the Phase A wizard chain
// against the live AMASI Supabase. Pass criteria per the Phase A plan:
//
//   1. New row: file_path populated, file_url NULL
//   2. Storage object exists under abstract-files/<eventId>/...
//   3. A fresh signed URL fetches real bytes (Content-Length matches file_size)
//   4. award_type is non-NULL
//   5. declarations_accepted shape noted (array vs boolean) — diagnostic, not gating
//   6. abstract_notifications: row or no-row; notification failure must not roll back insert
//
// Usage:
//   node scripts/verify-phase-a-upload.mjs ABS-2026-006
//   node scripts/verify-phase-a-upload.mjs ABS-2026-007
//
// Requires .env.local to populate NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY (Vercel-style — script trims any trailing newline).

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
  } catch {
    /* fine if .env.local missing — assume env already set */
  }
}

loadDotEnv()

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim()
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
const abstractNumber = process.argv[2]

if (!abstractNumber) {
  console.error("Usage: node scripts/verify-phase-a-upload.mjs <ABS-YYYY-NNN>")
  process.exit(2)
}
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
  process.exit(2)
}

const supa = createClient(url, key, { auth: { persistSession: false } })
const results = []
const note = (k, ok, detail) => results.push({ k, ok, detail })

console.log(`\n── verifying ${abstractNumber} ──\n`)

// 1) Row by abstract_number
const { data: row, error: rowErr } = await supa
  .from("abstracts")
  .select(
    "id,abstract_number,event_id,file_path,file_url,file_name,file_size," +
      "award_type,status,declarations_accepted,submitted_at,created_at"
  )
  .eq("abstract_number", abstractNumber)
  .maybeSingle()

if (rowErr || !row) {
  console.error("Row lookup failed:", rowErr?.message || "no row")
  process.exit(1)
}

console.log("ROW:", {
  id: row.id,
  event_id: row.event_id,
  file_path: row.file_path,
  file_url: row.file_url,
  file_size: row.file_size,
  award_type: row.award_type,
  status: row.status,
  submitted_at: row.submitted_at,
})

// Criterion 1: file_path populated, file_url NULL
note(
  "file_path populated",
  !!row.file_path,
  row.file_path || "(empty)"
)
note(
  "file_url NULL",
  row.file_url === null,
  `file_url=${JSON.stringify(row.file_url)}`
)

// Criterion 4: award_type non-NULL
note(
  "award_type non-NULL",
  row.award_type !== null && row.award_type !== "",
  `award_type=${JSON.stringify(row.award_type)}`
)

// Criterion 5: declarations_accepted shape diagnostic
const decType = Array.isArray(row.declarations_accepted)
  ? "array"
  : typeof row.declarations_accepted
note(
  "declarations_accepted shape (diagnostic)",
  true,
  `shape=${decType}, value=${JSON.stringify(row.declarations_accepted)}`
)

// Criterion 2: storage object exists at file_path with matching size
let storageSize = null
if (row.file_path) {
  // list the directory and find this file
  const dir = row.file_path.includes("/") ? row.file_path.split("/").slice(0, -1).join("/") : ""
  const name = row.file_path.split("/").pop()
  const { data: list, error: listErr } = await supa.storage
    .from("abstract-files")
    .list(dir, { limit: 1000, search: name })
  if (listErr) {
    note("storage object exists", false, listErr.message)
  } else {
    const match = (list || []).find((o) => o.name === name)
    if (!match) {
      note("storage object exists", false, `not found at ${row.file_path}`)
    } else {
      storageSize = match.metadata?.size ?? null
      note(
        "storage object exists",
        true,
        `path=${row.file_path}, storage_size=${storageSize}, row.file_size=${row.file_size}, match=${storageSize === row.file_size}`
      )
    }
  }
}

// Criterion 3: fresh signed URL fetches the real bytes
if (row.file_path) {
  const { data: signed, error: signErr } = await supa.storage
    .from("abstract-files")
    .createSignedUrl(row.file_path, 300)
  if (signErr || !signed?.signedUrl) {
    note("signed URL generated", false, signErr?.message || "no url")
  } else {
    const res = await fetch(signed.signedUrl)
    const cl = res.headers.get("content-length")
    const buf = Buffer.from(await res.arrayBuffer())
    const ok = res.ok && Number(cl) === row.file_size && buf.length === row.file_size
    note(
      "signed URL returns real bytes (Content-Length matches file_size)",
      ok,
      `status=${res.status}, Content-Length=${cl}, actual=${buf.length}, expected file_size=${row.file_size}`
    )
  }
}

// Criterion 6: notification diagnostic (either way is acceptable for pass)
const { data: notif, error: nErr } = await supa
  .from("abstract_notifications")
  .select("id,notification_type,recipient_email,delivery_status,created_at")
  .eq("abstract_id", row.id)
if (nErr) {
  note("abstract_notifications query (diagnostic)", true, `error: ${nErr.message}`)
} else {
  note(
    "abstract_notifications (diagnostic; either is acceptable)",
    true,
    `${(notif || []).length} row(s) for abstract_id=${row.id}`
  )
}

// Summary
console.log("\n── results ──")
let hardFails = 0
for (const r of results) {
  const isDiagnostic = r.k.includes("diagnostic")
  const tag = r.ok ? "PASS" : isDiagnostic ? "NOTE" : "FAIL"
  if (!r.ok && !isDiagnostic) hardFails++
  console.log(`  [${tag}] ${r.k} — ${r.detail}`)
}
console.log("")
if (hardFails > 0) {
  console.error(`${hardFails} hard failure(s).`)
  process.exit(1)
}
console.log("All hard criteria PASS.")
