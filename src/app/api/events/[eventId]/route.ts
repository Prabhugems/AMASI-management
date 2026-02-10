import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAccess } from "@/lib/auth/api-auth"

// GET /api/events/[eventId] - Get event details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params

    // Check authorization
    const { error: authError } = await requireEventAccess(eventId)
    if (authError) return authError

    const supabase = await createAdminClient()

    const { data: event, error } = await (supabase as any)
      .from("events")
      .select("*")
      .eq("id", eventId)
      .maybeSingle()

    if (error || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    return NextResponse.json(event)
  } catch (error: any) {
    console.error("Error in GET /api/events/[eventId]:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
