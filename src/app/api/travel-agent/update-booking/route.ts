import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabaseClient = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = supabaseClient as any
    const body = await request.json()
    const { registration_id, event_id, booking } = body

    if (!registration_id || !event_id || !booking) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Verify the registration belongs to this event
    const { data: registration, error: fetchError } = await supabase
      .from("registrations")
      .select("id, custom_fields, event_id")
      .eq("id", registration_id)
      .eq("event_id", event_id)
      .maybeSingle()

    if (fetchError || !registration) {
      return NextResponse.json(
        { error: "Registration not found or access denied" },
        { status: 404 }
      )
    }

    // Merge booking data
    const mergedBooking = {
      ...(registration.custom_fields?.booking || {}),
      ...booking,
    }

    // Auto-sync booking fields to travel_details so data is consistent
    // across speaker portal, admin panels, and itinerary views
    const existingTravel = registration.custom_fields?.travel_details || {}
    const syncedTravel = { ...existingTravel }

    // Map booking fields -> travel_details fields
    const syncMap: Record<string, Record<string, string>> = {
      onward: {
        onward_from_city: "onward_from_city",
        onward_to_city: "onward_to_city",
        onward_departure_date: "onward_date",
        onward_departure_time: "onward_departure_time",
        onward_arrival_time: "onward_arrival_time",
        onward_flight_number: "onward_preferred_time",
        onward_pnr: "onward_pnr",
        onward_seat: "onward_seat",
      },
      return: {
        return_from_city: "return_from_city",
        return_to_city: "return_to_city",
        return_departure_date: "return_date",
        return_departure_time: "return_departure_time",
        return_arrival_time: "return_arrival_time",
        return_flight_number: "return_preferred_time",
        return_pnr: "return_pnr",
        return_seat: "return_seat",
      },
      hotel: {
        hotel_checkin: "hotel_check_in",
        hotel_checkout: "hotel_check_out",
        hotel_room_type: "hotel_room_type",
      },
      transfers: {
        pickup_required: "pickup_required",
        drop_required: "drop_required",
      },
    }

    for (const group of Object.values(syncMap)) {
      for (const [bookingKey, travelKey] of Object.entries(group)) {
        if (mergedBooking[bookingKey] !== undefined && mergedBooking[bookingKey] !== "") {
          syncedTravel[travelKey] = mergedBooking[bookingKey]
        }
      }
    }

    // Set flags based on booking status
    if (mergedBooking.onward_status === "booked" || mergedBooking.onward_status === "confirmed") {
      syncedTravel.onward_required = true
    }
    if (mergedBooking.return_status === "booked" || mergedBooking.return_status === "confirmed") {
      syncedTravel.return_required = true
    }
    if (mergedBooking.hotel_status === "booked" || mergedBooking.hotel_status === "confirmed" || mergedBooking.hotel_checkin) {
      syncedTravel.hotel_required = true
    }
    if (mergedBooking.onward_from_city) {
      syncedTravel.from_city = mergedBooking.onward_from_city
    }
    if (!syncedTravel.mode) {
      syncedTravel.mode = "flight"
    }

    // Update the booking + synced travel_details in custom_fields
    const { error: updateError } = await supabase
      .from("registrations")
      .update({
        custom_fields: {
          ...(registration.custom_fields || {}),
          booking: mergedBooking,
          travel_details: syncedTravel,
          needs_travel: true,
        },
      })
      .eq("id", registration_id)

    if (updateError) {
      console.error("Update error:", updateError)
      return NextResponse.json(
        { error: "Failed to update booking" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Travel agent update error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
