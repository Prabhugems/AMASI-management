import { createAdminClient } from "@/lib/supabase/server"
import { getApiUser } from "@/lib/auth/api-auth"
import { NextRequest, NextResponse } from "next/server"

// GET /api/events/[eventId]/abstracts/presenter-list
// Get list of accepted abstracts with their presenters for check-in
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    await getApiUser()
    const { eventId } = await params
    const { searchParams } = new URL(request.url)
    const dateFilter = searchParams.get("date") || "all"

    const supabase = await createAdminClient()

    // Build query for accepted abstracts
    let query = (supabase as any)
      .from("abstracts")
      .select(`
        id,
        abstract_number,
        title,
        presenting_author_name,
        presenting_author_email,
        accepted_as,
        session_date,
        session_time,
        session_location,
        registration_id,
        registration_verified,
        presenter_checked_in,
        presenter_checked_in_at,
        presentation_completed,
        presentation_completed_at
      `)
      .eq("event_id", eventId)
      .eq("status", "accepted")
      .order("session_date", { ascending: true })
      .order("session_time", { ascending: true })

    // Filter by date
    if (dateFilter === "today") {
      const today = new Date().toISOString().split('T')[0]
      query = query.eq("session_date", today)
    }

    const { data: abstracts, error } = await query

    if (error) {
      console.error("Error fetching presenter list:", error)
      return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 })
    }

    // Get registration details for verified abstracts
    const registrationIds = abstracts
      ?.filter(a => a.registration_id)
      .map(a => a.registration_id) || []

    let registrations: Record<string, { id: string; registration_number: string; checked_in: boolean }> = {}

    if (registrationIds.length > 0) {
      const { data: regData } = await (supabase as any)
        .from("registrations")
        .select("id, registration_number, checked_in")
        .in("id", registrationIds)

      regData?.forEach(r => {
        registrations[r.id] = r
      })
    }

    // Enrich abstracts with registration data
    const enrichedAbstracts = abstracts?.map(a => ({
      ...a,
      registration: a.registration_id ? registrations[a.registration_id] : null,
    })) || []

    // Calculate stats
    const stats = {
      total_presenters: enrichedAbstracts.length,
      checked_in: enrichedAbstracts.filter(a => a.presenter_checked_in).length,
      not_checked_in: enrichedAbstracts.filter(a => !a.presenter_checked_in).length,
      presentations_completed: enrichedAbstracts.filter(a => a.presentation_completed).length,
      not_registered: enrichedAbstracts.filter(a => !a.registration_verified).length,
    }

    return NextResponse.json({
      abstracts: enrichedAbstracts,
      stats,
    })
  } catch (error) {
    console.error("Error in presenter list:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
