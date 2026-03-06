import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import crypto from "crypto"

function generateToken(): string {
  return crypto.randomBytes(16).toString("hex")
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

    const toInsert = reviewers.map((r: any) => ({
      name: (r.name || "").trim(),
      email: (r.email || "").trim().toLowerCase(),
      phone: r.phone?.toString().trim() || null,
      institution: r.institution?.trim() || null,
      city: r.city?.trim() || null,
      specialty: r.specialty?.trim() || null,
      years_of_experience: r.years_of_experience?.toString().trim() || null,
      status: r.status === "Yes" || r.status === "active" || r.status === "Maybe" ? "active" : r.status === "No" ? "inactive" : "active",
      notes: r.notes?.trim() || null,
      form_token: sendForm && !r.specialty ? generateToken() : null, // Generate token if no specialty (needs form)
    })).filter((r: any) => r.name && r.email)

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

// DELETE /api/reviewers-pool - Remove a reviewer
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
