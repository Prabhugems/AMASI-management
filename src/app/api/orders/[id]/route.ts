import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

// Create admin client with service role key to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// DELETE - Delete an order and associated registrations
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log(`[DELETE ORDER] Deleting order: ${id}`)

    // First get registrations to restore ticket inventory
    const { data: registrations } = await supabaseAdmin
      .from("registrations")
      .select("id, ticket_type_id, quantity, status")
      .eq("payment_id", id)

    // Restore ticket inventory for confirmed registrations
    if (registrations && registrations.length > 0) {
      for (const reg of registrations) {
        if (reg.status === "confirmed" && reg.ticket_type_id) {
          // Get current ticket count
          const { data: ticket } = await supabaseAdmin
            .from("ticket_types")
            .select("quantity_sold")
            .eq("id", reg.ticket_type_id)
            .single()

          if (ticket) {
            const newCount = Math.max(0, (ticket.quantity_sold || 0) - (reg.quantity || 1))
            await supabaseAdmin
              .from("ticket_types")
              .update({ quantity_sold: newCount })
              .eq("id", reg.ticket_type_id)

            console.log(`[DELETE ORDER] Restored ${reg.quantity || 1} ticket(s) to ${reg.ticket_type_id}`)
          }
        }
      }
    }

    // Delete registrations
    const { data: deletedRegs, error: regError } = await supabaseAdmin
      .from("registrations")
      .delete()
      .eq("payment_id", id)
      .select()

    if (regError) {
      console.error("[DELETE ORDER] Error deleting registrations:", regError)
    } else {
      console.log(`[DELETE ORDER] Deleted ${deletedRegs?.length || 0} registrations`)
    }

    // Then delete the payment/order
    const { data: deletedPayment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .delete()
      .eq("id", id)
      .select()

    if (paymentError) {
      console.error("[DELETE ORDER] Error deleting payment:", paymentError)
      return NextResponse.json(
        { error: paymentError.message },
        { status: 500 }
      )
    }

    console.log(`[DELETE ORDER] Successfully deleted payment:`, deletedPayment)

    return NextResponse.json({
      success: true,
      deleted: deletedPayment,
      registrations_deleted: deletedRegs?.length || 0,
      tickets_restored: registrations?.length || 0
    })
  } catch (error: any) {
    console.error("[DELETE ORDER] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete order" },
      { status: 500 }
    )
  }
}

// GET - Get order details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data, error } = await supabaseAdmin
      .from("payments")
      .select(`
        *,
        registrations (
          id,
          registration_number,
          attendee_name,
          attendee_email,
          ticket_type:ticket_types (
            id,
            name,
            price
          )
        )
      `)
      .eq("id", id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
