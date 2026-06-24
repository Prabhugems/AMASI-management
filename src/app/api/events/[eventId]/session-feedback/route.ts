import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

type FeedbackRow = {
  id: string
  session_id: string
  rating_overall: number
  rating_content: number | null
  rating_delivery: number | null
  comments: string | null
  is_anonymous: boolean
  respondent_email: string | null
  created_at: string
}

type SessionRow = {
  id: string
  session_name: string | null
  session_date: string | null
  hall: string | null
}

type SessionSummary = {
  session_id: string
  session_name: string | null
  session_date: string | null
  hall: string | null
  count: number
  avg_overall: number | null
  avg_content: number | null
  avg_delivery: number | null
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
  recent_comments: Array<{
    id: string
    rating_overall: number
    comments: string
    is_anonymous: boolean
    created_at: string
  }>
}

// GET /api/events/[eventId]/session-feedback?session_id=...
// Admin aggregated ratings + recent comments per session.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "speakers")
  if (authError) return authError

  const url = new URL(request.url)
  const sessionFilter = url.searchParams.get("session_id")

  try {
    const supabase = await createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fbQuery = (supabase as any)
      .from("session_feedback")
      .select(
        "id, session_id, rating_overall, rating_content, rating_delivery, comments, is_anonymous, respondent_email, created_at"
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })

    if (sessionFilter) fbQuery = fbQuery.eq("session_id", sessionFilter)

    const { data: feedbackRows, error: fbError } = await fbQuery

    if (fbError) {
      console.error("admin session-feedback list error", { eventId, error: fbError })
      return NextResponse.json({ error: "Failed to load feedback" }, { status: 500 })
    }

    const rows = (feedbackRows ?? []) as FeedbackRow[]
    const sessionIds = Array.from(new Set(rows.map((r) => r.session_id)))

    // Always include the filter session even if no feedback yet.
    if (sessionFilter && !sessionIds.includes(sessionFilter)) {
      sessionIds.push(sessionFilter)
    }

    let sessions: SessionRow[] = []
    if (sessionIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sessionsData } = await (supabase as any)
        .from("sessions")
        .select("id, session_name, session_date, hall")
        .in("id", sessionIds)
      sessions = (sessionsData ?? []) as SessionRow[]
    }
    const sessionMap = new Map(sessions.map((s) => [s.id, s]))

    const grouped = new Map<string, FeedbackRow[]>()
    for (const r of rows) {
      const arr = grouped.get(r.session_id) ?? []
      arr.push(r)
      grouped.set(r.session_id, arr)
    }

    const avg = (vals: Array<number | null>): number | null => {
      const nums = vals.filter((v): v is number => typeof v === "number")
      if (nums.length === 0) return null
      return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
    }

    const result: SessionSummary[] = sessionIds.map((sid) => {
      const groupRows = grouped.get(sid) ?? []
      const session = sessionMap.get(sid)
      const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      for (const r of groupRows) {
        const k = r.rating_overall as 1 | 2 | 3 | 4 | 5
        if (k >= 1 && k <= 5) distribution[k] += 1
      }
      const recentComments = groupRows
        .filter((r) => r.comments && r.comments.trim().length > 0)
        .slice(0, 50)
        .map((r) => ({
          id: r.id,
          rating_overall: r.rating_overall,
          comments: r.comments!,
          is_anonymous: r.is_anonymous,
          created_at: r.created_at,
        }))

      return {
        session_id: sid,
        session_name: session?.session_name ?? null,
        session_date: session?.session_date ?? null,
        hall: session?.hall ?? null,
        count: groupRows.length,
        avg_overall: avg(groupRows.map((r) => r.rating_overall)),
        avg_content: avg(groupRows.map((r) => r.rating_content)),
        avg_delivery: avg(groupRows.map((r) => r.rating_delivery)),
        distribution,
        recent_comments: recentComments,
      }
    })

    return NextResponse.json({ data: result })
  } catch (e) {
    console.error("admin session-feedback GET error", { eventId, error: e })
    return NextResponse.json({ error: "Failed to load feedback" }, { status: 500 })
  }
}
