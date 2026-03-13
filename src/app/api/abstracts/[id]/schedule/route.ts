import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { NextRequest, NextResponse } from "next/server"

// POST /api/abstracts/[id]/schedule - Assign abstract to program schedule
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await request.json()

    const {
      session_id,
      presentation_date,
      start_time,
      end_time,
      duration_minutes = 10,
      hall_name,
      room_number,
      poster_board_number,
      poster_zone,
      slot_order,
      send_notification = true,
    } = body

    if (!presentation_date || !start_time) {
      return NextResponse.json(
        { error: "Presentation date and start time are required" },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    // Get abstract details
    const { data: abstract, error: fetchError } = await (supabase as any)
      .from("abstracts")
      .select("*, event_id, accepted_as, presenting_author_email, presenting_author_name, title")
      .eq("id", id)
      .single()

    if (fetchError || !abstract) {
      return NextResponse.json({ error: "Abstract not found" }, { status: 404 })
    }

    if (abstract.status !== 'accepted') {
      return NextResponse.json(
        { error: "Abstract must be accepted before scheduling" },
        { status: 400 }
      )
    }

    // Create or update presentation slot
    const slotData = {
      abstract_id: id,
      event_id: abstract.event_id,
      session_id,
      presentation_type: abstract.accepted_as || 'oral',
      presentation_date,
      start_time,
      end_time: end_time || calculateEndTime(start_time, duration_minutes),
      duration_minutes,
      hall_name,
      room_number,
      poster_board_number,
      poster_zone,
      slot_order: slot_order || 0,
      is_confirmed: true,
      confirmed_at: new Date().toISOString(),
    }

    // Check for existing slot
    const { data: existingSlot } = await (supabase as any)
      .from("abstract_presentation_slots")
      .select("id")
      .eq("abstract_id", id)
      .maybeSingle()

    let slotResult
    if (existingSlot) {
      // Update existing slot
      const { data, error } = await (supabase as any)
        .from("abstract_presentation_slots")
        .update(slotData)
        .eq("abstract_id", id)
        .select()
        .single()
      slotResult = { data, error }
    } else {
      // Insert new slot
      const { data, error } = await (supabase as any)
        .from("abstract_presentation_slots")
        .insert(slotData)
        .select()
        .single()
      slotResult = { data, error }
    }

    if (slotResult.error) {
      console.error("Error saving slot:", slotResult.error)
      return NextResponse.json({ error: "Failed to save schedule" }, { status: 500 })
    }

    // Update abstract with session info
    const { error: updateError } = await (supabase as any)
      .from("abstracts")
      .update({
        session_id,
        session_date: presentation_date,
        session_time: start_time,
        session_location: hall_name ? `${hall_name}${room_number ? `, ${room_number}` : ''}` : room_number,
        workflow_stage: 'ready',
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (updateError) {
      console.error("Error updating abstract:", updateError)
    }

    // Send notification to presenter
    if (send_notification) {
      await (supabase as any)
        .from("abstract_notifications")
        .insert({
          abstract_id: id,
          notification_type: 'schedule_assigned',
          recipient_email: abstract.presenting_author_email,
          recipient_name: abstract.presenting_author_name,
          subject: `Your Presentation Schedule: ${abstract.title}`,
          metadata: {
            presentation_date,
            start_time,
            end_time: slotData.end_time,
            hall_name,
            room_number,
            presentation_type: abstract.accepted_as,
          },
        })

      // Mark email sent
      await (supabase as any)
        .from("abstracts")
        .update({
          schedule_email_sent: true,
          schedule_email_sent_at: new Date().toISOString(),
        })
        .eq("id", id)
    }

    return NextResponse.json({
      success: true,
      slot: slotResult.data,
      abstract_updated: !updateError,
    })
  } catch (error) {
    console.error("Error in schedule assignment:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/abstracts/[id]/schedule - Get schedule details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = await createAdminClient()

    const { data: slot, error } = await (supabase as any)
      .from("abstract_presentation_slots")
      .select(`
        *,
        session:sessions(id, title, start_time, end_time, location)
      `)
      .eq("abstract_id", id)
      .maybeSingle()

    if (error) {
      console.error("Error fetching schedule:", error)
      return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 })
    }

    return NextResponse.json({ slot })
  } catch (error) {
    console.error("Error in GET schedule:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/abstracts/[id]/schedule - Remove from schedule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    const supabase = await createAdminClient()

    const { error } = await (supabase as any)
      .from("abstract_presentation_slots")
      .delete()
      .eq("abstract_id", id)

    if (error) {
      console.error("Error deleting slot:", error)
      return NextResponse.json({ error: "Failed to remove schedule" }, { status: 500 })
    }

    // Update abstract workflow stage
    await (supabase as any)
      .from("abstracts")
      .update({
        session_id: null,
        session_date: null,
        session_time: null,
        session_location: null,
        workflow_stage: 'scheduling',
      })
      .eq("id", id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE schedule:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Helper function to calculate end time
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number)
  const totalMinutes = hours * 60 + minutes + durationMinutes
  const endHours = Math.floor(totalMinutes / 60) % 24
  const endMinutes = totalMinutes % 60
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`
}
