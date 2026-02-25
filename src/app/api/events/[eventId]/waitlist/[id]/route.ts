import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = { ...body }

    if (body.status === "notified" && !body.notified_at) {
      updateData.notified_at = new Date().toISOString()
    }

    const { data, error } = await db
      .from("waitlist")
      .update(updateData)
      .eq("id", id)
      .eq("event_id", eventId)
      .select()
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Waitlist entry not found" }, { status: 404 })
      }
      console.error("Error updating waitlist entry:", error)
      return NextResponse.json({ error: "Failed to update waitlist entry" }, { status: 500 })
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
      .from("waitlist")
      .delete()
      .eq("id", id)
      .eq("event_id", eventId)

    if (error) {
      console.error("Error deleting waitlist entry:", error)
      return NextResponse.json({ error: "Failed to delete waitlist entry" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
