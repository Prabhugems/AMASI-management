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

    // Fetch addons with their ticket links
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
        addon_ticket_links (
          ticket_type_id,
          max_quantity_per_attendee
        )
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
        const links = addon.addon_ticket_links || []
        // If addon has no ticket links, it's available for all ticket types
        if (links.length === 0) {
          return true
        }
        // Check if the ticket type is in the allowed list
        return links.some((link: any) => link.ticket_type_id === ticketTypeId)
      })
    }

    // Transform data - include max quantity from ticket link if available
    const addons = filteredData.map((addon: any) => {
      const links = addon.addon_ticket_links || []
      let maxQty = addon.max_quantity || 10

      // If filtering by ticket type, use the link's max quantity
      if (ticketTypeId && links.length > 0) {
        const link = links.find((l: any) => l.ticket_type_id === ticketTypeId)
        if (link?.max_quantity_per_attendee) {
          maxQty = link.max_quantity_per_attendee
        }
      }

      return {
        ...addon,
        max_quantity: maxQty,
        addon_ticket_links: undefined, // Don't expose internal data
        variants: [], // Variants not implemented yet
      }
    })

    return NextResponse.json({ data: addons })
  } catch (error: any) {
    console.error("Error in addons API:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
