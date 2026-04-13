import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { createAdminClient } from "@/lib/supabase/server"

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId } = await params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")
    const q = searchParams.get("q")
    const status = searchParams.get("status")
    const source = searchParams.get("source")
    const sortBy = searchParams.get("sort_by") || "created_at"
    const sortOrder = searchParams.get("sort_order") || "desc"

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    let query = db
      .from("event_leads")
      .select("*", { count: "exact" })
      .eq("event_id", eventId)

    if (q) {
      query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
    }

    if (status && status !== "all") {
      query = query.eq("status", status)
    }

    if (source && source !== "all") {
      query = query.eq("source", source)
    }

    query = query
      .order(sortBy, { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error("Error fetching leads:", error)
      return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 })
    }

    return NextResponse.json({ data: data || [], count, limit, offset })
  } catch (error: any) {
    console.error("Error in GET /api/events/[eventId]/leads:", error)
    return NextResponse.json({ error: error.message || "Server error" }, { status: error.status || 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId } = await params
    const body = await request.json()
    const { email, name, phone, source, utm_source, utm_medium, utm_campaign, notes } = body

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 })
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data: existing } = await db
      .from("event_leads")
      .select("id")
      .eq("event_id", eventId)
      .eq("email", email.toLowerCase())
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: "A lead with this email already exists for this event" }, { status: 409 })
    }

    const { data, error } = await db
      .from("event_leads")
      .insert({
        event_id: eventId,
        email: email.toLowerCase(),
        name: name || null,
        phone: phone || null,
        source: source || null,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        notes: notes || null,
        status: "new",
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating lead:", error)
      return NextResponse.json({ error: "Failed to create lead" }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    console.error("Error in POST /api/events/[eventId]/leads:", error)
    return NextResponse.json({ error: error.message || "Server error" }, { status: error.status || 500 })
  }
}
