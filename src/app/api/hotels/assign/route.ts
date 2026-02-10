import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// POST /api/hotels/assign - Bulk assign guests to a hotel
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const { guest_ids, hotel_id, hotel_name, hotel_address, hotel_phone, check_in, check_out, room_type } = body

    if (!guest_ids || guest_ids.length === 0) {
      return NextResponse.json({ error: "guest_ids required" }, { status: 400 })
    }

    let success = 0
    let failed = 0

    for (const guestId of guest_ids) {
      try {
        // Get current custom_fields
        const { data: current } = await (supabase as any)
          .from("registrations")
          .select("custom_fields")
          .eq("id", guestId)
          .maybeSingle()

        // Update with hotel assignment
        const { error } = await (supabase as any)
          .from("registrations")
          .update({
            custom_fields: {
              ...(current?.custom_fields || {}),
              assigned_hotel_id: hotel_id,
              booking: {
                ...(current?.custom_fields?.booking || {}),
                hotel_status: "booked",
                hotel_name: hotel_name,
                hotel_address: hotel_address || "",
                hotel_phone: hotel_phone || "",
                hotel_checkin: check_in || current?.custom_fields?.travel_details?.arrival_date || "",
                hotel_checkout: check_out || current?.custom_fields?.travel_details?.departure_date || "",
                hotel_room_type: room_type || "standard",
              },
            },
          })
          .eq("id", guestId)

        if (error) {
          failed++
        } else {
          success++
        }
      } catch {
        failed++
      }
    }

    return NextResponse.json({
      success: true,
      assigned: success,
      failed,
      message: `Assigned ${success} guests to ${hotel_name}${failed > 0 ? `, ${failed} failed` : ""}`,
    })
  } catch (error: any) {
    console.error("Error assigning guests:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
