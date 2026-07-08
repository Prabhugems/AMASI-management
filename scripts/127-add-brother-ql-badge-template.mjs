#!/usr/bin/env node
/**
 * Brother QL-820NWB 62mm x 86mm badge format — additive setup for "127 FMAS
 * Course". Creates a NEW badge template + print station; does NOT touch the
 * existing 4x3 "Brother Label Template" / "Brother Label" station (Zebra
 * flow stays as-is).
 *
 * Default dry-run; pass --apply to write.
 */
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const APPLY = process.argv.includes("--apply")

const env = {}
for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const EVENT_ID = "81d9da71-c745-4897-bb47-f363207a6223" // 127 FMAS Course
const TEMPLATE_NAME = "Brother QL-820NWB Template (62x86mm)"
const STATION_NAME = "Brother QL-820NWB Test"

const log = []
function L(msg) { log.push(msg); console.log(msg) }
function header(t) { L(""); L("=".repeat(72)); L(t); L("=".repeat(72)) }

header(APPLY ? "APPLY MODE — changes WILL be written" : "DRY RUN — no writes")

const { data: event, error: eventErr } = await supabase
  .from("events").select("id, name").eq("id", EVENT_ID).single()
if (eventErr || !event) { console.error("Event not found:", eventErr); process.exit(1) }
L(`Event: ${event.name} (${event.id})`)

// ---- 1. Badge template ----
header("1. Badge template (62x86mm)")

const TEMPLATE_DATA = {
  backgroundColor: "#ffffff",
  elements: [
    {
      id: "name", type: "text", content: "Dr.{{name}}",
      x: 4, y: 10, width: 226, height: 34, zIndex: 1,
      fontSize: 16, fontWeight: "bold", fontFamily: "Arial, sans-serif",
      align: "center", color: "#000000", textCase: "capitalize",
      singleLine: true,
    },
    {
      id: "qr", type: "qr_code", content: "{{registration_number}}",
      x: 42, y: 54, width: 151, height: 151, zIndex: 2,
    },
    {
      id: "ticket_type", type: "text", content: "{{ticket_type}}",
      x: 4, y: 213, width: 226, height: 32, zIndex: 3,
      fontSize: 12, fontWeight: "normal", fontFamily: "Arial, sans-serif",
      align: "center", color: "#000000",
      lineClamp: 2,
    },
    {
      id: "regno", type: "text", content: "{{registration_number}}",
      x: 4, y: 291, width: 226, height: 24, zIndex: 4,
      fontSize: 14, fontWeight: "bold", fontFamily: "Arial, sans-serif",
      align: "center", color: "#000000",
    },
  ],
}

let templateId = null
const { data: existingTemplate } = await supabase
  .from("badge_templates").select("id").eq("event_id", EVENT_ID).eq("name", TEMPLATE_NAME).maybeSingle()

if (existingTemplate) {
  L(`  ✓ "${TEMPLATE_NAME}" already exists (${existingTemplate.id}) — reusing`)
  templateId = existingTemplate.id
} else {
  L(`  + "${TEMPLATE_NAME}" — size 62x86, 4 elements, ticket_type_ids: null`)
  if (APPLY) {
    const { data: inserted, error } = await supabase.from("badge_templates").insert({
      event_id: EVENT_ID,
      name: TEMPLATE_NAME,
      description: "Brother QL-820NWB, DK-22205 62mm continuous roll, portrait, no rotation by default",
      size: "62x86",
      template_data: TEMPLATE_DATA,
      ticket_type_ids: null,
      is_default: false,
    }).select().single()
    if (error) { console.error("Template insert failed:", error); process.exit(1) }
    templateId = inserted.id
    L(`  ✓ created ${templateId}`)
  }
}

// ---- 2. Print station ----
header("2. Print station")

let stationToken = null
let stationId = null
const { data: existingStation } = await supabase
  .from("print_stations").select("id, access_token").eq("event_id", EVENT_ID).eq("name", STATION_NAME).maybeSingle()

if (existingStation) {
  L(`  ✓ "${STATION_NAME}" already exists (${existingStation.id}) — reusing`)
  stationId = existingStation.id
  stationToken = existingStation.access_token
} else {
  stationToken = crypto.randomBytes(24).toString("hex")
  L(`  + "${STATION_NAME}" — paper_size: 62x86, orientation: portrait, rotation: 0, printer_type: browser`)
  if (APPLY) {
    const { data: inserted, error } = await supabase.from("print_stations").insert({
      event_id: EVENT_ID,
      name: STATION_NAME,
      description: "QA/verification station for the 62x86mm Brother QL badge format",
      print_mode: "full_badge",
      badge_template_id: templateId,
      print_settings: {
        paper_size: "62x86",
        orientation: "portrait",
        rotation: 0,
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
        scale: 100,
        copies: 1,
        printer_type: "browser",
      },
      allow_reprint: true,
      max_reprints: 3,
      auto_print: false,
      require_checkin: false,
      ticket_type_ids: null,
      access_token: stationToken,
      is_active: true,
    }).select().single()
    if (error) { console.error("Station insert failed:", error); process.exit(1) }
    stationId = inserted.id
    L(`  ✓ created ${stationId}`)
  }
}

header("DONE")
if (APPLY) {
  L(`Template ID: ${templateId}`)
  L(`Station ID:  ${stationId}`)
  L(`Print URL:   /print/${stationToken}`)
} else {
  L(`(dry run — re-run with --apply to write)`)
}
