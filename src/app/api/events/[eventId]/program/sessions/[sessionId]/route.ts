import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { computeSessionCheckinWindow } from "@/lib/agenda-session-checkin-window"

const patchSchema = z.object({
  session_name: z.string().min(1).optional(),
  session_date: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  hall_id: z.string().uuid().nullable().optional(),
  track_id: z.string().uuid().nullable().optional(),
  checkin_enabled: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; sessionId: string }> }
) {
  const { eventId, sessionId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 })
  }

  const supabase = (await createAdminClient()) as any

  const { data: session, error: updateError } = await supabase
    .from("sessions")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("event_id", eventId)
    .select("id, session_date, start_time, end_time, checkin_enabled")
    .single()

  if (updateError || !session) {
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 })
  }

  if (session.checkin_enabled && session.session_date && session.start_time && session.end_time) {
    const { data: event, error: eventError } = await supabase.from("events").select("timezone, end_date").eq("id", eventId).single()
    if (eventError) {
      return NextResponse.json({ error: "Session updated, but failed to look up event timezone for check-in provisioning" }, { status: 500 })
    }
    const timezone = event?.timezone ?? "Asia/Kolkata"

    const { opensAt, closesAt } = computeSessionCheckinWindow(
      { session_date: session.session_date, start_time: session.start_time, end_time: session.end_time },
      timezone
    )

    const { data: existingList, error: existingListError } = await supabase
      .from("checkin_lists")
      .select("id")
      .eq("session_id", sessionId)
      .maybeSingle()
    if (existingListError) {
      return NextResponse.json({ error: "Session updated, but failed to check for an existing check-in list" }, { status: 500 })
    }

    if (existingList) {
      const { error: updateListError } = await supabase
        .from("checkin_lists")
        .update({ kiosk_opens_at: opensAt, kiosk_closes_at: closesAt, kiosk_force_state: null, updated_at: new Date().toISOString() })
        .eq("id", existingList.id)
      if (updateListError) {
        return NextResponse.json({ error: "Session updated, but failed to update its check-in list" }, { status: 500 })
      }
    } else {
      const accessTokenExpiresAt = new Date(
        event?.end_date ? new Date(event.end_date).getTime() + 2 * 864e5 : Date.now() + 30 * 864e5
      ).toISOString()

      const { error: insertListError } = await supabase.from("checkin_lists").insert({
        event_id: eventId,
        session_id: sessionId,
        name: `Session check-in — ${sessionId}`,
        list_purpose: "session",
        kiosk_opens_at: opensAt,
        kiosk_closes_at: closesAt,
        allow_multiple_checkins: false,
        access_token_expires_at: accessTokenExpiresAt,
        is_active: true,
      })
      if (insertListError) {
        return NextResponse.json({ error: "Session updated, but failed to create its check-in list" }, { status: 500 })
      }
    }
  } else if (!session.checkin_enabled) {
    const { data: existingList, error: existingListError } = await supabase
      .from("checkin_lists")
      .select("id")
      .eq("session_id", sessionId)
      .maybeSingle()
    if (existingListError) {
      return NextResponse.json({ error: "Session updated, but failed to check for an existing check-in list to close" }, { status: 500 })
    }
    if (existingList) {
      const { error: closeError } = await supabase
        .from("checkin_lists")
        .update({ kiosk_force_state: "closed", updated_at: new Date().toISOString() })
        .eq("id", existingList.id)
      if (closeError) {
        return NextResponse.json({ error: "Session updated, but failed to close its check-in list" }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ data: session })
}
