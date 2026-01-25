import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// GET /api/events/[eventId]/tickets - Get ticket types for an event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const supabase = await createAdminClient()

    const { data: tickets, error } = await (supabase as any)
      .from("ticket_types")
      .select("id, name, price")
      .eq("event_id", eventId)
      .order("price", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(tickets || [])
  } catch (error: any) {
    console.error("Error in GET /api/events/[eventId]/tickets:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
