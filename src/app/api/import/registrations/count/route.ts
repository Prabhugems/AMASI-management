import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// GET /api/import/registrations/count - Count imported registrations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const event_id = searchParams.get("event_id")

    if (!event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Count registrations that appear to be imported (total_amount = 0 or wrong format)
    const { count, error } = await (supabase as any)
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event_id)
      .eq("payment_status", "completed")
      .or("total_amount.eq.0,registration_number.ilike.%FMASA%")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ count: count || 0 })
  } catch (error: any) {
    console.error("Error counting imported registrations:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
