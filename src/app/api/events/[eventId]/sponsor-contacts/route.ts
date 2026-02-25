import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { user: _user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId } = await params
    const { searchParams } = new URL(request.url)
    const sponsorId = searchParams.get("sponsor_id")

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    let query = db
      .from("sponsor_contacts")
      .select("*, sponsors!inner(event_id)")
      .eq("sponsors.event_id", eventId)

    if (sponsorId) {
      query = query.eq("sponsor_id", sponsorId)
    }

    const { data, error } = await query.order("is_primary", { ascending: false })

    if (error) {
      console.error("Error fetching sponsor contacts:", error)
      return NextResponse.json({ error: "Failed to fetch sponsor contacts" }, { status: 500 })
    }

    return NextResponse.json(data || [])
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
    const { user: _user, error: authError } = await requireAdmin()
    if (authError) return authError

    await params // validate eventId param exists
    const body = await request.json()

    const { sponsor_id, name, designation, email, phone, is_primary, needs_badge } = body

    if (!sponsor_id || !name) {
      return NextResponse.json({ error: "sponsor_id and name are required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data, error } = await db
      .from("sponsor_contacts")
      .insert({
        sponsor_id,
        name,
        designation: designation || null,
        email: email || null,
        phone: phone || null,
        is_primary: is_primary ?? false,
        needs_badge: needs_badge ?? true,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating sponsor contact:", error)
      return NextResponse.json({ error: "Failed to create sponsor contact" }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
