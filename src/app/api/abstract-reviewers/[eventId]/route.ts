import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/abstract-reviewers/[eventId] - List reviewers with review counts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    if (!uuidRegex.test(eventId)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 })
    }

    const supabase: SupabaseClient = await createAdminClient()

    // Fetch reviewers
    const { data: reviewers, error } = await supabase
      .from("abstract_reviewers")
      .select("*")
      .eq("event_id", eventId)
      .order("name", { ascending: true })

    if (error) {
      console.error("Error fetching reviewers:", error)
      return NextResponse.json({ error: "Failed to fetch reviewers" }, { status: 500 })
    }

    // Fetch review counts per reviewer email for this event
    const { data: reviews } = await supabase
      .from("abstract_reviews")
      .select("reviewer_email, abstract_id, abstracts!inner(event_id)")
      .eq("abstracts.event_id", eventId)

    // Count reviews per email
    const reviewCounts: Record<string, number> = {}
    if (reviews) {
      for (const r of reviews) {
        const email = (r.reviewer_email || "").toLowerCase()
        reviewCounts[email] = (reviewCounts[email] || 0) + 1
      }
    }

    // Merge review counts into reviewers
    const reviewersWithCounts = (reviewers || []).map((reviewer: any) => ({
      ...reviewer,
      review_count: reviewCounts[reviewer.email.toLowerCase()] || 0,
    }))

    return NextResponse.json(reviewersWithCounts)
  } catch (error) {
    console.error("Error in GET /api/abstract-reviewers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/abstract-reviewers/[eventId] - Add single or bulk reviewers
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    if (!uuidRegex.test(eventId)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 })
    }

    const authSupabase: SupabaseClient = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase: SupabaseClient = await createAdminClient()

    const body = await request.json()
    const reviewers = Array.isArray(body) ? body : [body]

    if (reviewers.length === 0) {
      return NextResponse.json({ error: "No reviewers provided" }, { status: 400 })
    }

    const toInsert = reviewers.map((r: any) => ({
      event_id: eventId,
      name: (r.name || "").trim(),
      email: (r.email || "").trim().toLowerCase(),
      phone: r.phone?.trim() || null,
      institution: r.institution?.trim() || null,
      city: r.city?.trim() || null,
      specialty: r.specialty?.trim() || null,
      years_of_experience: r.years_of_experience?.toString().trim() || null,
      status: r.status?.trim() || "active",
      notes: r.notes?.trim() || null,
    })).filter((r: any) => r.name && r.email)

    if (toInsert.length === 0) {
      return NextResponse.json({ error: "No valid reviewers (name and email required)" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("abstract_reviewers")
      .upsert(toInsert, { onConflict: "event_id,email", ignoreDuplicates: false })
      .select()

    if (error) {
      console.error("Error inserting reviewers:", error)
      return NextResponse.json({ error: "Failed to import reviewers" }, { status: 500 })
    }

    return NextResponse.json({
      success: data?.length || 0,
      failed: toInsert.length - (data?.length || 0),
      errors: [],
    })
  } catch (error) {
    console.error("Error in POST /api/abstract-reviewers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/abstract-reviewers/[eventId] - Update a reviewer
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    if (!uuidRegex.test(eventId)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 })
    }

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
    if (updates.assigned_abstracts !== undefined) payload.assigned_abstracts = updates.assigned_abstracts

    const { data, error } = await supabase
      .from("abstract_reviewers")
      .update(payload)
      .eq("id", id)
      .eq("event_id", eventId)
      .select()
      .single()

    if (error) {
      console.error("Error updating reviewer:", error)
      return NextResponse.json({ error: "Failed to update reviewer" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in PUT /api/abstract-reviewers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/abstract-reviewers/[eventId] - Remove a reviewer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    if (!uuidRegex.test(eventId)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 })
    }

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
      .from("abstract_reviewers")
      .delete()
      .eq("id", id)
      .eq("event_id", eventId)

    if (error) {
      console.error("Error deleting reviewer:", error)
      return NextResponse.json({ error: "Failed to delete reviewer" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/abstract-reviewers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
