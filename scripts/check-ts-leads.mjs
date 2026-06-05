#!/usr/bin/env node
import fs from "node:fs"
import { createClient } from "@supabase/supabase-js"

const env = {}
for (const line of fs.readFileSync(
  "/Users/prabhubalasubramaniam/AMASI-management/.env.technosurg.local",
  "utf8"
).split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const EVENT_ID = "87c614b3-ff23-47c5-8682-87ea32aa77b9"

// Try selecting from event_leads (what the code queries)
const { error: leadsErr, count: leadsCount } = await db
  .from("event_leads")
  .select("*", { count: "exact", head: true })
  .eq("event_id", EVENT_ID)

if (leadsErr) {
  console.log("event_leads error:", leadsErr.code, "-", leadsErr.message)
} else {
  console.log("event_leads exists. Rows:", leadsCount)
}
