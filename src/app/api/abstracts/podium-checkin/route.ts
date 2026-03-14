import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// POST /api/abstracts/podium-checkin - Scan badge to mark presenter as presented
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      scan_data, // Can be abstract_number, registration_number, or email
      hall_token, // Hall coordinator token for authorization
      hall_name,
      notes,
    } = body

    if (!scan_data) {
      return NextResponse.json({ error: "Scan data is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Verify hall coordinator token if provided
    let coordinatorInfo = null
    if (hall_token) {
      const { data: coordinator } = await (supabase as any)
        .from("hall_coordinators")
        .select("id, hall_name, coordinator_name, event_id")
        .eq("portal_token", hall_token)
        .single()

      if (coordinator) {
        coordinatorInfo = coordinator
      }
    }

    // Try to find the abstract by various identifiers
    let abstract = null
    const searchValue = scan_data.trim()

    // 1. Try by abstract_number
    const { data: byNumber } = await (supabase as any)
      .from("abstracts")
      .select(`
        id, abstract_number, title, status, accepted_as,
        presenting_author_name, presenting_author_email,
        presenting_author_affiliation, event_id,
        session_date, session_time, session_location,
        presenter_checked_in, presentation_completed,
        presentation_completed_at,
        events(name, short_name)
      `)
      .eq("abstract_number", searchValue)
      .maybeSingle()

    if (byNumber) {
      abstract = byNumber
    }

    // 2. Try by registration number (via badge)
    if (!abstract) {
      const { data: registration } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_email, event_id")
        .eq("registration_number", searchValue)
        .maybeSingle()

      if (registration) {
        const { data: byEmail } = await (supabase as any)
          .from("abstracts")
          .select(`
            id, abstract_number, title, status, accepted_as,
            presenting_author_name, presenting_author_email,
            presenting_author_affiliation, event_id,
            session_date, session_time, session_location,
            presenter_checked_in, presentation_completed,
            presentation_completed_at,
            events(name, short_name)
          `)
          .eq("event_id", registration.event_id)
          .ilike("presenting_author_email", registration.attendee_email)
          .eq("status", "accepted")
          .maybeSingle()

        if (byEmail) {
          abstract = byEmail
        }
      }
    }

    // 3. Try by email directly
    if (!abstract) {
      const { data: byEmail } = await (supabase as any)
        .from("abstracts")
        .select(`
          id, abstract_number, title, status, accepted_as,
          presenting_author_name, presenting_author_email,
          presenting_author_affiliation, event_id,
          session_date, session_time, session_location,
          presenter_checked_in, presentation_completed,
          presentation_completed_at,
          events(name, short_name)
        `)
        .ilike("presenting_author_email", searchValue)
        .eq("status", "accepted")
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (byEmail) {
        abstract = byEmail
      }
    }

    if (!abstract) {
      return NextResponse.json({
        error: "Presenter not found",
        message: "No accepted abstract found for this badge/scan",
      }, { status: 404 })
    }

    if (abstract.status !== "accepted") {
      return NextResponse.json({
        error: "Abstract not accepted",
        message: `This abstract status is: ${abstract.status}`,
        abstract: {
          number: abstract.abstract_number,
          title: abstract.title,
          status: abstract.status,
        },
      }, { status: 400 })
    }

    // Check if already presented
    if (abstract.presentation_completed) {
      return NextResponse.json({
        already_presented: true,
        message: `${abstract.presenting_author_name} already presented`,
        abstract: {
          number: abstract.abstract_number,
          title: abstract.title,
          presenter: abstract.presenting_author_name,
          presented_at: abstract.presentation_completed_at,
        },
      })
    }

    // Mark as presented
    const presentedAt = new Date().toISOString()
    const { error: updateError } = await (supabase as any)
      .from("abstracts")
      .update({
        presentation_completed: true,
        presentation_completed_at: presentedAt,
        presenter_checked_in: true,
        presenter_checked_in_at: abstract.presenter_checked_in ? undefined : presentedAt,
        podium_checkin_hall: hall_name || coordinatorInfo?.hall_name,
        podium_checkin_by: coordinatorInfo?.coordinator_name,
        podium_checkin_notes: notes,
      })
      .eq("id", abstract.id)

    if (updateError) {
      console.error("Error updating abstract:", updateError)
      return NextResponse.json({ error: "Failed to record presentation" }, { status: 500 })
    }

    // Record in checkins table
    await (supabase as any)
      .from("abstract_presenter_checkins")
      .insert({
        abstract_id: abstract.id,
        event_id: abstract.event_id,
        presenter_email: abstract.presenting_author_email,
        presenter_name: abstract.presenting_author_name,
        check_in_location: hall_name || coordinatorInfo?.hall_name || "Podium",
        presentation_started_at: presentedAt,
        presentation_ended_at: presentedAt,
        notes: notes || "Podium check-in via QR scan",
      })

    return NextResponse.json({
      success: true,
      message: `${abstract.presenting_author_name} marked as presented`,
      abstract: {
        id: abstract.id,
        number: abstract.abstract_number,
        title: abstract.title,
        presenter: abstract.presenting_author_name,
        affiliation: abstract.presenting_author_affiliation,
        presentation_type: abstract.accepted_as,
        presented_at: presentedAt,
        event: abstract.events?.name || abstract.events?.short_name,
      },
    })
  } catch (error) {
    console.error("Error in podium check-in:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/abstracts/podium-checkin?event_id=...&hall=... - Get presenters for a hall/session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")
    const sessionDate = searchParams.get("date") || new Date().toISOString().split("T")[0]
    const hall = searchParams.get("hall")

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Get today's scheduled presenters
    let query = (supabase as any)
      .from("abstracts")
      .select(`
        id,
        abstract_number,
        title,
        presenting_author_name,
        presenting_author_email,
        presenting_author_affiliation,
        accepted_as,
        session_date,
        session_time,
        session_location,
        presenter_checked_in,
        presentation_completed,
        presentation_completed_at
      `)
      .eq("event_id", eventId)
      .eq("status", "accepted")
      .order("session_time", { ascending: true })

    if (sessionDate) {
      query = query.eq("session_date", sessionDate)
    }

    if (hall) {
      query = query.ilike("session_location", `%${hall}%`)
    }

    const { data: abstracts, error } = await query

    if (error) {
      console.error("Error fetching abstracts:", error)
      return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
    }

    // Stats
    const total = abstracts?.length || 0
    const presented = abstracts?.filter((a: any) => a.presentation_completed).length || 0
    const pending = total - presented

    return NextResponse.json({
      abstracts: abstracts || [],
      stats: {
        total,
        presented,
        pending,
      },
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
