import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// GET /api/program/[eventId] - Get published program for an event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params

    const supabase = await createAdminClient()

    // Get event details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: event, error: eventError } = await (supabase as any)
      .from("events")
      .select("id, name, short_name, start_date, end_date, venue, city")
      .eq("id", eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Check if program is published
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: settings } = await (supabase as any)
      .from("abstract_settings")
      .select("program_published, program_published_at")
      .eq("event_id", eventId)
      .single()

    // Allow access if program is published or for testing/preview
    const isPublished = settings?.program_published ?? false
    const previewMode = request.nextUrl.searchParams.get("preview") === "true"

    if (!isPublished && !previewMode) {
      return NextResponse.json({
        event,
        abstracts: [],
        message: "Program not yet published",
      })
    }

    // Get accepted abstracts with their presentation slots
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: abstracts, error: abstractsError } = await (supabase as any)
      .from("abstracts")
      .select(`
        id,
        abstract_number,
        title,
        presenting_author_name,
        presenting_author_affiliation,
        presentation_type,
        award_type,
        accepted_as,
        category:abstract_categories(name),
        slot:abstract_presentation_slots(
          presentation_date,
          start_time,
          hall_name,
          slot_order
        )
      `)
      .eq("event_id", eventId)
      .eq("status", "accepted")

    if (abstractsError) {
      console.error("Error fetching abstracts:", abstractsError)
      return NextResponse.json({ error: "Failed to fetch program" }, { status: 500 })
    }

    // Transform abstracts to flatten slot data and filter to only scheduled ones
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scheduledAbstracts = (abstracts || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((a: any) => a.slot && a.slot.length > 0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((a: any) => {
        const slot = a.slot[0] // Get first slot (primary)
        return {
          id: a.id,
          abstract_number: a.abstract_number,
          title: a.title,
          presenting_author_name: a.presenting_author_name,
          presenting_author_affiliation: a.presenting_author_affiliation,
          presentation_type: a.presentation_type,
          award_type: a.award_type,
          accepted_as: a.accepted_as,
          category: a.category,
          // Flatten slot data with expected field names
          scheduled_date: slot?.presentation_date || null,
          scheduled_time: slot?.start_time || null,
          scheduled_hall: slot?.hall_name || null,
          schedule_order: slot?.slot_order || null,
        }
      })
      // Sort by date, time, then order
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => {
        if (a.scheduled_date !== b.scheduled_date) {
          return (a.scheduled_date || "").localeCompare(b.scheduled_date || "")
        }
        if (a.scheduled_time !== b.scheduled_time) {
          return (a.scheduled_time || "").localeCompare(b.scheduled_time || "")
        }
        return (a.schedule_order || 0) - (b.schedule_order || 0)
      })

    return NextResponse.json({
      event,
      abstracts: scheduledAbstracts,
      is_published: isPublished,
      published_at: settings?.program_published_at,
    })
  } catch (error) {
    console.error("Error fetching program:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
