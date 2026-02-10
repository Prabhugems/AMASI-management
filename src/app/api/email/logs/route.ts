import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// GET /api/email/logs - Get email logs with filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    const registrationId = searchParams.get("registration_id")
    const eventId = searchParams.get("event_id")
    const emailType = searchParams.get("email_type")
    const status = searchParams.get("status")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    let query = (supabase as any)
      .from("email_logs")
      .select("*", { count: "exact" })
      .order("sent_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (registrationId) {
      query = query.eq("registration_id", registrationId)
    }

    if (eventId) {
      query = query.eq("event_id", eventId)
    }

    if (emailType) {
      query = query.eq("email_type", emailType)
    }

    if (status) {
      query = query.eq("status", status)
    }

    const { data, error, count } = await query

    if (error) {
      console.error("Error fetching email logs:", error)
      return NextResponse.json({ error: "Failed to fetch email logs" }, { status: 500 })
    }

    // Calculate stats
    const stats = {
      total: count || 0,
      delivered: data?.filter((e: any) => e.delivered_at).length || 0,
      opened: data?.filter((e: any) => e.opened_at).length || 0,
      clicked: data?.filter((e: any) => e.clicked_at).length || 0,
      bounced: data?.filter((e: any) => e.status === "bounced").length || 0,
      responded: data?.filter((e: any) => e.responded_at).length || 0,
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
