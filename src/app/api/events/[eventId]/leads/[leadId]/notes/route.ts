import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { createAdminClient } from "@/lib/supabase/server"

type Params = { params: Promise<{ eventId: string; leadId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { leadId } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data, error } = await db
      .from("event_lead_notes")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching lead notes:", error)
      return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error: any) {
    console.error("Error in GET /api/events/[eventId]/leads/[leadId]/notes:", error)
    return NextResponse.json({ error: error.message || "Server error" }, { status: error.status || 500 })
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { leadId } = await params
    const body = await request.json()
    const { content, type = "note" } = body

    if (!content) {
      return NextResponse.json({ error: "content is required" }, { status: 400 })
    }

    const validTypes = ["note", "status_change", "email_sent", "call"]
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `Invalid type. Must be one of: ${validTypes.join(", ")}` }, { status: 400 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data, error } = await db
      .from("event_lead_notes")
      .insert({
        lead_id: leadId,
        content,
        type,
        created_by: user!.id,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating lead note:", error)
      return NextResponse.json({ error: "Failed to create note" }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    console.error("Error in POST /api/events/[eventId]/leads/[leadId]/notes:", error)
    return NextResponse.json({ error: error.message || "Server error" }, { status: error.status || 500 })
  }
}
