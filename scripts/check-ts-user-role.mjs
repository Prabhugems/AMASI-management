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

const { data: users } = await db
  .from("users")
  .select("id, email, name, platform_role, is_active")
  .ilike("email", "%prabhu%")
console.log("Users with 'prabhu' in email on TechnoSurg DB:")
for (const u of users || []) console.log(" ", JSON.stringify(u))

console.log("\nAll users on TechnoSurg DB (top 20 by name):")
const { data: allUsers } = await db
  .from("users")
  .select("email, name, platform_role, is_active")
  .order("created_at", { ascending: false })
  .limit(20)
for (const u of allUsers || []) console.log(" ", u.email, "|", u.name, "|", u.platform_role, "|", u.is_active ? "active" : "inactive")
