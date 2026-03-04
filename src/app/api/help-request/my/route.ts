import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

// GET /api/help-request/my?email=X&event_id=Y - Public endpoint for delegate to see their requests
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get("email")
    const eventId = searchParams.get("event_id")

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 })
    }

    const supabase: SupabaseClient = await createAdminClient()

    let query = supabase
      .from("help_requests")
      .select("id, event_id, category, message, status, priority, created_at, resolved_at")
      .eq("email", email.toLowerCase())
      .order("created_at", { ascending: false })

    if (eventId) query = query.eq("event_id", eventId)

    const { data: requests, error } = await query

    if (error) {
      console.error("Error fetching delegate help requests:", error)
      return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
    }

    // Fetch replies for all requests
    const requestIds = (requests || []).map((r: any) => r.id)
    let repliesMap: Record<string, any[]> = {}

    if (requestIds.length > 0) {
      const { data: replies } = await supabase
        .from("help_request_replies")
        .select("*")
        .in("help_request_id", requestIds)
        .order("created_at", { ascending: true })

      if (replies) {
        for (const reply of replies) {
          if (!repliesMap[reply.help_request_id]) repliesMap[reply.help_request_id] = []
          repliesMap[reply.help_request_id].push(reply)
        }
      }
    }

    const result = (requests || []).map((r: any) => ({
      ...r,
      replies: repliesMap[r.id] || [],
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error in GET /api/help-request/my:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
