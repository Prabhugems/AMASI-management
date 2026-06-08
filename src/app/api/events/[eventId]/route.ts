import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAccess, requireAdmin } from "@/lib/auth/api-auth"

// GET /api/events/[eventId] - Get event details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params

    // Check authorization
    const { error: authError } = await requireEventAccess(eventId)
    if (authError) return authError

    const supabase = await createAdminClient()

    const { data: event, error } = await (supabase as any)
      .from("events")
      .select("*")
      .eq("id", eventId)
      .maybeSingle()

    if (error || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    return NextResponse.json(event)
  } catch (error: any) {
    console.error("Error in GET /api/events/[eventId]:", error)
    return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 })
  }
}

// DELETE /api/events/[eventId] - Permanently delete an event and all associated data
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params

    // Destructive, irreversible action — restrict to admin/super_admin
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const supabase = await createAdminClient()

    // Confirm the event exists before attempting the delete
    const { data: event } = await (supabase as any)
      .from("events")
      .select("id, name")
      .eq("id", eventId)
      .maybeSingle()

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Relies on ON DELETE CASCADE for child rows (registrations, addons, etc.)
    const { error } = await (supabase as any)
      .from("events")
      .delete()
      .eq("id", eventId)

    if (error) {
      console.error("Error deleting event:", error)
      return NextResponse.json(
        { error: "Failed to delete event. It may have linked records that must be removed first." },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error in DELETE /api/events/[eventId]:", error)
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 })
  }
}
