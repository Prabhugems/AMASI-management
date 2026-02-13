import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Fetch assignment by token to get faculty info
    const { data: assignment, error: assignmentError } = await db
      .from("faculty_assignments")
      .select("*")
      .eq("invitation_token", token)
      .maybeSingle()

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: "Invalid or expired invitation link" },
        { status: 404 }
      )
    }

    // Fetch ALL assignments for this faculty member in this event
    // Match by email if available, otherwise by name
    let allAssignments = []
    if (assignment.faculty_email) {
      const { data } = await db
        .from("faculty_assignments")
        .select("*")
        .eq("event_id", assignment.event_id)
        .eq("faculty_email", assignment.faculty_email)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true })
      allAssignments = data || []
    } else {
      const { data } = await db
        .from("faculty_assignments")
        .select("*")
        .eq("event_id", assignment.event_id)
        .eq("faculty_name", assignment.faculty_name)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true })
      allAssignments = data || []
    }

    // Fetch event details
    const { data: event } = await db
      .from("events")
      .select("id, name, short_name, logo_url, start_date, end_date, venue_name")
      .eq("id", assignment.event_id)
      .maybeSingle()

    return NextResponse.json({
      faculty: {
        name: assignment.faculty_name,
        email: assignment.faculty_email,
        phone: assignment.faculty_phone,
      },
      assignments: allAssignments,
      event
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { responses, globalResponse, notes } = body

    // responses is an object: { assignmentId: 'confirmed' | 'declined' | 'change_requested' }
    // OR globalResponse applies to all

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Fetch assignment by token to get faculty info
    const { data: assignment, error: assignmentError } = await db
      .from("faculty_assignments")
      .select("*")
      .eq("invitation_token", token)
      .maybeSingle()

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: "Invalid or expired invitation link" },
        { status: 404 }
      )
    }

    // Get all assignments for this faculty
    let allAssignments = []
    if (assignment.faculty_email) {
      const { data } = await db
        .from("faculty_assignments")
        .select("id")
        .eq("event_id", assignment.event_id)
        .eq("faculty_email", assignment.faculty_email)
      allAssignments = data || []
    } else {
      const { data } = await db
        .from("faculty_assignments")
        .select("id")
        .eq("event_id", assignment.event_id)
        .eq("faculty_name", assignment.faculty_name)
      allAssignments = data || []
    }

    const now = new Date().toISOString()

    // If globalResponse is provided, update all assignments with same status
    if (globalResponse) {
      const updateData: Record<string, unknown> = {
        status: globalResponse,
        responded_at: now,
      }

      if (globalResponse === 'declined') {
        updateData.response_notes = notes
      } else if (globalResponse === 'change_requested') {
        updateData.change_request_details = notes
      } else if (notes) {
        updateData.response_notes = notes
      }

      for (const a of allAssignments) {
        await db
          .from("faculty_assignments")
          .update(updateData)
          .eq("id", a.id)
      }
    } else if (responses) {
      // Update each assignment individually with its own notes
      for (const [assignmentId, status] of Object.entries(responses)) {
        const updateData: Record<string, unknown> = {
          status: status,
          responded_at: now,
        }
        // notes is now an object: { assignmentId: "note text" }
        const assignmentNote = notes && typeof notes === 'object' ? notes[assignmentId] : null
        if (status === 'declined' && assignmentNote) {
          updateData.response_notes = assignmentNote
        } else if (status === 'change_requested' && assignmentNote) {
          updateData.change_request_details = assignmentNote
        }
        await db
          .from("faculty_assignments")
          .update(updateData)
          .eq("id", assignmentId)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
