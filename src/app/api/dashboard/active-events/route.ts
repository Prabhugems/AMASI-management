import { NextResponse } from "next/server"
import { getApiUser } from "@/lib/auth/api-auth"
import { createAdminClient } from "@/lib/supabase/server"

export async function GET() {
  const { error: authError } = await getApiUser()
  if (authError) return authError

  const supabase = await createAdminClient()
  const today = new Date().toISOString().split("T")[0]

  // Fetch active events
  const { data: events, error } = await supabase
    .from("events")
    .select("id, name, short_name, event_type, city, state, start_date, status")
    .not("status", "in", '("completed","archived")')
    .or(`start_date.gte.${today},status.eq.ongoing`)
    .order("start_date", { ascending: true })
    .limit(5)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!events || events.length === 0) {
    return NextResponse.json([])
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventIds = events.map((e: any) => e.id)

  // Fetch faculty assignment counts per event grouped by status
  const { data: assignments } = await supabase
    .from("faculty_assignments")
    .select("event_id, status")
    .in("event_id", eventIds)

  // Fetch registration counts per event
  const { data: registrations } = await supabase
    .from("registrations")
    .select("event_id")
    .in("event_id", eventIds)

  // Aggregate counts
  const facultyCounts: Record<string, { confirmed: number; pending: number; declined: number }> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const a of (assignments || []) as any[]) {
    if (!facultyCounts[a.event_id]) facultyCounts[a.event_id] = { confirmed: 0, pending: 0, declined: 0 }
    if (a.status === "confirmed") facultyCounts[a.event_id].confirmed++
    else if (a.status === "pending" || a.status === "invited") facultyCounts[a.event_id].pending++
    else if (a.status === "declined") facultyCounts[a.event_id].declined++
  }

  const regCounts: Record<string, number> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (registrations || []) as any[]) {
    regCounts[r.event_id] = (regCounts[r.event_id] || 0) + 1
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = events.map((event: any) => {
    const fc = facultyCounts[event.id] || { confirmed: 0, pending: 0, declined: 0 }
    const totalFaculty = fc.confirmed + fc.pending + fc.declined
    const totalDelegates = regCounts[event.id] || 0
    const progress = totalFaculty > 0 ? Math.min(100, Math.round((fc.confirmed / totalFaculty) * 100)) : 0

    return {
      ...event,
      confirmed_faculty: fc.confirmed,
      pending_faculty: fc.pending,
      declined_faculty: fc.declined,
      total_delegates: totalDelegates,
      progress,
    }
  })

  return NextResponse.json(result)
}
