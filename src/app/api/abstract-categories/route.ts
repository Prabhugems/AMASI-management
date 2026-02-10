import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// GET /api/abstract-categories?event_id=xxx - List categories for an event
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")
    const activeOnly = searchParams.get("active_only") === "true"

    if (!eventId) {
      return NextResponse.json(
        { error: "event_id is required" },
        { status: 400 }
      )
    }

    const supabase: SupabaseClient = await createServerSupabaseClient()

    let query = supabase
      .from("abstract_categories")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })

    if (activeOnly) {
      query = query.eq("is_active", true)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching abstract categories:", error)
      return NextResponse.json(
        { error: "Failed to fetch categories" },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("Error in GET /api/abstract-categories:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/abstract-categories - Create a new category
export async function POST(request: NextRequest) {
  try {
    const supabase: SupabaseClient = await createServerSupabaseClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Use admin client to bypass RLS
    const adminClient: SupabaseClient = await createAdminClient()

    // Team member authorization
    const { data: teamMember } = await adminClient
      .from("team_members")
      .select("id")
      .eq("email", user.email?.toLowerCase())
      .eq("is_active", true)
      .maybeSingle()
    if (!teamMember) {
      return NextResponse.json(
        { error: "Only team members can manage categories" },
        { status: 403 }
      )
    }

    const body = await request.json()

    if (!body.event_id) {
      return NextResponse.json(
        { error: "event_id is required" },
        { status: 400 }
      )
    }

    if (!body.name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      )
    }

    // Get the next sort order
    const { data: existingCategories } = await adminClient
      .from("abstract_categories")
      .select("sort_order")
      .eq("event_id", body.event_id)
      .order("sort_order", { ascending: false })
      .limit(1)

    const nextSortOrder = existingCategories && existingCategories.length > 0
      ? (existingCategories[0].sort_order || 0) + 1
      : 0

    const { data, error } = await adminClient
      .from("abstract_categories")
      .insert({
        event_id: body.event_id,
        name: body.name,
        description: body.description || null,
        max_submissions: body.max_submissions || null,
        sort_order: nextSortOrder,
        is_active: body.is_active ?? true,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating abstract category:", error)
      return NextResponse.json(
        { error: "Failed to create category" },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in POST /api/abstract-categories:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// PUT /api/abstract-categories - Update a category
export async function PUT(request: NextRequest) {
  try {
    const supabase: SupabaseClient = await createServerSupabaseClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Use admin client to bypass RLS
    const adminClient: SupabaseClient = await createAdminClient()

    // Team member authorization
    const { data: teamMember } = await adminClient
      .from("team_members")
      .select("id")
      .eq("email", user.email?.toLowerCase())
      .eq("is_active", true)
      .maybeSingle()
    if (!teamMember) {
      return NextResponse.json(
        { error: "Only team members can manage categories" },
        { status: 403 }
      )
    }

    const body = await request.json()

    if (!body.id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      )
    }

    const updateData: Record<string, any> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.max_submissions !== undefined) updateData.max_submissions = body.max_submissions
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order
    if (body.is_active !== undefined) updateData.is_active = body.is_active

    const { data, error } = await adminClient
      .from("abstract_categories")
      .update(updateData)
      .eq("id", body.id)
      .select()
      .single()

    if (error) {
      console.error("Error updating abstract category:", error)
      return NextResponse.json(
        { error: "Failed to update category" },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in PUT /api/abstract-categories:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE /api/abstract-categories - Delete a category
export async function DELETE(request: NextRequest) {
  try {
    const supabase: SupabaseClient = await createServerSupabaseClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Use admin client to bypass RLS
    const adminClient: SupabaseClient = await createAdminClient()

    // Team member authorization
    const { data: teamMember } = await adminClient
      .from("team_members")
      .select("id")
      .eq("email", user.email?.toLowerCase())
      .eq("is_active", true)
      .maybeSingle()
    if (!teamMember) {
      return NextResponse.json(
        { error: "Only team members can manage categories" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      )
    }

    // Check if category has any abstracts
    const { count: abstractCount } = await adminClient
      .from("abstracts")
      .select("*", { count: "exact", head: true })
      .eq("category_id", id)

    if (abstractCount && abstractCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete category with ${abstractCount} abstract(s). Please reassign or delete the abstracts first.` },
        { status: 400 }
      )
    }

    const { error } = await adminClient
      .from("abstract_categories")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting abstract category:", error)
      return NextResponse.json(
        { error: "Failed to delete category" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/abstract-categories:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
