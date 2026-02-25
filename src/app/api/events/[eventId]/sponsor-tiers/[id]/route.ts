import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string; id: string }> }
) {
  try {
    const { user: _user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId, id } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data, error } = await db
      .from("sponsor_tiers")
      .select("*")
      .eq("id", id)
      .eq("event_id", eventId)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Sponsor tier not found" }, { status: 404 })
      }
      console.error("Error fetching sponsor tier:", error)
      return NextResponse.json({ error: "Failed to fetch sponsor tier" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; id: string }> }
) {
  try {
    const { user: _user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId, id } = await params
    const body = await request.json()

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data, error } = await db
      .from("sponsor_tiers")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("event_id", eventId)
      .select()
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Sponsor tier not found" }, { status: 404 })
      }
      console.error("Error updating sponsor tier:", error)
      return NextResponse.json({ error: "Failed to update sponsor tier" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string; id: string }> }
) {
  try {
    const { user: _user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId, id } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { error } = await db
      .from("sponsor_tiers")
      .delete()
      .eq("id", id)
      .eq("event_id", eventId)

    if (error) {
      console.error("Error deleting sponsor tier:", error)
      return NextResponse.json({ error: "Failed to delete sponsor tier" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
