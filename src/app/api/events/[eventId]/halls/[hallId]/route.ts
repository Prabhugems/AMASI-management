import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  capacity: z.number().int().positive().nullable().optional(),
  floor: z.string().nullable().optional(),
  display_order: z.number().int().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; hallId: string }> }
) {
  const { eventId, hallId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 })
  }

  const supabase = (await createAdminClient()) as any
  const { data, error } = await supabase
    .from("halls")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", hallId)
    .eq("event_id", eventId)
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: "Failed to update hall" }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; hallId: string }> }
) {
  const { eventId, hallId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const supabase = (await createAdminClient()) as any
  const { error } = await supabase.from("halls").delete().eq("id", hallId).eq("event_id", eventId)

  if (error) return NextResponse.json({ error: "Failed to delete hall" }, { status: 500 })
  return NextResponse.json({ success: true })
}
