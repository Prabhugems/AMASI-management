#!/usr/bin/env node
/**
 * One-off: add Sun Pharma complimentary delegates for TechnoSurg
 * (batch 2026-06-17, 44 rows from "TECHNO SURG - SUN PHARMA(17-06.2026).xlsx").
 * - Comp delegate gets a REG-YYYYMMDD-XXXXXXX number on Complimentary Delegate ticket.
 * - Inserted as confirmed/completed with total_amount = 0.
 * - quantity_sold on ticket_types is auto-bumped by a DB trigger; do NOT bump it here.
 *
 * Source normalisations:
 *  - Names ALL-CAPS → title case (single letters / initials stay uppercase).
 *  - Email "manjurajkp@ yahoo.com" → "manjurajkp@yahoo.com" (stray space).
 *  - Email "Amilthan@gmail.com" → lowercased.
 *  - Phones stripped of spaces / non-digits.
 *  - "Jahid Husain S" / "Peranbu" / "Nirmalkumar T" already mixed-case — preserved.
 */
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const env = {}
for (const line of fs.readFileSync(path.join(process.cwd(), ".env.technosurg.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim()
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const EVENT_ID = "87c614b3-ff23-47c5-8682-87ea32aa77b9"
const COMP_TICKET_ID = "a7a0b418-83a5-4b4d-b39b-1b2026eac52b"

function titleCase(s) {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b([A-Z])([A-Z]+)\b/g, (_, a, b) => a + b.toLowerCase())
}

const ROWS = [
  { name: titleCase("KARTHIKEYAN JAYAKUMAR"),       phone: "9962111999",  email: "jkarthikeyan0001@gmail.com" },
  { name: titleCase("K. PRASANNA KUMAR"),           phone: "8098899333",  email: "drprasannakumarkambala@gmail.com" },
  { name: titleCase("K. AMILTHAN"),                 phone: "9841024214",  email: "amilthan@gmail.com" },
  { name: titleCase("A RAVINTHAR"),                 phone: "9444115957",  email: "drravinthar@gmail.com" },
  { name: titleCase("V PREETHI KARTHIKEYAN"),       phone: "9677203959",  email: "preethivenkat@gmail.com" },
  { name: titleCase("VIKAS C KAWARAT"),             phone: "9940575658",  email: "drvikaskawarat@gmail.com" },
  { name: titleCase("VIVEK CHANDRA"),               phone: "8809485313",  email: "vivekmch007@gmail.com" },
  { name: titleCase("S.VIGNESH"),                   phone: "9994824572",  email: "drvigneshpandiyan1995@gmail.com" },
  { name: titleCase("JAYAKUMAR"),                   phone: "9787508579",  email: "mercijayakumar@gmail.com" },
  { name: titleCase("JAYAPRAKASH.S"),               phone: "9944863088",  email: "sjp_prakash@yahoo.com" },
  { name: titleCase("K RAMKUMAR"),                  phone: "9445567404",  email: "info@chennaigastrosurg.com" },
  { name: titleCase("K KAMALAKANNAN"),              phone: "9865735009",  email: "kk_gisur@yahoo.com" },
  { name: titleCase("M SEENIVASAGAN"),              phone: "9840351040",  email: "seenidr@yahoo.com" },
  { name: titleCase("JESILAPRIYA"),                 phone: "9941248562",  email: "jesilapriya@gmail.com" },
  { name: titleCase("KRISHNAVADANAN B S"),          phone: "9841066521",  email: "drkrishnavadanan@yahoo.com" },
  { name: titleCase("A SANTHI"),                    phone: "9500048370",  email: "drsanthi83@gmail.com" },
  { name: titleCase("K.SATHISH"),                   phone: "9566273994",  email: "drksathishms@gmail.com" },
  { name: titleCase("G.SIVARAHINI"),                phone: "9962810456",  email: "rahinigsr@gmail.com" },
  { name: titleCase("SASI KUMAR K"),                phone: "8870544257",  email: "sasikumark1983@gmail.com" },
  { name: titleCase("DINESH RAMASWAMY"),            phone: "8939377170",  email: "drdineshms@gmail.com" },
  { name: titleCase("SUNITA BHASKAR"),              phone: "9841609967",  email: "sunita.bhaskar@gmail.com" },
  { name: titleCase("JENNIFER HEPZIBAH SITTHER"),   phone: "8939489663",  email: "jenniferhepzibah.2017@cmcludhiana.in" },
  { name: titleCase("P JOTHISHANKAR"),              phone: "9941208262",  email: "jothi65@hotmail.com" },
  { name: titleCase("SHYAM SUNDAR"),                phone: "9962222848",  email: "shyamsundarsr89@gmail.com" },
  { name: titleCase("K THINAGARAN"),                phone: "9441074743",  email: "drdinky@gmail.com" },
  { name: titleCase("S SURESH"),                    phone: "9710508155",  email: "sureshssoorian@gmail.com" },
  { name: titleCase("S PURUSHOTHAMAN"),             phone: "9677038968",  email: "stanprue@gmail.com" },
  { name: titleCase("T R YESHWANTH"),               phone: "9942042506",  email: "dryeshms@yahoo.com" },
  { name: titleCase("NAVEENRAJ SIVAKUMAR"),         phone: "9790042427",  email: "onlinenaveenraj@gmail.com" },
  { name: titleCase("SUGANYA P"),                   phone: "9710293396",  email: "suganya.p.441993@gmail.com" },
  { name: titleCase("K R P VIGNESH"),               phone: "9842610666",  email: "vikneshkrp@gmail.com" },
  { name: "Jahid Husain S",                          phone: "9940340953",  email: "husainj27@gmail.com" },
  { name: "Peranbu",                                 phone: "7200043308",  email: "peranbugemini@gmail.com" },
  { name: "Nirmalkumar T",                           phone: "9489033656",  email: "nirmalkumar.vpm@gmail.com" },
  { name: titleCase("SREERAG S R"),                 phone: "8547854124",  email: "srsreeragnair@gmail.com" },
  { name: titleCase("T ARAVIND"),                   phone: "9080889291",  email: "aruvi22@gmail.com" },
  { name: titleCase("JAYAKANTHAN"),                 phone: "9789085959",  email: "drjayakanthan@gmail.com" },
  { name: titleCase("C ARUNBABU"),                  phone: "9840787560",  email: "arun_dr@yahoo.com" },
  { name: titleCase("M VENKATESAN"),                phone: "9840243833",  email: "venkatesanmahadevan1@gmail.com" },
  { name: titleCase("UTHIRAKUMAR"),                 phone: "9445166630",  email: "dr.uthira18@gmail.com" },
  { name: titleCase("MANJURAJ K P"),                phone: "9495336005",  email: "manjurajkp@yahoo.com" },
  { name: titleCase("SRINIVASAN RAMACHANDRAN"),     phone: "9894386607",  email: "docsrini@gmail.com" },
  { name: titleCase("K. ARUN"),                     phone: "9444750879",  email: "drkarunms@gmail.com" },
  { name: titleCase("A M KALIRAJ"),                 phone: "9790624124",  email: "dr.kaliraj@gmail.com" },
]

function makeCompRegNumber() {
  const d = new Date()
  const dateStr = d.getFullYear().toString() +
    (d.getMonth() + 1).toString().padStart(2, "0") +
    d.getDate().toString().padStart(2, "0")
  const random = Array.from({ length: 7 }, () =>
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 36)]
  ).join("")
  return `REG-${dateStr}-${random}`
}

function normalisePhone(v) {
  if (!v) return null
  return String(v).replace(/[^0-9]/g, "") || null
}

// Within-batch dup check
const seen = new Map()
for (const r of ROWS) {
  const key = r.email.toLowerCase()
  if (seen.has(key)) console.log(`  ! batch duplicate email: ${key} (${seen.get(key)} ↔ ${r.name})`)
  seen.set(key, r.name)
}

// Pre-flight: existing registrations in DB
const allEmails = ROWS.map(r => r.email.toLowerCase())
const { data: dupRows } = await db
  .from("registrations")
  .select("attendee_email")
  .eq("event_id", EVENT_ID)
  .in("attendee_email", allEmails)
const dupSet = new Set((dupRows || []).map(r => (r.attendee_email || "").toLowerCase()))
if (dupSet.size) {
  console.log("Found existing registrations — these will be skipped:")
  for (const e of dupSet) console.log(`  · ${e}`)
} else {
  console.log("No existing registrations in DB for any of these emails.")
}

const results = { inserted: 0, skipped: 0, failed: 0 }
console.log(`\n--- COMPLIMENTARY DELEGATES (${ROWS.length} rows) ---`)
for (const c of ROWS) {
  const email = c.email.toLowerCase()
  if (dupSet.has(email)) {
    results.skipped++
    console.log(`  · skip duplicate: ${email}`)
    continue
  }
  const regNumber = makeCompRegNumber()
  const { error } = await db.from("registrations").insert({
    event_id: EVENT_ID,
    ticket_type_id: COMP_TICKET_ID,
    registration_number: regNumber,
    attendee_name: c.name,
    attendee_email: email,
    attendee_phone: normalisePhone(c.phone),
    status: "confirmed",
    payment_status: "completed",
    quantity: 1,
    unit_price: 0,
    total_amount: 0,
  })
  if (error) {
    results.failed++
    console.log(`  ✗ ${c.name} <${email}>: ${error.message}`)
  } else {
    results.inserted++
    console.log(`  ✓ ${regNumber}  ${c.name}  <${email}>`)
  }
}

console.log("\n--- SUMMARY ---")
console.log(`Comp del: inserted=${results.inserted}  skipped=${results.skipped}  failed=${results.failed}`)
