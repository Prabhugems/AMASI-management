import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// GET /api/hotels - Get hotels for an event
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return NextResponse.json({ error: "event_id required" }, { status: 400 })
    }

    const { data: hotels, error } = await (supabase as any)
      .from("hotels")
      .select("*")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .order("name")

    if (error) throw error

    // Get assigned guest counts for each hotel
    const { data: registrations } = await (supabase as any)
      .from("registrations")
      .select("custom_fields")
      .eq("event_id", eventId)

    const hotelCounts: Record<string, number> = {}
    registrations?.forEach((r: any) => {
      const hotelId = r.custom_fields?.assigned_hotel_id
      if (hotelId) {
        hotelCounts[hotelId] = (hotelCounts[hotelId] || 0) + 1
      }
    })

    // Add assigned count to each hotel
    const hotelsWithCounts = hotels?.map((hotel: any) => ({
      ...hotel,
      assigned_rooms: hotelCounts[hotel.id] || 0,
      available_rooms: hotel.total_rooms - (hotelCounts[hotel.id] || 0),
    }))

    return NextResponse.json(hotelsWithCounts || [])
  } catch (error: any) {
    console.error("Error fetching hotels:", error)
    return NextResponse.json({ error: "Failed to process hotel request" }, { status: 500 })
  }
}

// POST /api/hotels - Create a new hotel
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const { data, error } = await (supabase as any)
      .from("hotels")
      .insert(body)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Error creating hotel:", error)
    return NextResponse.json({ error: "Failed to process hotel request" }, { status: 500 })
  }
}

// PUT /api/hotels - Update a hotel
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 })
    }

    const { data, error } = await (supabase as any)
      .from("hotels")
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Error updating hotel:", error)
    return NextResponse.json({ error: "Failed to process hotel request" }, { status: 500 })
  }
}

// DELETE /api/hotels - Delete a hotel (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 })
    }

    const { error } = await (supabase as any)
      .from("hotels")
      .update({ is_active: false })
      .eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting hotel:", error)
    return NextResponse.json({ error: "Failed to process hotel request" }, { status: 500 })
  }
}
