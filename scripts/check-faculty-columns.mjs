#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
  }
}
loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL.trim()
const host = url.replace(/^https?:\/\//, "").split(".")[0]
console.log(`Connected to Supabase project: ${host}`)

const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY.trim(), {
  auth: { persistSession: false },
})

const TECHNOSURG_ID = "87c614b3-ff23-47c5-8682-87ea32aa77b9"

// Confirm the technosurg event exists in this DB
const { data: ev } = await db
  .from("events")
  .select("id, name, tenant")
  .eq("id", TECHNOSURG_ID)
  .maybeSingle()

if (!ev) {
  console.log(`TechnoSurg event NOT FOUND in this DB — wrong Supabase project.`)
  process.exit(1)
}
console.log(`Event found: ${ev.name} (tenant=${ev.tenant})`)

// Try the new column
const { data, error } = await db
  .from("event_settings")
  .select("event_id, faculty_registration_prefix, current_faculty_registration_number")
  .eq("event_id", TECHNOSURG_ID)
  .maybeSingle()

if (error) {
  console.log("ERROR:", error.message)
  if (error.message.includes("faculty_registration_prefix")) {
    console.log("--> Migration NOT applied in THIS Supabase project (or PostgREST cache stale)")
  }
  process.exit(1)
}

console.log("Migration applied. event_settings row:", JSON.stringify(data, null, 2))
