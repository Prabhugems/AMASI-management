import { createServerSupabaseClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// GET - Get single registration
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()

    const { data, error } = await (supabase as any)
      .from("registrations")
      .select(`
        *,
        ticket_type:ticket_types(id, name, price, description),
        event:events(id, name, short_name, start_date, end_date, venue_name, city)
      `)
      .eq("id", id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - Update registration
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    // First, get the current registration to check status change
    const { data: currentReg, error: fetchError } = await (supabase as any)
      .from("registrations")
      .select("status, ticket_type_id, quantity")
      .eq("id", id)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const allowedFields = [
      "status",
      "payment_status",
      "checked_in",
      "checked_in_at",
      "attendee_name",
      "attendee_email",
      "attendee_phone",
      "attendee_institution",
      "attendee_designation",
      "notes",
    ]

    const updateData: any = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Auto-set checked_in_at when checking in
    if (body.checked_in === true && !body.checked_in_at) {
      updateData.checked_in_at = new Date().toISOString()
    }

    // Auto-set confirmed_at when confirming
    if (body.status === "confirmed" && currentReg.status !== "confirmed") {
      updateData.confirmed_at = new Date().toISOString()
    }

    const { data, error } = await (supabase as any)
      .from("registrations")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If status changed to "confirmed", update ticket quantity_sold
    if (body.status === "confirmed" && currentReg.status !== "confirmed" && currentReg.ticket_type_id) {
      // Get current ticket to update sold count
      const { data: ticket } = await (supabase as any)
        .from("ticket_types")
        .select("quantity_sold, quantity_total")
        .eq("id", currentReg.ticket_type_id)
        .single()

      if (ticket) {
        await (supabase as any)
          .from("ticket_types")
          .update({ quantity_sold: (ticket.quantity_sold || 0) + (currentReg.quantity || 1) })
          .eq("id", currentReg.ticket_type_id)
      }
    }

    // If status changed FROM "confirmed" to cancelled/refunded, decrement ticket count
    if (currentReg.status === "confirmed" &&
        (body.status === "cancelled" || body.status === "refunded") &&
        currentReg.ticket_type_id) {
      const { data: ticket } = await (supabase as any)
        .from("ticket_types")
        .select("quantity_sold")
        .eq("id", currentReg.ticket_type_id)
        .single()

      if (ticket) {
        await (supabase as any)
          .from("ticket_types")
          .update({ quantity_sold: Math.max(0, (ticket.quantity_sold || 0) - (currentReg.quantity || 1)) })
          .eq("id", currentReg.ticket_type_id)
      }
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete registration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()

    const { error } = await (supabase as any)
      .from("registrations")
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
