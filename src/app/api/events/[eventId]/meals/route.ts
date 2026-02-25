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
      .from("meal_plans")
      .select("*")
      .eq("event_id", eventId)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })

    if (error) {
      console.error("Error fetching meal plans:", error)
      return NextResponse.json({ error: "Failed to fetch meal plans" }, { status: 500 })
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
      name, date, meal_type, venue, capacity, start_time, end_time,
      menu_description, is_included, price, status: mealStatus, notes,
    } = body

    if (!name || !date || !meal_type) {
      return NextResponse.json({ error: "Name, date, and meal_type are required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data, error } = await db
      .from("meal_plans")
      .insert({
        event_id: eventId,
        name,
        date,
        meal_type,
        venue: venue || null,
        capacity: capacity || null,
        start_time: start_time || null,
        end_time: end_time || null,
        menu_description: menu_description || null,
        is_included: is_included ?? true,
        price: price ?? 0,
        status: mealStatus || "planned",
        notes: notes || null,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating meal plan:", error)
      return NextResponse.json({ error: "Failed to create meal plan" }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
