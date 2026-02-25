import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { user: _user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data, error } = await db
      .from("sponsor_tiers")
      .select("*")
      .eq("event_id", eventId)
      .order("display_order", { ascending: true })

    if (error) {
      console.error("Error fetching sponsor tiers:", error)
      return NextResponse.json({ error: "Failed to fetch sponsor tiers" }, { status: 500 })
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

    const { eventId } = await params
    const body = await request.json()

    const { name, display_order, color, benefits, logo_size, stall_size, complimentary_passes, price } = body

    if (!name) {
      return NextResponse.json({ error: "Tier name is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data, error } = await db
      .from("sponsor_tiers")
      .insert({
        event_id: eventId,
        name,
        display_order: display_order ?? 0,
        color: color || "#6366f1",
        benefits: benefits || [],
        logo_size: logo_size || "medium",
        stall_size: stall_size || null,
        complimentary_passes: complimentary_passes ?? 0,
        price: price ?? 0,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating sponsor tier:", error)
      return NextResponse.json({ error: "Failed to create sponsor tier" }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
