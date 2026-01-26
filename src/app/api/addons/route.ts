import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET /api/addons - Get addons for an event (public endpoint for delegate portal)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")
    const activeOnly = searchParams.get("active") === "true"
    const ticketTypeId = searchParams.get("ticket_type_id") // Filter by ticket type

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    let query = supabase
      .from("addons")
      .select(`
        id,
        name,
        description,
        price,
        max_quantity,
        image_url,
        has_variants,
        is_active,
        is_course,
        ticket_type_ids
      `)
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })

    if (activeOnly) {
      query = query.eq("is_active", true)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching addons:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Filter addons by ticket type if specified
    let filteredData = data || []
    if (ticketTypeId) {
      filteredData = filteredData.filter((addon: any) => {
        // If addon has no ticket_type_ids restriction, it's available for all
        if (!addon.ticket_type_ids || addon.ticket_type_ids.length === 0) {
          return true
        }
        // Check if the ticket type is in the allowed list
        return addon.ticket_type_ids.includes(ticketTypeId)
      })
    }

    // Transform data
    const addons = filteredData.map((addon: any) => ({
      ...addon,
      variants: [], // Variants not implemented yet
    }))

    return NextResponse.json({ data: addons })
  } catch (error: any) {
    console.error("Error in addons API:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
