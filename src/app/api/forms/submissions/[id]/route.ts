import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// GET /api/forms/submissions/[id] - Get a specific submission
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase: SupabaseClient = await createServerSupabaseClient()
    const { id } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: submission, error } = await supabase
      .from("form_submissions")
      .select("*, forms(*)")
      .eq("id", id)
      .single()

    if (error || !submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 })
    }

    return NextResponse.json(submission)
  } catch (error) {
    console.error("Error fetching submission:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/forms/submissions/[id] - Update submission status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase: SupabaseClient = await createServerSupabaseClient()
    const { id } = await params
    const body = await request.json()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { status } = body

    if (!status || !["pending", "reviewed", "approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status !== "pending") {
      updateData.reviewed_at = new Date().toISOString()
      updateData.reviewed_by = user.id
    }

    // Use admin client to bypass RLS for update operations
    const adminClient: SupabaseClient = await createAdminClient()

    const { data: submission, error } = await adminClient
      .from("form_submissions")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating submission:", error)
      return NextResponse.json({ error: "Failed to update submission" }, { status: 500 })
    }

    return NextResponse.json(submission)
  } catch (error) {
    console.error("Error in PATCH /api/forms/submissions/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/forms/submissions/[id] - Delete a submission
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase: SupabaseClient = await createServerSupabaseClient()
    const { id } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Use admin client to bypass RLS for delete operations
    const adminClient: SupabaseClient = await createAdminClient()

    const { error } = await adminClient
      .from("form_submissions")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting submission:", error)
      return NextResponse.json({ error: "Failed to delete submission" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/forms/submissions/[id]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
