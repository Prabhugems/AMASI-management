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

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
  { auth: { persistSession: false } }
)

console.log(`Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}\n`)

const { data: events } = await db.from("events").select("id, name, tenant").or("name.ilike.%techno%,tenant.eq.technosurg").limit(20)
console.log("Events matching technosurg:")
console.log(events)

const { data: senthil } = await db
  .from("registrations")
  .select("id, registration_number, attendee_name, attendee_email, event_id")
  .ilike("attendee_email", "%senthilnathan%")
  .limit(10)
console.log("\nRegistrations with 'senthilnathan' in email:")
console.log(senthil)
