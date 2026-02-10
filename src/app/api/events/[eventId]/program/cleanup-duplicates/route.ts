import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Fetch all assignments for this event
    const { data: assignments, error } = await db
      .from("faculty_assignments")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true })

    if (error) {
      return NextResponse.json({ error: "Failed to process faculty assignments" }, { status: 500 })
    }

    // Find duplicates (same session_id + faculty_name + role)
    const seen = new Map<string, string>() // key -> id to keep
    const duplicateIds: string[] = []

    for (const a of assignments || []) {
      const key = `${a.session_id}|${a.faculty_name}|${a.role}`
      if (seen.has(key)) {
        // This is a duplicate - mark for deletion
        duplicateIds.push(a.id)
      } else {
        seen.set(key, a.id)
      }
    }

    // Delete duplicates
    if (duplicateIds.length > 0) {
      for (const id of duplicateIds) {
        await db
          .from("faculty_assignments")
          .delete()
          .eq("id", id)
      }
    }

    return NextResponse.json({
      success: true,
      totalAssignments: assignments?.length || 0,
      duplicatesRemoved: duplicateIds.length,
      remaining: (assignments?.length || 0) - duplicateIds.length,
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Fetch all assignments for this event
    const { data: assignments, error } = await db
      .from("faculty_assignments")
      .select("id, session_id, faculty_name, role, session_name")
      .eq("event_id", eventId)

    if (error) {
      return NextResponse.json({ error: "Failed to process faculty assignments" }, { status: 500 })
    }

    // Find duplicates
    const counts = new Map<string, number>()
    for (const a of assignments || []) {
      const key = `${a.session_id}|${a.faculty_name}|${a.role}`
      counts.set(key, (counts.get(key) || 0) + 1)
    }

    const duplicates = Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([key, count]) => ({ key, count }))

    return NextResponse.json({
      totalAssignments: assignments?.length || 0,
      duplicateGroups: duplicates.length,
      duplicates,
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
