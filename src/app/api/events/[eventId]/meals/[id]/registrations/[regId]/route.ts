import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; id: string; regId: string }> }
) {
  try {
    const { user: _user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { regId } = await params
    const body = await request.json()

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = { ...body }

    // Set checked_in_at when status changes to checked_in
    if (body.status === "checked_in" && !body.checked_in_at) {
      updateData.checked_in_at = new Date().toISOString()
    }

    const { data, error } = await db
      .from("meal_registrations")
      .update(updateData)
      .eq("id", regId)
      .select()
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Meal registration not found" }, { status: 404 })
      }
      console.error("Error updating meal registration:", error)
      return NextResponse.json({ error: "Failed to update" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string; id: string; regId: string }> }
) {
  try {
    const { user: _user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { regId } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { error } = await db
      .from("meal_registrations")
      .delete()
      .eq("id", regId)

    if (error) {
      console.error("Error deleting meal registration:", error)
      return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
