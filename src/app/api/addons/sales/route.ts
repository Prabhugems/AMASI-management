import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// GET - Fetch addon sales data (bypasses RLS)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // First get all addons for this event
    const { data: addons, error: addonsError } = await supabase
      .from("addons")
      .select("id")
      .eq("event_id", eventId)

    if (addonsError) {
      return NextResponse.json({ error: addonsError.message }, { status: 500 })
    }

    if (!addons || addons.length === 0) {
      return NextResponse.json({ sales: {} })
    }

    const addonIds = addons.map((a: any) => a.id)

    // Fetch sales data from registration_addons using admin client
    const { data: salesData, error: salesError } = await supabase
      .from("registration_addons")
      .select("addon_id, quantity, price")
      .in("addon_id", addonIds)

    if (salesError) {
      console.error("Error fetching addon sales:", salesError)
      return NextResponse.json({ error: salesError.message }, { status: 500 })
    }

    // Calculate sales by addon
    const salesByAddon: Record<string, { sold: number; revenue: number }> = {}

    if (salesData) {
      salesData.forEach((sale: any) => {
        if (!salesByAddon[sale.addon_id]) {
          salesByAddon[sale.addon_id] = { sold: 0, revenue: 0 }
        }
        salesByAddon[sale.addon_id].sold += sale.quantity || 1
        salesByAddon[sale.addon_id].revenue += parseFloat(sale.price) || 0
      })
    }

    return NextResponse.json({ sales: salesByAddon })
  } catch (error: any) {
    console.error("Addon sales error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
