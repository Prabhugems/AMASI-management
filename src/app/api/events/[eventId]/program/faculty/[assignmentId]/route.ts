import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { syncSpeakerStatus } from "@/lib/services/sync-speaker-status"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; assignmentId: string }> }
) {
  try {
    const { user: _user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId, assignmentId } = await params
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json(
        { error: "status is required" },
        { status: 400 }
      )
    }

    const validStatuses = ["pending", "invited", "confirmed", "declined", "change_requested"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Update the assignment status
    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    }

    // If admin confirms, set responded_at
    if (status === "confirmed") {
      updateData.responded_at = new Date().toISOString()
    }

    const { data, error } = await db
      .from("faculty_assignments")
      .update(updateData)
      .eq("id", assignmentId)
      .eq("event_id", eventId)
      .select()
      .single()

    if (error) {
      console.error("Update error:", error)
      // Handle not found error specifically
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Assignment not found" },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: "Failed to update assignment" },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      )
    }

    // Sync status to registrations when assignment status is confirmed/declined/cancelled
    const syncableStatuses = ["confirmed", "declined", "cancelled"]
    if (syncableStatuses.includes(status) && data.faculty_email) {
      try {
        await syncSpeakerStatus(db, eventId, data.faculty_email, status)
      } catch (syncError) {
        console.error("Sync speaker status error:", syncError)
      }
    }

    return NextResponse.json({
      success: true,
      assignment: data,
    })
  } catch (error: any) {
    console.error("Error updating assignment:", error)
    return NextResponse.json(
      { error: "Failed to update assignment" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; assignmentId: string }> }
) {
  try {
    const { user: _user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId, assignmentId } = await params

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { error } = await db
      .from("faculty_assignments")
      .delete()
      .eq("id", assignmentId)
      .eq("event_id", eventId)

    if (error) {
      console.error("Delete error:", error)
      return NextResponse.json(
        { error: "Failed to delete assignment" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting assignment:", error)
    return NextResponse.json(
      { error: "Failed to delete assignment" },
      { status: 500 }
    )
  }
}
