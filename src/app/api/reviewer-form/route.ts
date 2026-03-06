import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// GET /api/reviewer-form?token=xxx - Get reviewer by form token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    const supabase: SupabaseClient = await createAdminClient()

    const { data, error } = await supabase
      .from("reviewers_pool")
      .select("id, name, email, phone, institution, city, specialty, years_of_experience, form_completed_at")
      .eq("form_token", token)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in GET /api/reviewer-form:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/reviewer-form - Update reviewer details via form token
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, ...updates } = body

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    const supabase: SupabaseClient = await createAdminClient()

    // Verify token exists
    const { data: existing } = await supabase
      .from("reviewers_pool")
      .select("id")
      .eq("form_token", token)
      .single()

    if (!existing) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 })
    }

    // Build update payload
    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
      form_completed_at: new Date().toISOString(),
    }

    if (updates.phone !== undefined) payload.phone = updates.phone
    if (updates.institution !== undefined) payload.institution = updates.institution
    if (updates.city !== undefined) payload.city = updates.city
    if (updates.specialty !== undefined) payload.specialty = updates.specialty
    if (updates.years_of_experience !== undefined) payload.years_of_experience = updates.years_of_experience

    const { data, error } = await supabase
      .from("reviewers_pool")
      .update(payload)
      .eq("form_token", token)
      .select()
      .single()

    if (error) {
      console.error("Error updating reviewer form:", error)
      return NextResponse.json({ error: "Failed to save details" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in PUT /api/reviewer-form:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
