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

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    let query = db
      .from("waitlist")
      .select("*, ticket_types(id, name)")
      .eq("event_id", eventId)
      .order("position", { ascending: true })

    if (status) {
      query = query.eq("status", status)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching waitlist:", error)
      return NextResponse.json({ error: "Failed to fetch waitlist" }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
