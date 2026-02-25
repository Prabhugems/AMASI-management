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
      .from("visa_requests")
      .select("*, registrations(id, attendee_name, attendee_email)")
      .eq("id", id)
      .eq("event_id", eventId)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Visa request not found" }, { status: 404 })
      }
      console.error("Error fetching visa request:", error)
      return NextResponse.json({ error: "Failed to fetch visa request" }, { status: 500 })
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
    const { user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId, id } = await params
    const body = await request.json()

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      ...body,
      updated_at: new Date().toISOString(),
    }

    // Track who processed it
    if (body.letter_status && body.letter_status !== "pending") {
      updateData.processed_by = user?.id || null
    }

    const { data, error } = await db
      .from("visa_requests")
      .update(updateData)
      .eq("id", id)
      .eq("event_id", eventId)
      .select()
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Visa request not found" }, { status: 404 })
      }
      console.error("Error updating visa request:", error)
      return NextResponse.json({ error: "Failed to update visa request" }, { status: 500 })
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
      .from("visa_requests")
      .delete()
      .eq("id", id)
      .eq("event_id", eventId)

    if (error) {
      console.error("Error deleting visa request:", error)
      return NextResponse.json({ error: "Failed to delete visa request" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
