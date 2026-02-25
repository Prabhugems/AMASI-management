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
    const status = searchParams.get("status")
    const sponsorId = searchParams.get("sponsor_id")

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    let query = db
      .from("stalls")
      .select("*, sponsors(id, name, logo_url)")
      .eq("event_id", eventId)
      .order("stall_number", { ascending: true })

    if (status) {
      query = query.eq("status", status)
    }
    if (sponsorId) {
      query = query.eq("sponsor_id", sponsorId)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching stalls:", error)
      return NextResponse.json({ error: "Failed to fetch stalls" }, { status: 500 })
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

    const {
      stall_number, stall_name, size, location, sponsor_id,
      position_x, position_y, width, height, status: stallStatus,
      amenities, price, notes,
    } = body

    if (!stall_number) {
      return NextResponse.json({ error: "Stall number is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data, error } = await db
      .from("stalls")
      .insert({
        event_id: eventId,
        stall_number,
        stall_name: stall_name || null,
        size: size || null,
        location: location || null,
        sponsor_id: sponsor_id || null,
        position_x: position_x ?? 0,
        position_y: position_y ?? 0,
        width: width ?? 1,
        height: height ?? 1,
        status: stallStatus || "available",
        amenities: amenities || [],
        price: price ?? 0,
        notes: notes || null,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating stall:", error)
      return NextResponse.json({ error: "Failed to create stall" }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
