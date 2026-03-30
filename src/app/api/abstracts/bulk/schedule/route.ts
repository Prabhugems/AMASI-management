import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

// POST /api/abstracts/bulk/schedule - Bulk assign abstracts to session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      abstract_ids,
      session_id,
      presentation_date,
      start_time,
      duration_minutes = 10,
      hall_name,
      room_number,
      auto_sequence = true,
    } = body

    if (!abstract_ids || !Array.isArray(abstract_ids) || abstract_ids.length === 0) {
      return NextResponse.json({ error: "No abstracts selected" }, { status: 400 })
    }

    if (!presentation_date || !start_time) {
      return NextResponse.json(
        { error: "Presentation date and start time are required" },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    // Get abstracts
    const { data: abstracts, error: fetchError } = await (supabase as any)
      .from("abstracts")
      .select("id, event_id, accepted_as, status, presenting_author_name, presenting_author_email, title")
      .in("id", abstract_ids)

    if (fetchError || !abstracts || abstracts.length === 0) {
      return NextResponse.json({ error: "Failed to fetch abstracts" }, { status: 500 })
    }

    // Check permission using the first abstract's event_id
    const { error: authError } = await requireEventAndPermission(abstracts[0].event_id, 'abstracts')
    if (authError) return authError

    // Filter to only accepted abstracts
    const acceptedAbstracts = abstracts.filter((a: any) => a.status === "accepted")
    if (acceptedAbstracts.length === 0) {
      return NextResponse.json(
        { error: "No accepted abstracts in selection" },
        { status: 400 }
      )
    }

    // Calculate time slots
    const slots: any[] = []
    let currentTime = start_time

    for (let i = 0; i < acceptedAbstracts.length; i++) {
      const abstract = acceptedAbstracts[i]
      const endTime = calculateEndTime(currentTime, duration_minutes)

      slots.push({
        abstract_id: abstract.id,
        event_id: abstract.event_id,
        session_id,
        presentation_type: abstract.accepted_as || "oral",
        presentation_date,
        start_time: currentTime,
        end_time: endTime,
        duration_minutes,
        hall_name,
        room_number,
        slot_order: i,
        is_confirmed: true,
        confirmed_at: new Date().toISOString(),
      })

      if (auto_sequence) {
        currentTime = endTime
      }
    }

    // Delete existing slots for these abstracts
    await (supabase as any)
      .from("abstract_presentation_slots")
      .delete()
      .in("abstract_id", abstract_ids)

    // Insert new slots
    const { error: insertError } = await (supabase as any)
      .from("abstract_presentation_slots")
      .insert(slots)

    if (insertError) {
      console.error("Error inserting slots:", insertError)
      return NextResponse.json({ error: "Failed to create schedule" }, { status: 500 })
    }

    // Update abstracts with session info
    for (const slot of slots) {
      await (supabase as any)
        .from("abstracts")
        .update({
          session_id,
          session_date: presentation_date,
          session_time: slot.start_time,
          session_location: hall_name ? `${hall_name}${room_number ? `, ${room_number}` : ""}` : room_number,
          workflow_stage: "ready",
          updated_at: new Date().toISOString(),
        })
        .eq("id", slot.abstract_id)
    }

    // Create notifications
    const notifications = acceptedAbstracts.map((abstract: any, i: number) => ({
      abstract_id: abstract.id,
      notification_type: "schedule_assigned",
      recipient_email: abstract.presenting_author_email,
      recipient_name: abstract.presenting_author_name,
      subject: `Your Presentation Schedule: ${abstract.title}`,
      metadata: {
        presentation_date,
        start_time: slots[i].start_time,
        end_time: slots[i].end_time,
        hall_name,
        room_number,
        presentation_type: abstract.accepted_as,
      },
    }))

    await (supabase as any)
      .from("abstract_notifications")
      .insert(notifications)

    return NextResponse.json({
      success: true,
      scheduled: acceptedAbstracts.length,
      slots,
    })
  } catch (error) {
    console.error("Error in bulk schedule:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(":").map(Number)
  const totalMinutes = hours * 60 + minutes + durationMinutes
  const endHours = Math.floor(totalMinutes / 60) % 24
  const endMinutes = totalMinutes % 60
  return `${endHours.toString().padStart(2, "0")}:${endMinutes.toString().padStart(2, "0")}`
}
