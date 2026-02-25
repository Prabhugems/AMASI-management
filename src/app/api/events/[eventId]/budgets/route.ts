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
      .from("budgets")
      .select("*")
      .eq("event_id", eventId)
      .order("category", { ascending: true })

    if (error) {
      console.error("Error fetching budgets:", error)
      return NextResponse.json({ error: "Failed to fetch budgets" }, { status: 500 })
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

    const { name, category, estimated_amount, actual_amount, status: budgetStatus, notes } = body

    if (!name || !category) {
      return NextResponse.json({ error: "Name and category are required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data, error } = await db
      .from("budgets")
      .insert({
        event_id: eventId,
        name,
        category,
        estimated_amount: estimated_amount ?? 0,
        actual_amount: actual_amount ?? 0,
        status: budgetStatus || "planned",
        notes: notes || null,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating budget:", error)
      return NextResponse.json({ error: "Failed to create budget" }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
