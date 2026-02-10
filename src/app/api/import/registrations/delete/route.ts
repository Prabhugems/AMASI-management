import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// POST /api/import/registrations/delete - Delete imported registrations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_id } = body

    if (!event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Delete registrations that were imported (payment_method = 'imported')
    const { data, error } = await (supabase as any)
      .from("registrations")
      .delete()
      .eq("event_id", event_id)
      .eq("payment_status", "completed")
      .or("total_amount.eq.0,registration_number.ilike.%FMASA%")
      .select("id")

    if (error) {
      return NextResponse.json({ error: "Failed to delete registrations" }, { status: 500 })
    }

    return NextResponse.json({ deleted: data?.length || 0 })
  } catch (error: any) {
    console.error("Error deleting imported registrations:", error)
    return NextResponse.json({ error: "Failed to delete registrations" }, { status: 500 })
  }
}
