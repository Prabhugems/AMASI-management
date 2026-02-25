import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { user: _user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Get forms that are surveys or feedback for this event
    const { data: forms, error } = await db
      .from("forms")
      .select("*, form_submissions(id)")
      .eq("event_id", eventId)
      .in("form_type", ["survey", "feedback"])
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching surveys:", error)
      return NextResponse.json({ error: "Failed to fetch surveys" }, { status: 500 })
    }

    // Add submission count to each form
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const surveysWithCounts = (forms || []).map((form: any) => ({
      ...form,
      submission_count: form.form_submissions?.length || 0,
      form_submissions: undefined,
    }))

    return NextResponse.json(surveysWithCounts)
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId } = await params
    const body = await request.json()

    const { title, description } = body

    if (!title) {
      return NextResponse.json({ error: "Survey title is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data, error } = await db
      .from("forms")
      .insert({
        event_id: eventId,
        title,
        description: description || null,
        form_type: "survey",
        status: "draft",
        created_by: user?.id || null,
        is_anonymous: false,
        require_login: false,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating survey:", error)
      return NextResponse.json({ error: "Failed to create survey" }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
