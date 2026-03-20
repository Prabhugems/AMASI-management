import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getApiUser } from "@/lib/auth/api-auth"

// GET /api/email/logs - Get email logs with filters
export async function GET(request: NextRequest) {
  try {
    const user = await getApiUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    const registrationId = searchParams.get("registration_id")
    const eventId = searchParams.get("event_id")
    const emailType = searchParams.get("email_type")
    const status = searchParams.get("status")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    // Build base filter function to reuse for both queries
    const applyFilters = (query: any) => {
      if (registrationId) query = query.eq("registration_id", registrationId)
      if (eventId) query = query.eq("event_id", eventId)
      if (emailType) query = query.eq("email_type", emailType)
      if (status) query = query.eq("status", status)
      return query
    }

    // Paginated data query
    let dataQuery = (supabase as any)
      .from("email_logs")
      .select("*", { count: "exact" })
      .order("sent_at", { ascending: false })
      .range(offset, offset + limit - 1)
    dataQuery = applyFilters(dataQuery)

    const { data, error, count } = await dataQuery

    if (error) {
      console.error("Error fetching email logs:", error)
      return NextResponse.json({ error: "Failed to fetch email logs" }, { status: 500 })
    }

    // Fetch stats from full dataset (not paginated) using status-based counts
    let statsQuery = (supabase as any)
      .from("email_logs")
      .select("status, delivered_at, opened_at, clicked_at, bounced_at, responded_at")
    statsQuery = applyFilters(statsQuery)

    const { data: allLogs } = await statsQuery
    const allEmails = allLogs || []

    const stats = {
      total: count || 0,
      delivered: allEmails.filter((e: any) => e.delivered_at).length,
      opened: allEmails.filter((e: any) => e.opened_at).length,
      clicked: allEmails.filter((e: any) => e.clicked_at).length,
      bounced: allEmails.filter((e: any) => e.status === "bounced").length,
      responded: allEmails.filter((e: any) => e.responded_at).length,
    }

    return NextResponse.json({
      data,
      stats,
      count,
      limit,
      offset,
    })
  } catch (error: any) {
    console.error("Error in GET /api/email/logs:", error)
    return NextResponse.json({ error: "Failed to fetch email logs" }, { status: 500 })
  }
}
