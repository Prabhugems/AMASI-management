import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email"
import crypto from "crypto"

function generateToken(): string {
  return crypto.randomBytes(16).toString("hex")
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://collegeofmas.org.in"

function getReviewerFormEmail(name: string, formUrl: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a365d;">AMASI Reviewer Registration</h2>
      <p>Dear ${name},</p>
      <p>Thank you for agreeing to be part of the AMASI reviewer pool. We appreciate your expertise and willingness to contribute to the peer review process.</p>
      <p>Please complete your registration by providing your specialty and other details:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${formUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Complete Registration
        </a>
      </p>
      <p style="color: #666;">If the button doesn't work, copy and paste this link: <br/><a href="${formUrl}">${formUrl}</a></p>
      <p>This information helps us match you with relevant abstracts for review.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
      <p style="color: #888; font-size: 12px;">
        Association of Minimal Access Surgeons of India (AMASI)<br/>
        This is an automated message. Please do not reply directly.
      </p>
    </div>
  `
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// Helper to normalize names for duplicate detection
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/^(dr\.?\s*|prof\.?\s*|mr\.?\s*|ms\.?\s*|mrs\.?\s*)/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

// GET /api/reviewers-pool - List all reviewers in global pool with membership/faculty lookup
export async function GET(request: NextRequest) {
  try {
    const supabase: SupabaseClient = await createAdminClient()
    const { searchParams } = new URL(request.url)
    const checkDuplicates = searchParams.get("check_duplicates") === "true"

    // Fetch reviewers
    const { data: reviewers, error } = await supabase
      .from("reviewers_pool")
      .select("*")
      .order("name", { ascending: true })

    if (error) {
      console.error("Error fetching reviewers pool:", error)
      return NextResponse.json({ error: "Failed to fetch reviewers" }, { status: 500 })
    }

    if (!reviewers || reviewers.length === 0) {
      return NextResponse.json(checkDuplicates ? { reviewers: [], duplicates: [] } : [])
    }

    // Helper to normalize phone numbers
    const normalizePhone = (phone: string | number | null | undefined): string | null => {
      if (!phone) return null
      const phoneStr = String(phone)
      const cleaned = phoneStr.replace(/[\s\-\(\)]/g, "")
      if (cleaned.startsWith("+91")) return cleaned.slice(3)
      if (cleaned.startsWith("91") && cleaned.length > 10) return cleaned.slice(2)
      if (cleaned.startsWith("0")) return cleaned.slice(1)
      return cleaned
    }

    // Get all reviewer emails for batch lookup
    const emails = reviewers.map((r: any) => r.email.toLowerCase())

    // Helper to normalize names for matching
    const normalizeName = (name: string | null): string | null => {
      if (!name) return null
      return name
        .toLowerCase()
        .trim()
        .replace(/^(dr\.?\s*|prof\.?\s*|mr\.?\s*|ms\.?\s*|mrs\.?\s*)/i, "")
        .replace(/\s+/g, " ")
        .trim()
    }

    // Lookup all members (to match by email, phone, or name)
    // Fetch in batches since Supabase has 1000 row limit per query
    let allMembers: any[] = []
    let offset = 0
    const batchSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data: batch } = await supabase
        .from("members")
        .select("email, phone, name, amasi_number, status")
        .range(offset, offset + batchSize - 1)

      if (batch && batch.length > 0) {
        allMembers = allMembers.concat(batch)
        offset += batchSize
        hasMore = batch.length === batchSize
      } else {
        hasMore = false
      }
    }

    console.log(`[Sync] Fetched ${allMembers.length} total members`)

    // Debug: Check if specific member exists
    const janiMember = allMembers.find((m: any) => m.email?.toLowerCase().includes('kvjani'))
    console.log(`[Sync] Kalpesh Jani in members:`, janiMember ? JSON.stringify(janiMember) : 'NOT FOUND')

    // Lookup faculty by email
    const { data: faculty } = await supabase
      .from("faculty")
      .select("email, name")
      .in("email", emails)

    // Create lookup maps - by email, phone, and name
    const memberByEmail = new Map<string, any>()
    const memberByPhone = new Map<string, any>()
    const memberByName = new Map<string, any>()

    for (const m of (allMembers || [])) {
      if (m.email) {
        memberByEmail.set(m.email.toLowerCase(), m)
      }
      const normalizedPhone = normalizePhone(m.phone)
      if (normalizedPhone) {
        memberByPhone.set(normalizedPhone, m)
      }
      const normalizedName = normalizeName(m.name)
      if (normalizedName) {
        memberByName.set(normalizedName, m)
      }
    }

    const facultyMap = new Map(
      (faculty || []).map((f: any) => [f.email.toLowerCase(), f])
    )

    // Enrich reviewers with membership/faculty info
    const enriched = reviewers.map((r: any) => {
      // Try email first, then phone, then name
      let member: any = memberByEmail.get(r.email.toLowerCase())
      if (!member && r.phone) {
        const normalizedPhone = normalizePhone(r.phone)
        if (normalizedPhone) {
          member = memberByPhone.get(normalizedPhone)
        }
      }
      if (!member && r.name) {
        const normalizedName = normalizeName(r.name)
        if (normalizedName) {
          member = memberByName.get(normalizedName)
        }
      }
      const isFaculty = facultyMap.has(r.email.toLowerCase())
      return {
        ...r,
        amasi_membership_number: member?.amasi_number || r.amasi_membership_number || null,
        is_amasi_member: !!member || !!r.amasi_membership_number,
        member_status: member?.status || r.member_status || null,
        is_amasi_faculty: isFaculty,
      }
    })

    // If duplicate check requested, detect and return duplicates
    if (checkDuplicates) {
      const nameMap = new Map<string, any[]>()
      for (const r of enriched) {
        const normalized = normalizeName(r.name || "")
        if (normalized) {
          if (!nameMap.has(normalized)) nameMap.set(normalized, [])
          nameMap.get(normalized)!.push(r)
        }
      }

      // Find names that appear more than once (potential duplicates)
      const duplicates: { name: string; reviewers: any[] }[] = []
      for (const [name, list] of nameMap.entries()) {
        if (list.length > 1) {
          duplicates.push({ name, reviewers: list })
        }
      }

      return NextResponse.json({ reviewers: enriched, duplicates })
    }

    return NextResponse.json(enriched)
  } catch (error) {
    console.error("Error in GET /api/reviewers-pool:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/reviewers-pool - Add single or bulk reviewers to pool
export async function POST(request: NextRequest) {
  try {
    const authSupabase: SupabaseClient = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase: SupabaseClient = await createAdminClient()
    const body = await request.json()
    const reviewers = Array.isArray(body) ? body : [body]
    const sendForm = body.send_form !== false // Default to true for manual adds

    if (reviewers.length === 0) {
      return NextResponse.json({ error: "No reviewers provided" }, { status: 400 })
    }

    const toInsert = reviewers.map((r: any) => {
      // Clean name - remove Dr./DR./dr. prefix for consistency
      let name = (r.name || "").trim()
      name = name.replace(/^(Dr\.?\s*|DR\.?\s*|dr\.?\s*)/i, "").trim()

      return {
        name,
        email: (r.email || "").trim().toLowerCase(),
        phone: r.phone?.toString().trim() || null,
        institution: r.institution?.trim() || null,
        city: r.city?.trim() || null,
        specialty: r.specialty?.trim() || null,
        years_of_experience: r.years_of_experience?.toString().trim() || null,
        status: r.status === "Yes" || r.status === "active" || r.status === "Maybe" ? "active" : r.status === "No" ? "inactive" : "active",
        notes: r.notes?.trim() || null,
        form_token: sendForm && !r.specialty ? generateToken() : null, // Generate token if no specialty (needs form)
      }
    }).filter((r: any) => r.name && r.email)

    if (toInsert.length === 0) {
      return NextResponse.json({ error: "No valid reviewers (name and email required)" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("reviewers_pool")
      .upsert(toInsert, { onConflict: "email", ignoreDuplicates: false })
      .select()

    if (error) {
      console.error("Error inserting reviewers:", error)
      return NextResponse.json({ error: "Failed to import reviewers: " + error.message }, { status: 500 })
    }

    // Send form email for single manual adds with form_token
    // (skip for bulk imports - they come as arrays)
    if (!Array.isArray(body) && data?.length === 1) {
      const reviewer = data[0]
      if (reviewer.form_token && !reviewer.specialty) {
        const formUrl = `${BASE_URL}/reviewer-form/${reviewer.form_token}`
        try {
          await sendEmail({
            to: reviewer.email,
            subject: "AMASI Reviewer Registration - Complete Your Details",
            html: getReviewerFormEmail(reviewer.name, formUrl),
          })
          console.log(`[Reviewer] Form email sent to ${reviewer.email}`)
        } catch (emailErr) {
          console.error(`[Reviewer] Failed to send form email to ${reviewer.email}:`, emailErr)
          // Don't fail the request - reviewer was still added
        }
      }
    }

    return NextResponse.json({
      success: data?.length || 0,
      failed: toInsert.length - (data?.length || 0),
      data: data,
    })
  } catch (error) {
    console.error("Error in POST /api/reviewers-pool:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/reviewers-pool - Update a reviewer
export async function PUT(request: NextRequest) {
  try {
    const authSupabase: SupabaseClient = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase: SupabaseClient = await createAdminClient()
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: "Reviewer ID is required" }, { status: 400 })
    }

    const payload: Record<string, any> = { updated_at: new Date().toISOString() }
    if (updates.name !== undefined) payload.name = updates.name
    if (updates.email !== undefined) payload.email = updates.email.toLowerCase()
    if (updates.phone !== undefined) payload.phone = updates.phone
    if (updates.institution !== undefined) payload.institution = updates.institution
    if (updates.city !== undefined) payload.city = updates.city
    if (updates.specialty !== undefined) payload.specialty = updates.specialty
    if (updates.years_of_experience !== undefined) payload.years_of_experience = updates.years_of_experience
    if (updates.status !== undefined) payload.status = updates.status
    if (updates.notes !== undefined) payload.notes = updates.notes
    if (updates.available_for_review !== undefined) payload.available_for_review = updates.available_for_review

    // Generate form_token if requested
    if (updates.generate_token === true) {
      payload.form_token = generateToken()
    }

    const { data, error } = await supabase
      .from("reviewers_pool")
      .update(payload)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating reviewer:", error)
      return NextResponse.json({ error: "Failed to update reviewer" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in PUT /api/reviewers-pool:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/reviewers-pool - Sync reviewers with members table
export async function PATCH(request: NextRequest) {
  try {
    const authSupabase: SupabaseClient = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase: SupabaseClient = await createAdminClient()
    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action")

    if (action === "sync-members") {
      // Get all reviewers with email and phone
      const { data: reviewers, error: fetchError } = await supabase
        .from("reviewers_pool")
        .select("id, email, phone")

      if (fetchError) {
        console.error("Error fetching reviewers:", fetchError)
        return NextResponse.json({ error: "Failed to fetch reviewers" }, { status: 500 })
      }

      if (!reviewers || reviewers.length === 0) {
        return NextResponse.json({ synced: 0, message: "No reviewers to sync" })
      }

      // Helper to normalize phone numbers (remove spaces, dashes, +91, etc.)
      const normalizePhone = (phone: string | number | null | undefined): string | null => {
        if (!phone) return null
        const phoneStr = String(phone)
        const cleaned = phoneStr.replace(/[\s\-\(\)]/g, "")
        // Remove country code prefix
        if (cleaned.startsWith("+91")) return cleaned.slice(3)
        if (cleaned.startsWith("91") && cleaned.length > 10) return cleaned.slice(2)
        if (cleaned.startsWith("0")) return cleaned.slice(1)
        return cleaned
      }

      // Get all member emails and phones for matching
      const emails = reviewers.map((r: any) => r.email.toLowerCase())
      const phones = reviewers
        .map((r: any) => normalizePhone(r.phone))
        .filter((p: string | null): p is string => !!p)

      // Helper to normalize names for matching
      const normalizeName = (name: string | null): string | null => {
        if (!name) return null
        return name
          .toLowerCase()
          .trim()
          .replace(/^(dr\.?\s*|prof\.?\s*|mr\.?\s*|ms\.?\s*|mrs\.?\s*)/i, "")
          .replace(/\s+/g, " ")
          .trim()
      }

      // Fetch all members in batches (Supabase has 1000 row limit per query)
      let allMembers: any[] = []
      let offset = 0
      const batchSize = 1000
      let hasMore = true

      while (hasMore) {
        const { data: batch, error: batchError } = await supabase
          .from("members")
          .select("email, phone, name, amasi_number, status")
          .range(offset, offset + batchSize - 1)

        if (batchError) {
          console.error("Error fetching members batch:", batchError)
          return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
        }

        if (batch && batch.length > 0) {
          allMembers = allMembers.concat(batch)
          offset += batchSize
          hasMore = batch.length === batchSize
        } else {
          hasMore = false
        }
      }

      console.log(`[Sync] Fetched ${allMembers.length} total members from database`)

      // Get faculty info
      const { data: faculty } = await supabase
        .from("faculty")
        .select("email")
        .in("email", emails)

      // Create lookup maps - by email, phone, and name
      const memberByEmail = new Map<string, any>()
      const memberByPhone = new Map<string, any>()
      const memberByName = new Map<string, any>()

      for (const m of (allMembers || [])) {
        if (m.email) {
          memberByEmail.set(m.email.toLowerCase(), m)
        }
        const normalizedPhone = normalizePhone(m.phone)
        if (normalizedPhone) {
          memberByPhone.set(normalizedPhone, m)
        }
        const normalizedName = normalizeName(m.name)
        if (normalizedName) {
          memberByName.set(normalizedName, m)
        }
      }

      const facultySet = new Set(
        (faculty || []).map((f: any) => f.email.toLowerCase())
      )

      // Update each reviewer with matched member data
      let syncedCount = 0
      let syncedByEmail = 0
      let syncedByPhone = 0
      let syncedByName = 0
      let facultyCount = 0

      for (const reviewer of reviewers) {
        // Try to find member by email first, then phone, then name
        let member = memberByEmail.get(reviewer.email.toLowerCase())
        let matchedBy = "email"

        if (!member && reviewer.phone) {
          const normalizedPhone = normalizePhone(reviewer.phone)
          if (normalizedPhone) {
            member = memberByPhone.get(normalizedPhone)
            matchedBy = "phone"
          }
        }

        if (!member && reviewer.name) {
          const normalizedName = normalizeName(reviewer.name)
          if (normalizedName) {
            member = memberByName.get(normalizedName)
            matchedBy = "name"
          }
        }

        const isFaculty = facultySet.has(reviewer.email.toLowerCase())

        if (member || isFaculty) {
          const updateData: Record<string, any> = {
            updated_at: new Date().toISOString(),
          }

          if (member) {
            updateData.is_amasi_member = true
            updateData.amasi_membership_number = member.amasi_number
            updateData.member_status = member.status
            syncedCount++
            if (matchedBy === "email") syncedByEmail++
            else if (matchedBy === "phone") syncedByPhone++
            else if (matchedBy === "name") syncedByName++
          }

          if (isFaculty) {
            updateData.is_amasi_faculty = true
            facultyCount++
          }

          await supabase
            .from("reviewers_pool")
            .update(updateData)
            .eq("id", reviewer.id)
        }
      }

      return NextResponse.json({
        synced: syncedCount,
        syncedByEmail,
        syncedByPhone,
        syncedByName,
        faculty: facultyCount,
        total: reviewers.length,
        message: `Synced ${syncedCount} members (${syncedByEmail} by email, ${syncedByPhone} by phone, ${syncedByName} by name) and ${facultyCount} faculty from ${reviewers.length} reviewers`
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Error in PATCH /api/reviewers-pool:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/reviewers-pool - Remove a reviewer (or all with id=all)
export async function DELETE(request: NextRequest) {
  try {
    const authSupabase: SupabaseClient = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase: SupabaseClient = await createAdminClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Reviewer ID is required" }, { status: 400 })
    }

    // Support clearing all reviewers
    if (id === "all") {
      const { error } = await supabase
        .from("reviewers_pool")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000") // Delete all rows

      if (error) {
        console.error("Error clearing reviewers:", error)
        return NextResponse.json({ error: "Failed to clear reviewers" }, { status: 500 })
      }
      return NextResponse.json({ success: true, cleared: true })
    }

    const { error } = await supabase
      .from("reviewers_pool")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting reviewer:", error)
      return NextResponse.json({ error: "Failed to delete reviewer" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/reviewers-pool:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
