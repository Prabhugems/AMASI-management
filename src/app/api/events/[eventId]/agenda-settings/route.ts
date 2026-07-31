import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

const patchSchema = z.object({
  enable_session_checkin: z.boolean().optional(),
  enable_session_registration: z.boolean().optional(),
  enable_capacity_limits: z.boolean().optional(),
  enable_feedback: z.boolean().optional(),
  enable_attendance_points: z.boolean().optional(),
  enable_certificates: z.boolean().optional(),
  enable_virtual_delivery: z.boolean().optional(),
  enable_public_programme: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const supabase = (await createAdminClient()) as any
  const { data, error } = await supabase
    .from("agenda_settings")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: "Failed to fetch agenda settings" }, { status: 500 })
  }

  return NextResponse.json({
    data: data ?? {
      event_id: eventId,
      enable_session_checkin: false,
      enable_session_registration: false,
      enable_capacity_limits: false,
      enable_feedback: false,
      enable_attendance_points: false,
      enable_certificates: false,
      enable_virtual_delivery: false,
      enable_public_programme: false,
    },
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 })
  }

  const supabase = (await createAdminClient()) as any
  const { data, error } = await supabase
    .from("agenda_settings")
    .upsert({ event_id: eventId, ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: "event_id" })
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to update agenda settings" }, { status: 500 })
  }

  return NextResponse.json({ data })
}
