import { createServerSupabaseClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// POST - Switch ticket/course for a registration
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const { new_ticket_type_id, notes } = body

    if (!new_ticket_type_id) {
      return NextResponse.json(
        { error: "New ticket type ID is required" },
        { status: 400 }
      )
    }

    // Get current registration with ticket info
    const { data: currentReg, error: fetchError } = await (supabase as any)
      .from("registrations")
      .select(`
        *,
        ticket_type:ticket_types(id, name, price, event_id)
      `)
      .eq("id", id)
      .single()

    if (fetchError || !currentReg) {
      return NextResponse.json(
        { error: "Registration not found" },
        { status: 404 }
      )
    }

    // Can't switch if already checked in
    if (currentReg.checked_in) {
      return NextResponse.json(
        { error: "Cannot switch ticket for checked-in registration" },
        { status: 400 }
      )
    }

    // Get the new ticket type
    const { data: newTicket, error: ticketError } = await (supabase as any)
      .from("ticket_types")
      .select("id, name, price, event_id, quantity_total, quantity_sold, status, tax_percentage")
      .eq("id", new_ticket_type_id)
      .single()

    if (ticketError || !newTicket) {
      return NextResponse.json(
        { error: "New ticket type not found" },
        { status: 404 }
      )
    }

    // Verify same event
    if (newTicket.event_id !== currentReg.event_id) {
      return NextResponse.json(
        { error: "Cannot switch to ticket from different event" },
        { status: 400 }
      )
    }

    // Check ticket availability
    if (newTicket.status !== "active") {
      return NextResponse.json(
        { error: "New ticket is not available for sale" },
        { status: 400 }
      )
    }

    const availableQty = (newTicket.quantity_total || 0) - (newTicket.quantity_sold || 0)
    if (availableQty < (currentReg.quantity || 1)) {
      return NextResponse.json(
        { error: `Not enough tickets available. Only ${availableQty} left.` },
        { status: 400 }
      )
    }

    // Calculate new pricing
    const quantity = currentReg.quantity || 1
    const unitPrice = newTicket.price || 0
    const taxPercentage = newTicket.tax_percentage || 0
    const taxAmount = Math.round(unitPrice * quantity * taxPercentage / 100)
    const totalAmount = (unitPrice * quantity) + taxAmount

    const oldTicketId = currentReg.ticket_type_id
    const oldTicketName = currentReg.ticket_type?.name || "Unknown"
    const wasConfirmed = currentReg.status === "confirmed"

    // Update registration with new ticket
    const switchNote = `Switched from "${oldTicketName}" to "${newTicket.name}"${notes ? ` - ${notes}` : ""}`
    const existingNotes = currentReg.notes ? `${currentReg.notes}\n` : ""

    const { data: updatedReg, error: updateError } = await (supabase as any)
      .from("registrations")
      .update({
        ticket_type_id: new_ticket_type_id,
        unit_price: unitPrice,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        notes: existingNotes + `[${new Date().toLocaleDateString("en-IN")}] ${switchNote}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(`
        *,
        ticket_type:ticket_types(id, name, price)
      `)
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Update ticket inventory if registration was confirmed
    if (wasConfirmed && oldTicketId) {
      // Decrement old ticket's sold count
      const { data: oldTicket } = await (supabase as any)
        .from("ticket_types")
        .select("quantity_sold")
        .eq("id", oldTicketId)
        .single()

      if (oldTicket) {
        await (supabase as any)
          .from("ticket_types")
          .update({
            quantity_sold: Math.max(0, (oldTicket.quantity_sold || 0) - quantity)
          })
          .eq("id", oldTicketId)
      }

      // Increment new ticket's sold count
      await (supabase as any)
        .from("ticket_types")
        .update({
          quantity_sold: (newTicket.quantity_sold || 0) + quantity
        })
        .eq("id", new_ticket_type_id)
    }

    return NextResponse.json({
      success: true,
      data: updatedReg,
      message: `Successfully switched to ${newTicket.name}`,
      priceChange: {
        oldPrice: currentReg.total_amount,
        newPrice: totalAmount,
        difference: totalAmount - currentReg.total_amount,
      }
    })
  } catch (error: any) {
    console.error("Switch ticket error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
