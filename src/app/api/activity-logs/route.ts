import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// GET - Fetch activity logs
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { searchParams } = new URL(request.url)

  const eventId = searchParams.get("event_id")
  const entityType = searchParams.get("entity_type")
  const action = searchParams.get("action")
  const userId = searchParams.get("user_id")
  const limit = parseInt(searchParams.get("limit") || "50")
  const offset = parseInt(searchParams.get("offset") || "0")
  const startDate = searchParams.get("start_date")
  const endDate = searchParams.get("end_date")

  try {
    let query = (supabase as any)
      .from("activity_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (eventId) {
      query = query.eq("event_id", eventId)
    }

    if (entityType) {
      query = query.eq("entity_type", entityType)
    }

    if (action) {
      query = query.eq("action", action)
    }

    if (userId) {
      query = query.eq("user_id", userId)
    }

    if (startDate) {
      query = query.gte("created_at", startDate)
    }

    if (endDate) {
      query = query.lte("created_at", endDate)
    }

    const { data, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      limit,
      offset,
    })
  } catch (error: any) {
    console.error("Error fetching activity logs:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Create activity log entry
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()

  try {
    const body = await request.json()
    const {
      action,
      entityType,
      entityId,
      entityName,
      eventId,
      eventName,
      description,
      metadata,
    } = body

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    const userEmail = user?.email || "anonymous"
    const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "Anonymous"

    const { data, error } = await (supabase as any)
      .from("activity_logs")
      .insert({
        user_id: user?.id,
        user_email: userEmail,
        user_name: userName,
        action,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        event_id: eventId,
        event_name: eventName,
        description,
        metadata: metadata || {},
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Error creating activity log:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
