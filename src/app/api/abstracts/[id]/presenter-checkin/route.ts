import { createAdminClient } from "@/lib/supabase/server"
import { getApiUser } from "@/lib/auth/api-auth"
import { NextRequest, NextResponse } from "next/server"

// POST /api/abstracts/[id]/presenter-checkin - Check-in presenter on conference day
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getApiUser()
    const { id } = await params
    const body = await request.json()

    const {
      check_in_location,
      notes,
    } = body

    const supabase = await createAdminClient()

    // Get abstract details
    const { data: abstract, error: fetchError } = await supabase
      .from("abstracts")
      .select(`
        *,
        event_id,
        presenting_author_email,
        presenting_author_name,
        registration_id,
        registration_verified
      `)
      .eq("id", id)
      .single()

    if (fetchError || !abstract) {
      return NextResponse.json({ error: "Abstract not found" }, { status: 404 })
    }

    if (abstract.status !== 'accepted') {
      return NextResponse.json(
        { error: "Abstract is not accepted" },
        { status: 400 }
      )
    }

    // Verify registration if not already done
    let registrationId = abstract.registration_id
    if (!abstract.registration_verified) {
      const { data: registration } = await supabase
        .from("registrations")
        .select("id, registration_number, status, checked_in")
        .eq("event_id", abstract.event_id)
        .ilike("attendee_email", abstract.presenting_author_email)
        .maybeSingle()

      if (!registration || registration.status !== 'confirmed') {
        return NextResponse.json({
          error: "Presenter is not registered for this event",
          registration_status: registration?.status || 'not_found',
        }, { status: 400 })
      }

      registrationId = registration.id
    }

    // Record check-in
    const { data: checkin, error: checkinError } = await supabase
      .from("abstract_presenter_checkins")
      .insert({
        abstract_id: id,
        event_id: abstract.event_id,
        presenter_email: abstract.presenting_author_email,
        presenter_name: abstract.presenting_author_name,
        registration_id: registrationId,
        checked_in_by: user?.id,
        check_in_location,
        notes,
      })
      .select()
      .single()

    if (checkinError) {
      console.error("Error recording check-in:", checkinError)
      return NextResponse.json({ error: "Failed to record check-in" }, { status: 500 })
    }

    // Update abstract
    const { error: updateError } = await supabase
      .from("abstracts")
      .update({
        presenter_checked_in: true,
        presenter_checked_in_at: new Date().toISOString(),
        registration_id: registrationId,
        registration_verified: true,
        registration_verified_at: abstract.registration_verified ? abstract.registration_verified_at : new Date().toISOString(),
      })
      .eq("id", id)

    if (updateError) {
      console.error("Error updating abstract:", updateError)
    }

    // Also check-in the registration if not already
    if (registrationId) {
      await supabase
        .from("registrations")
        .update({
          checked_in: true,
          checked_in_at: new Date().toISOString(),
          checked_in_by: user?.id,
        })
        .eq("id", registrationId)
        .eq("checked_in", false) // Only if not already checked in
    }

    return NextResponse.json({
      success: true,
      checkin,
      message: `Presenter ${abstract.presenting_author_name} checked in successfully`,
    })
  } catch (error) {
    console.error("Error in presenter check-in:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/abstracts/[id]/presenter-checkin - Mark presentation as started/completed
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getApiUser()
    const { id } = await params
    const body = await request.json()

    const { action, notes } = body // action: 'start' or 'complete'

    if (!action || !['start', 'complete'].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Get check-in record
    const { data: checkin, error: fetchError } = await supabase
      .from("abstract_presenter_checkins")
      .select("*")
      .eq("abstract_id", id)
      .order("checked_in_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError || !checkin) {
      return NextResponse.json({ error: "Presenter not checked in" }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}

    if (action === 'start') {
      updateData.presentation_started_at = new Date().toISOString()
    } else if (action === 'complete') {
      updateData.presentation_ended_at = new Date().toISOString()
      if (notes) updateData.notes = checkin.notes ? `${checkin.notes}\n${notes}` : notes
    }

    // Update check-in record
    const { error: updateCheckinError } = await supabase
      .from("abstract_presenter_checkins")
      .update(updateData)
      .eq("id", checkin.id)

    if (updateCheckinError) {
      console.error("Error updating check-in:", updateCheckinError)
    }

    // Update abstract if completed
    if (action === 'complete') {
      await supabase
        .from("abstracts")
        .update({
          presentation_completed: true,
          presentation_completed_at: new Date().toISOString(),
        })
        .eq("id", id)
    }

    return NextResponse.json({
      success: true,
      action,
      message: action === 'start' ? 'Presentation started' : 'Presentation completed',
    })
  } catch (error) {
    console.error("Error updating presentation status:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/abstracts/[id]/presenter-checkin - Get check-in status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = await createAdminClient()

    // Get abstract with check-in info
    const { data: abstract, error: fetchError } = await supabase
      .from("abstracts")
      .select(`
        id,
        title,
        presenting_author_name,
        presenting_author_email,
        registration_id,
        registration_verified,
        presenter_checked_in,
        presenter_checked_in_at,
        presentation_completed,
        presentation_completed_at,
        status,
        accepted_as,
        session_date,
        session_time,
        session_location
      `)
      .eq("id", id)
      .single()

    if (fetchError || !abstract) {
      return NextResponse.json({ error: "Abstract not found" }, { status: 404 })
    }

    // Get check-in records
    const { data: checkins } = await supabase
      .from("abstract_presenter_checkins")
      .select("*")
      .eq("abstract_id", id)
      .order("checked_in_at", { ascending: false })

    // Get registration details if available
    let registration = null
    if (abstract.registration_id) {
      const { data: reg } = await supabase
        .from("registrations")
        .select("id, registration_number, attendee_name, status, checked_in, checked_in_at")
        .eq("id", abstract.registration_id)
        .single()
      registration = reg
    }

    return NextResponse.json({
      abstract: {
        id: abstract.id,
        title: abstract.title,
        presenter_name: abstract.presenting_author_name,
        presenter_email: abstract.presenting_author_email,
        status: abstract.status,
        accepted_as: abstract.accepted_as,
        schedule: {
          date: abstract.session_date,
          time: abstract.session_time,
          location: abstract.session_location,
        },
      },
      registration,
      checkin_status: {
        is_checked_in: abstract.presenter_checked_in,
        checked_in_at: abstract.presenter_checked_in_at,
        presentation_completed: abstract.presentation_completed,
        completed_at: abstract.presentation_completed_at,
      },
      checkin_history: checkins,
    })
  } catch (error) {
    console.error("Error fetching check-in status:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
