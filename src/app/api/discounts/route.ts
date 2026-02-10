import { createServerSupabaseClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { requireEventAccess } from "@/lib/auth/api-auth"

// GET - List discount codes for an event (requires event access)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return NextResponse.json(
        { error: "event_id is required" },
        { status: 400 }
      )
    }

    // Check authorization
    const { error: authError } = await requireEventAccess(eventId)
    if (authError) return authError

    const supabase = await createServerSupabaseClient()

    const { data, error } = await (supabase as any)
      .from("discount_codes")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: "Failed to process discount request" }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to process discount request" }, { status: 500 })
  }
}

// POST - Create new discount code (requires event access)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      event_id,
      code,
      description,
      discount_type = "percentage",
      discount_value,
      max_uses,
      min_order_amount,
      max_discount_amount,
      valid_from,
      valid_until,
      is_active = true,
      applies_to_ticket_ids,
    } = body

    if (!event_id || !code || discount_value === undefined) {
      return NextResponse.json(
        { error: "event_id, code, and discount_value are required" },
        { status: 400 }
      )
    }

    // Check authorization
    const { error: authError } = await requireEventAccess(event_id)
    if (authError) return authError

    const supabase = await createServerSupabaseClient()

    const { data, error } = await (supabase as any)
      .from("discount_codes")
      .insert({
        event_id,
        code: code.toUpperCase(),
        description,
        discount_type,
        discount_value,
        max_uses,
        min_order_amount,
        max_discount_amount,
        valid_from,
        valid_until,
        is_active,
        applies_to_ticket_ids,
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A discount code with this name already exists for this event" },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: "Failed to process discount request" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to process discount request" }, { status: 500 })
  }
}
