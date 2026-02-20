#!/usr/bin/env node
/**
 * Fix placeholder emails in faculty_assignments, registrations, and faculty tables
 * using real emails from the program CSV.
 *
 * Usage: node scripts/fix-placeholder-emails.mjs
 */

import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// CSV data: name -> { email, phone }
const csvData = [
  { name: "Dr Prakash Kumar Sasmal", email: "drpksasmal@gmail.com", phone: "9438884255" },
  { name: "Dr Rajesh Kumar Shrivastava", email: "dr.rajeshshree70@gmail.com", phone: "9925029477" },
  { name: "Dr Bhupinder Singh Pathania", email: "surgeonpat@yahoo.co.uk", phone: "9419190099" },
  { name: "Dr Rajendra Mandia", email: "drrmandia@yahoo.com", phone: "9414041728" },
  { name: "Dr Deborshi Sharma", email: "drdeborshi@gmail.com", phone: "9971539797" },
  { name: "Dr Srikant Patro", email: "srikantkpatro@gmail.com", phone: "9861215522" },
  { name: "Dr Jayanta Kumar Das", email: "drjayantakr@yahoo.com", phone: "9862569203" },
  { name: "Dr Vinayak Rengan", email: "vinayak92@gmail.com", phone: "9941275775" },
  { name: "Dr Kalpesh Jani", email: "kvjani@gmail.com", phone: "9924841240" },
  { name: "Dr Sameer Rege", email: "drsamrege@gmail.com", phone: "9869178040" },
  { name: "Dr Jugindra S", email: "drjugindra@shijahospitals.com", phone: "7005115381" },
  { name: "Dr Jayant K Das", email: "drjayantakr@yahoo.com", phone: "9862569203" },
  { name: "Dr Vishakha Kalikar", email: "vish.kalikar@gmail.com", phone: "9975634405" },
  { name: "Dr Eham Arora", email: "ehamarora@gmail.com", phone: "9769269907" },
  { name: "Dr Jignesh Gandhi", email: "jigneshkem@gmail.com", phone: "9920443433" },
  { name: "Dr Rahul Mahadar", email: "rahulmahadar@yahoo.com", phone: "9820234680" },
  { name: "Dr Bharath Cumar M", email: "surgeonbharath@gmail.com", phone: "9894064274" },
  { name: "Dr Pramod Shinde", email: "shindepramodp@gmail.com", phone: "9822060121" },
  { name: "Dr Roy Patankar", email: "roypatankar@gmail.com", phone: "9820075254" },
  { name: "Dr Suresh Chandra Hari", email: "drsguduru@hotmail.com", phone: "9848027177" },
  { name: "Dr Himanshu Yadav", email: "drhimanshuyadav@gmail.com", phone: "9897794208" },
  { name: "Dr Pinak Dasgupta", email: "drpdg77@gmail.com", phone: "8811091676" },
  { name: "Dr Sharad Sharma", email: "drsharadsharma@gmail.com", phone: "9619460808" },
  { name: "Dr Vikas Singhal", email: "singhalvik@gmail.com", phone: "8800593611" },
  { name: "Dr Vivek Bindal", email: "bindal.vivek@gmail.com", phone: "9999931958" },
  { name: "Dr C Palanivelu", email: "info@geminstitute.in", phone: "9843922322" },
  { name: "Dr Varghese C J", email: "doctorthrissur@gmail.com", phone: "9846031233" },
  { name: "Dr Manash Ranjan Sahoo", email: "vc@ouhs.ac.in", phone: "9937025779" },
  { name: "Dr Tushar Subhadarshan Mishra", email: "surg_tushar@aiimsbhubaneswar.edu.in", phone: "9438884251" },
  { name: "Dr Biswarup Bose", email: "dr.biswarupbose@gmail.com", phone: "9831001112" },
  { name: "Dr Parthasarathi", email: "parthu@mac.com", phone: "9842230900" },
  { name: "Dr Sreejoy Patnaik", email: "sreejoypatnaik@gmail.com", phone: "9831001112" },
  { name: "Dr Bikash Bihary Tripathy", email: "pedsurg_bikasha@aiimsbhubaneswar.edu.in", phone: "9938104876" },
  { name: "Dr Bana B Mishra", email: "drbbm_orissa@rediffmail.com", phone: "9437024977" },
  { name: "Dr Rashmi R Sahoo", email: "drrashmi1278@gmail.com", phone: "8763067172" },
  { name: "Dr Monika Gureh", email: "surg_monika@aiimsbhubaneswar.edu.in", phone: "8054340584" },
  { name: "Dr Ashok K Sahoo", email: "drkashok@hotmail.com", phone: "8800878271" },
  { name: "Dr Pradeep Kumar Singh", email: "surg_pradeep@aiimsbhubaneswar.edu.in", phone: "8789395345" },
  { name: "Dr P K Debata", email: "pk_debata@yahoo.com", phone: "9437078964" },
  { name: "Dr Amaresh Mishra", email: "amareshm26@gmail.com", phone: "9437554488" },
  { name: "Dr S Manwar Ali", email: "surg_manwar@aiimsbhubaneswar.edu.in", phone: "94388820340" },
  { name: "Dr Bikram Rout", email: "surg_bikram@aiimsbhubaneswar.edu.in", phone: "8763278543" },
  { name: "Dr Akash Bihari Pati", email: "pedsurg_akash@aiimsbhubaneswar.edu.in", phone: "9438884104" },
  { name: "Dr Shantanu Kumar Sahu", email: "surg_shantanu@aiimsbhubaneswar.edu.in", phone: "8218053761" },
  { name: "Dr P. Senthilnathan", email: "senthilnathan94@gmail.com", phone: "9842210173" },
  { name: "Dr Tamonas Chaudhuri", email: "drtamonas@hotmail.com", phone: "9830067567" },
  { name: "Dr Shakti Prasad Sahoo", email: "srsahoo@hotmail.com", phone: "9437025323" },
  { name: "Dr Jayant Kumar Dash", email: "drjkdash@gmail.com", phone: "8763066768" },
  { name: "Dr B M Das", email: "drbhubandas@yahoo.co.in", phone: "9338203485" },
  { name: "Dr Mithilesh K Sinha", email: "surg_mithilesh@aiimsbhubaneswar.edu.in", phone: null },
  { name: "Dr Rashmi Sahoo", email: "drrashmi1278@gmail.com", phone: "8763067172" },
  { name: "Dr Jayant Biswal", email: "kasturiray69@gmail.com", phone: "9437028485" },
  { name: "Dr Ranjit K Sahu", email: "plastic_ranjit@aiimsbhubaneswar.edu.in", phone: "9668044811" },
]

function normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/^dr\.?\s*/i, "")
    .replace(/^prof\.?\s*/i, "")
    .replace(/\s+/g, " ")
}

// Build lookup
const lookup = new Map()
for (const entry of csvData) {
  lookup.set(normalizeName(entry.name), entry)
}

function findMatch(name) {
  const normalized = normalizeName(name)

  // Exact match
  if (lookup.has(normalized)) return lookup.get(normalized)

  // Fuzzy: match by 2+ name parts
  const parts = normalized.split(" ").filter(p => p.length > 1)
  for (const [key, val] of lookup) {
    const csvParts = key.split(" ").filter(p => p.length > 1)
    const matching = parts.filter(p => csvParts.includes(p))
    if (matching.length >= 2) return val
    // Last name + first initial
    if (csvParts.length >= 2 && parts.length >= 2 &&
        csvParts[csvParts.length - 1] === parts[parts.length - 1] &&
        csvParts[0][0] === parts[0][0]) return val
  }
  return null
}

async function main() {
  console.log("=== Fix Placeholder Emails ===\n")
  console.log(`CSV entries: ${csvData.length}\n`)

  // 1. Fix faculty_assignments
  console.log("--- faculty_assignments ---")
  const { data: assignments, error: aErr } = await supabase
    .from("faculty_assignments")
    .select("id, faculty_name, faculty_email, faculty_phone")
    .like("faculty_email", "%@placeholder.%")

  if (aErr) {
    console.error("Error fetching assignments:", aErr.message)
  } else {
    console.log(`Found ${assignments.length} with placeholder emails`)
    let updated = 0
    const notMatched = []
    for (const a of assignments) {
      const match = findMatch(a.faculty_name)
      if (match) {
        const updates = { faculty_email: match.email }
        if (match.phone && !a.faculty_phone) updates.faculty_phone = match.phone
        const { error } = await supabase
          .from("faculty_assignments")
          .update(updates)
          .eq("id", a.id)
        if (!error) {
          updated++
          console.log(`  ✓ ${a.faculty_name}: ${a.faculty_email} → ${match.email}`)
        }
      } else {
        notMatched.push(a.faculty_name)
      }
    }
    console.log(`Updated: ${updated}, Not matched: ${notMatched.length}`)
    if (notMatched.length > 0) console.log(`  Unmatched: ${notMatched.join(", ")}`)
  }

  // 2. Fix registrations
  console.log("\n--- registrations ---")
  const { data: regs, error: rErr } = await supabase
    .from("registrations")
    .select("id, attendee_name, attendee_email, attendee_phone")
    .like("attendee_email", "%@placeholder.%")

  if (rErr) {
    console.error("Error fetching registrations:", rErr.message)
  } else {
    console.log(`Found ${regs.length} with placeholder emails`)
    let updated = 0
    const notMatched = []
    for (const r of regs) {
      const match = findMatch(r.attendee_name)
      if (match) {
        const updates = { attendee_email: match.email }
        if (match.phone && !r.attendee_phone) updates.attendee_phone = match.phone
        const { error } = await supabase
          .from("registrations")
          .update(updates)
          .eq("id", r.id)
        if (!error) {
          updated++
          console.log(`  ✓ ${r.attendee_name}: ${r.attendee_email} → ${match.email}`)
        }
      } else {
        notMatched.push(r.attendee_name)
      }
    }
    console.log(`Updated: ${updated}, Not matched: ${notMatched.length}`)
    if (notMatched.length > 0) console.log(`  Unmatched: ${notMatched.join(", ")}`)
  }

  // 3. Fix faculty table
  console.log("\n--- faculty ---")
  const { data: faculty, error: fErr } = await supabase
    .from("faculty")
    .select("id, name, email, phone")
    .like("email", "%@placeholder.%")

  if (fErr) {
    console.error("Error fetching faculty:", fErr.message)
  } else {
    console.log(`Found ${faculty.length} with placeholder emails`)
    let updated = 0
    const notMatched = []
    for (const f of faculty) {
      const match = findMatch(f.name)
      if (match) {
        const updates = { email: match.email }
        if (match.phone && !f.phone) updates.phone = match.phone
        const { error } = await supabase
          .from("faculty")
          .update(updates)
          .eq("id", f.id)
        if (!error) {
          updated++
          console.log(`  ✓ ${f.name}: ${f.email} → ${match.email}`)
        }
      } else {
        notMatched.push(f.name)
      }
    }
    console.log(`Updated: ${updated}, Not matched: ${notMatched.length}`)
    if (notMatched.length > 0) console.log(`  Unmatched: ${notMatched.join(", ")}`)
  }

  // 4. Summary check
  console.log("\n--- Remaining placeholders ---")
  const { count: aCount } = await supabase
    .from("faculty_assignments")
    .select("*", { count: "exact", head: true })
    .like("faculty_email", "%@placeholder.%")
  console.log(`faculty_assignments: ${aCount}`)

  const { count: rCount } = await supabase
    .from("registrations")
    .select("*", { count: "exact", head: true })
    .like("attendee_email", "%@placeholder.%")
  console.log(`registrations: ${rCount}`)

  const { count: fCount } = await supabase
    .from("faculty")
    .select("*", { count: "exact", head: true })
    .like("email", "%@placeholder.%")
  console.log(`faculty: ${fCount}`)

  console.log("\nDone!")
}

main().catch(console.error)
