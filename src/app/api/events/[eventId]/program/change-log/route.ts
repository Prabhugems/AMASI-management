import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const { error: authError } = await requireEventAndPermission(eventId, 'program')
    if (authError) return authError
    const supabase = await createAdminClient()
    const db = supabase as any

    const { data, error } = await db
      .from("program_change_log")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) {
      console.error("Error fetching change log:", error)
      return NextResponse.json(
        { error: "Failed to fetch change log" },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error("Error in change-log:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
