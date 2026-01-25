import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"
import * as fs from "fs"

// Hardcoded for script execution
const supabaseUrl = "https://jmdwxymbgxwdsmcwbahp.supabase.co"
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptZHd4eW1iZ3h3ZHNtY3diYWhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzAxMTA1NSwiZXhwIjoyMDgyNTg3MDU1fQ.rvk94RhIk7lcDonsR_dWdPL7rEzmn91tdXLChDg9b4Y"

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface ASIVoter {
  memberNumber: string
  name: string
  mobile: string
  email: string
  state: string
}

interface AmasiMember {
  id: string
  name: string
  email: string | null
  phone: number | null
  asi_member_id: string | null
  voting_eligible: boolean
}

async function importASIVoters() {
  console.log("=== ASI Registered Voters Import ===\n")

  // Read the Excel file
  const filePath = "/Users/prabhubalasubramaniam/Downloads/Registered Voters List.xlsx"

  if (!fs.existsSync(filePath)) {
    console.error("File not found:", filePath)
    process.exit(1)
  }

  const workbook = XLSX.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(worksheet) as any[]

  console.log(`Loaded ${data.length} ASI voters from Excel\n`)

  // Parse ASI data
  const asiVoters: ASIVoter[] = data.map(row => ({
    memberNumber: String(row["Member Number"] || "").trim(),
    name: String(row["Name"] || "").trim(),
    mobile: String(row["Mobile"] || "").replace(/\D/g, ""),
    email: String(row["Email"] || "").trim().toLowerCase(),
    state: String(row["State"] || "").trim(),
  })).filter(v => v.memberNumber && (v.email || v.mobile))

  console.log(`Valid ASI voters with email/mobile: ${asiVoters.length}\n`)

  // Create lookup maps
  const asiByEmail = new Map<string, ASIVoter>()
  const asiByMobile = new Map<string, ASIVoter>()

  for (const voter of asiVoters) {
    if (voter.email) {
      asiByEmail.set(voter.email, voter)
    }
    if (voter.mobile && voter.mobile.length >= 10) {
      // Store last 10 digits
      const last10 = voter.mobile.slice(-10)
      asiByMobile.set(last10, voter)
    }
  }

  console.log(`ASI voters by email: ${asiByEmail.size}`)
  console.log(`ASI voters by mobile: ${asiByMobile.size}\n`)

  // Fetch all AMASI members with pagination
  console.log("Fetching AMASI members...")
  const allMembers: AmasiMember[] = []
  const pageSize = 1000
  let page = 0
  let hasMore = true

  while (hasMore) {
    const { data: batch, error } = await supabase
      .from("members")
      .select("id, name, email, phone, asi_member_id, voting_eligible")
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) {
      console.error("Error fetching members:", error)
      process.exit(1)
    }

    if (batch && batch.length > 0) {
      allMembers.push(...(batch as AmasiMember[]))
      page++
      console.log(`  Fetched ${allMembers.length} members...`)
    }

    hasMore = batch && batch.length === pageSize
  }

  const members = allMembers
  console.log(`Found ${members.length} AMASI members\n`)

  // Match and prepare updates
  const updates: { id: string; asi_member_id: string; voting_eligible: boolean; name: string }[] = []
  const alreadyLinked: string[] = []
  let matchedByEmail = 0
  let matchedByPhone = 0

  for (const member of (members || []) as AmasiMember[]) {
    let asiVoter: ASIVoter | undefined

    // Try email match first
    if (member.email) {
      asiVoter = asiByEmail.get(member.email.toLowerCase())
      if (asiVoter) matchedByEmail++
    }

    // Try phone match if no email match
    if (!asiVoter && member.phone) {
      const phoneStr = String(member.phone).replace(/\D/g, "")
      if (phoneStr.length >= 10) {
        const last10 = phoneStr.slice(-10)
        asiVoter = asiByMobile.get(last10)
        if (asiVoter) matchedByPhone++
      }
    }

    if (asiVoter) {
      // Check if already has this ASI ID
      if (member.asi_member_id === asiVoter.memberNumber && member.voting_eligible) {
        alreadyLinked.push(member.name)
      } else {
        updates.push({
          id: member.id,
          asi_member_id: asiVoter.memberNumber,
          voting_eligible: true,
          name: member.name,
        })
      }
    }
  }

  console.log("=== Match Results ===")
  console.log(`Matched by email: ${matchedByEmail}`)
  console.log(`Matched by phone: ${matchedByPhone}`)
  console.log(`Total matches: ${matchedByEmail + matchedByPhone}`)
  console.log(`Already linked (no update needed): ${alreadyLinked.length}`)
  console.log(`New updates to apply: ${updates.length}\n`)

  if (updates.length === 0) {
    console.log("No updates needed. All matched members already have ASI data.")
    return
  }

  // Apply updates in batches
  console.log("Applying updates in batches of 100...")
  const batchSize = 100
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize)

    // Update each member
    for (const update of batch) {
      const { error: updateError } = await supabase
        .from("members")
        .update({
          asi_member_id: update.asi_member_id,
          voting_eligible: update.voting_eligible,
          updated_at: new Date().toISOString(),
        })
        .eq("id", update.id)

      if (updateError) {
        console.error(`Error updating ${update.name}:`, updateError.message)
        errorCount++
      } else {
        successCount++
      }
    }

    console.log(`Progress: ${Math.min(i + batchSize, updates.length)}/${updates.length}`)
  }

  console.log("\n=== Import Complete ===")
  console.log(`Successfully updated: ${successCount}`)
  console.log(`Errors: ${errorCount}`)
  console.log(`Total with voting rights (registered voters): ${successCount + alreadyLinked.length}`)
}

importASIVoters().catch(console.error)
