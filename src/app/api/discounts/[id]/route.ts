import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

async function lookupEventId(id: string): Promise<string | null> {
  const client = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = client as any
  const { data } = await supabase
    .from("discount_codes")
    .select("event_id")
    .eq("id", id)
    .maybeSingle()
  return data?.event_id ?? null
}

// PATCH - update a discount code (toggle active, change limits, etc.)
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const eventId = await lookupEventId(id)
    if (!eventId) {
      return NextResponse.json({ error: "Discount code not found" }, { status: 404 })
    }

    const { error: authError } = await requireEventAndPermission(eventId, "registrations")
    if (authError) return authError

    const body = await request.json()
    const allowed = [
      "code",
      "description",
      "discount_type",
      "discount_value",
      "max_uses",
      "min_order_amount",
      "max_discount_amount",
      "valid_from",
      "valid_until",
      "is_active",
      "applies_to_ticket_ids",
    ] as const
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (key in body) patch[key] = body[key]
    }
    if (typeof patch.code === "string") {
      patch.code = (patch.code as string).toUpperCase()
    }

    const client = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = client as any
    const { data, error } = await supabase
      .from("discount_codes")
      .update(patch)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Another code with the same name already exists for this event" },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: "Failed to update discount" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ error: "Failed to update discount" }, { status: 500 })
  }
}

// DELETE - remove a discount code
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const eventId = await lookupEventId(id)
    if (!eventId) {
      return NextResponse.json({ error: "Discount code not found" }, { status: 404 })
    }

    const { error: authError } = await requireEventAndPermission(eventId, "registrations")
    if (authError) return authError

    const client = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = client as any
    const { error } = await supabase
      .from("discount_codes")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: "Failed to delete discount" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete discount" }, { status: 500 })
  }
}
