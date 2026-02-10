import { createServerSupabaseClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// POST - Transfer registration to another event
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const { new_event_id, new_ticket_type_id, notes } = body

    if (!new_event_id) {
      return NextResponse.json(
        { error: "New event ID is required" },
        { status: 400 }
      )
    }

    if (!new_ticket_type_id) {
      return NextResponse.json(
        { error: "New ticket type ID is required" },
        { status: 400 }
      )
    }

    // Get current registration with event and ticket info
    const { data: currentReg, error: fetchError } = await (supabase as any)
      .from("registrations")
      .select(`
        *,
        ticket_type:ticket_types(id, name, price, event_id),
        event:events(id, name, short_name)
      `)
      .eq("id", id)
      .single()

    if (fetchError || !currentReg) {
      return NextResponse.json(
        { error: "Registration not found" },
        { status: 404 }
      )
    }

    // Can't transfer if already checked in
    if (currentReg.checked_in) {
      return NextResponse.json(
        { error: "Cannot transfer checked-in registration" },
        { status: 400 }
      )
    }

    // Get the new event
    const { data: newEvent, error: eventError } = await (supabase as any)
      .from("events")
      .select("id, name, short_name")
      .eq("id", new_event_id)
      .single()

    if (eventError || !newEvent) {
      return NextResponse.json(
        { error: "New event not found" },
        { status: 404 }
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

    // Verify ticket belongs to the new event
    if (newTicket.event_id !== new_event_id) {
      return NextResponse.json(
        { error: "Ticket does not belong to the selected event" },
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

    // Generate new registration number for the new event
    const { data: lastReg } = await (supabase as any)
      .from("registrations")
      .select("registration_number")
      .eq("event_id", new_event_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    let nextNumber = 1
    if (lastReg?.registration_number) {
      const match = lastReg.registration_number.match(/(\d+)$/)
      if (match) nextNumber = parseInt(match[1]) + 1
    }

    const eventPrefix = newEvent.short_name || newEvent.name?.substring(0, 4).toUpperCase() || "EVT"
    const newRegNumber = `${eventPrefix}-${String(nextNumber).padStart(4, "0")}`

    // Calculate new pricing
    const quantity = currentReg.quantity || 1
    const unitPrice = newTicket.price || 0
    const taxPercentage = newTicket.tax_percentage || 0
    const taxAmount = Math.round(unitPrice * quantity * taxPercentage / 100)
    const totalAmount = (unitPrice * quantity) + taxAmount

    const oldEventName = currentReg.event?.name || "Unknown Event"
    const oldTicketName = currentReg.ticket_type?.name || "Unknown"
    const wasConfirmed = currentReg.status === "confirmed"
    const oldTicketId = currentReg.ticket_type_id
    const oldEventId = currentReg.event_id

    // Update registration with new event and ticket
    const transferNote = `Transferred from "${oldEventName}" (${oldTicketName}) to "${newEvent.name}" (${newTicket.name})${notes ? ` - ${notes}` : ""}`
    const existingNotes = currentReg.notes ? `${currentReg.notes}\n` : ""

    const { data: updatedReg, error: updateError } = await (supabase as any)
      .from("registrations")
      .update({
        event_id: new_event_id,
        ticket_type_id: new_ticket_type_id,
        registration_number: newRegNumber,
        unit_price: unitPrice,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        notes: existingNotes + `[${new Date().toLocaleDateString("en-IN")}] ${transferNote}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(`
        *,
        ticket_type:ticket_types(id, name, price),
        event:events(id, name)
      `)
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Update ticket inventory if registration was confirmed
    if (wasConfirmed) {
      // Decrement old ticket's sold count
      if (oldTicketId) {
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
      message: `Successfully transferred to ${newEvent.name}`,
      transfer: {
        fromEvent: oldEventName,
        toEvent: newEvent.name,
        fromTicket: oldTicketName,
        toTicket: newTicket.name,
        newRegistrationNumber: newRegNumber,
      },
      priceChange: {
        oldPrice: currentReg.total_amount,
        newPrice: totalAmount,
        difference: totalAmount - currentReg.total_amount,
      }
    })
  } catch (error: any) {
    console.error("Transfer event error:", error)
    return NextResponse.json({ error: "Failed to transfer registration" }, { status: 500 })
  }
}
