import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string; id: string }> }
) {
  try {
    const { user: _user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { id } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data, error } = await db
      .from("meal_registrations")
      .select("*, registrations(id, attendee_name, attendee_email, attendee_phone)")
      .eq("meal_plan_id", id)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching meal registrations:", error)
      return NextResponse.json({ error: "Failed to fetch meal registrations" }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST: Bulk-register all confirmed attendees for a meal
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string; id: string }> }
) {
  try {
    const { user: _user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId, id } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Get all confirmed registrations for this event
    const { data: registrations, error: regError } = await db
      .from("registrations")
      .select("id")
      .eq("event_id", eventId)
      .eq("status", "confirmed")

    if (regError) {
      console.error("Error fetching registrations:", regError)
      return NextResponse.json({ error: "Failed to fetch registrations" }, { status: 500 })
    }

    if (!registrations || registrations.length === 0) {
      return NextResponse.json({ error: "No confirmed registrations found" }, { status: 400 })
    }

    // Get already registered meal entries
    const { data: existing } = await db
      .from("meal_registrations")
      .select("registration_id")
      .eq("meal_plan_id", id)

    const existingIds = new Set((existing || []).map((e: { registration_id: string }) => e.registration_id))

    // Filter out already-registered
    const newEntries = (registrations as { id: string }[])
      .filter((r) => !existingIds.has(r.id))
      .map((r) => ({
        meal_plan_id: id,
        registration_id: r.id,
        dietary_preference: "regular",
        status: "registered",
      }))

    if (newEntries.length === 0) {
      return NextResponse.json({ message: "All confirmed attendees are already registered", added: 0 })
    }

    const { error: insertError } = await db
      .from("meal_registrations")
      .insert(newEntries)

    if (insertError) {
      console.error("Error bulk registering:", insertError)
      return NextResponse.json({ error: "Failed to register attendees" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      added: newEntries.length,
      message: `${newEntries.length} attendees registered for this meal`,
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
