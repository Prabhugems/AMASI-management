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

// GET /api/reviewers-pool - List all reviewers in global pool
export async function GET() {
  try {
    const supabase: SupabaseClient = await createAdminClient()

    const { data, error } = await supabase
      .from("reviewers_pool")
      .select("*")
      .order("name", { ascending: true })

    if (error) {
      console.error("Error fetching reviewers pool:", error)
      return NextResponse.json({ error: "Failed to fetch reviewers" }, { status: 500 })
    }

    return NextResponse.json(data || [])
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
