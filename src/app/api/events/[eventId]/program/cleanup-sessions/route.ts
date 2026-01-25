import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Fetch all sessions for this event
    const { data: sessions, error } = await db
      .from("sessions")
      .select("id, session_name, session_date, start_time, end_time, hall")
      .eq("event_id", eventId)
      .order("session_name")
      .order("session_date")
      .order("start_time")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Find duplicates (same name + date + time + hall)
    const counts = new Map<string, { count: number; ids: string[] }>()
    for (const s of sessions || []) {
      const key = `${s.session_name}|${s.session_date}|${s.start_time}|${s.hall}`
      const existing = counts.get(key) || { count: 0, ids: [] }
      existing.count++
      existing.ids.push(s.id)
      counts.set(key, existing)
    }

    const duplicates = Array.from(counts.entries())
      .filter(([, data]) => data.count > 1)
      .map(([key, data]) => ({
        key,
        count: data.count,
        ids: data.ids,
        keepId: data.ids[0], // Keep the first one
        deleteIds: data.ids.slice(1), // Delete the rest
      }))

    return NextResponse.json({
      totalSessions: sessions?.length || 0,
      duplicateGroups: duplicates.length,
      totalDuplicates: duplicates.reduce((sum, d) => sum + d.deleteIds.length, 0),
      duplicates: duplicates.map(d => ({
        session: d.key.split('|')[0],
        count: d.count,
        idsToDelete: d.deleteIds,
      })),
    })
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
    const { eventId } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Fetch all sessions for this event
    const { data: sessions, error } = await db
      .from("sessions")
      .select("id, session_name, session_date, start_time, end_time, hall")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Find duplicates (same name + date + time + hall)
    const seen = new Map<string, string>() // key -> id to keep
    const deleteIds: string[] = []

    for (const s of sessions || []) {
      const key = `${s.session_name}|${s.session_date}|${s.start_time}|${s.hall}`
      if (seen.has(key)) {
        deleteIds.push(s.id)
      } else {
        seen.set(key, s.id)
      }
    }

    // Delete duplicate sessions (this will cascade to faculty_assignments)
    let deleted = 0
    for (const id of deleteIds) {
      // First delete related faculty_assignments
      await db
        .from("faculty_assignments")
        .delete()
        .eq("session_id", id)

      // Then delete the session
      const { error: delError } = await db
        .from("sessions")
        .delete()
        .eq("id", id)

      if (!delError) deleted++
    }

    return NextResponse.json({
      success: true,
      duplicatesFound: deleteIds.length,
      deleted,
      remainingSessions: (sessions?.length || 0) - deleted,
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
