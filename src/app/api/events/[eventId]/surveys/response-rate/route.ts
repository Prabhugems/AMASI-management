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

    // Total confirmed attendees
    const { count: totalAttendees } = await supabase
      .from("registrations")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "confirmed")

    // Get survey forms for this event
    const { data: surveys } = await db
      .from("forms")
      .select("id, title")
      .eq("event_id", eventId)
      .in("form_type", ["survey", "feedback"])

    // Get submission counts per survey
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rates = await Promise.all((surveys || []).map(async (survey: any) => {
      const { count } = await db
        .from("form_submissions")
        .select("*", { count: "exact", head: true })
        .eq("form_id", survey.id)

      const submissions = count || 0
      const total = totalAttendees || 0
      const rate = total > 0 ? Math.round((submissions / total) * 100) : 0

      return {
        form_id: survey.id,
        title: survey.title,
        submissions,
        totalAttendees: total,
        responseRate: rate,
      }
    }))

    return NextResponse.json({
      totalAttendees: totalAttendees || 0,
      surveys: rates,
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
