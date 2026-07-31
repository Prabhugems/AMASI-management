import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

const createSchema = z.object({
  name: z.string().min(1),
  capacity: z.number().int().positive().nullable().optional(),
  floor: z.string().nullable().optional(),
  display_order: z.number().int().optional(),
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
    .from("halls")
    .select("*")
    .eq("event_id", eventId)
    .order("display_order")

  if (error) return NextResponse.json({ error: "Failed to fetch halls" }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const { error: authError } = await requireEventAndPermission(eventId, "program")
  if (authError) return authError

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 })
  }

  const supabase = (await createAdminClient()) as any
  const { data, error } = await supabase
    .from("halls")
    .insert({ event_id: eventId, ...parsed.data })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: "Failed to create hall" }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
