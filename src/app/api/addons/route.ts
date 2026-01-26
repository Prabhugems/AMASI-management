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
        is_course
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

    // Transform data
    const addons = (data || []).map((addon: any) => ({
      ...addon,
      variants: [], // Variants not implemented yet
    }))

    return NextResponse.json({ data: addons })
  } catch (error: any) {
    console.error("Error in addons API:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
