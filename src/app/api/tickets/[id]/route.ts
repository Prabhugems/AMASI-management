import { createServerSupabaseClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// GET - Get single ticket type
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()

    const { data, error } = await (supabase as any)
      .from("ticket_types")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - Update ticket type
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const allowedFields = [
      "name",
      "description",
      "price",
      "quantity_total",
      "min_per_order",
      "max_per_order",
      "sale_start_date",
      "sale_end_date",
      "status",
      "is_hidden",
      "requires_approval",
      "tax_percentage",
      "sort_order",
    ]

    const updateData: any = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const { data, error } = await (supabase as any)
      .from("ticket_types")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete ticket type
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()

    // Check if there are any registrations for this ticket
    const { count } = await (supabase as any)
      .from("registrations")
      .select("*", { count: "exact", head: true })
      .eq("ticket_type_id", id)

    if (count && count > 0) {
      return NextResponse.json(
        { error: "Cannot delete ticket with existing registrations" },
        { status: 400 }
      )
    }

    const { error } = await (supabase as any)
      .from("ticket_types")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
