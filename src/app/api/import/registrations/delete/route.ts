import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"

// POST /api/import/registrations/delete - Delete imported registrations
export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const body = await request.json()
    const { event_id, created_after } = body

    if (!event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Get event short_name to find imported registrations by prefix pattern
    const { data: event } = await (supabase as any)
      .from("events")
      .select("short_name")
      .eq("id", event_id)
      .single()

    const prefix = event?.short_name || "REG"

    // Delete registrations matching the import pattern: {prefix}A{digits}
    let query = (supabase as any)
      .from("registrations")
      .delete()
      .eq("event_id", event_id)
      .like("registration_number", `${prefix}A%`)

    // If created_after is provided, only delete registrations created after that time
    if (created_after) {
      query = query.gte("created_at", created_after)
    }

    const { data, error } = await query.select("id")

    if (error) {
      return NextResponse.json({ error: "Failed to delete registrations" }, { status: 500 })
    }

    return NextResponse.json({ deleted: data?.length || 0 })
  } catch (error: any) {
    console.error("Error deleting imported registrations:", error)
    return NextResponse.json({ error: "Failed to delete registrations" }, { status: 500 })
  }
}
