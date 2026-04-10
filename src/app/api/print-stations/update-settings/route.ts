import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { token, print_settings, auto_print } = await request.json()

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    if (!print_settings && auto_print === undefined) {
      return NextResponse.json({ error: "No settings to update" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Verify token belongs to a valid, active print station
    const { data: station, error: stationError } = await (supabase as any)
      .from("print_stations")
      .select("id, is_active")
      .eq("access_token", token)
      .single()

    if (stationError || !station) {
      return NextResponse.json({ error: "Invalid station token" }, { status: 401 })
    }

    if (!station.is_active) {
      return NextResponse.json({ error: "Station is inactive" }, { status: 403 })
    }

    // Build update payload
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString()
    }

    if (print_settings) {
      updates.print_settings = print_settings
    }

    if (auto_print !== undefined) {
      updates.auto_print = auto_print
    }

    const { data: updated, error: updateError } = await (supabase as any)
      .from("print_stations")
      .update(updates)
      .eq("id", station.id)
      .select("print_settings, auto_print")
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      print_settings: updated.print_settings,
      auto_print: updated.auto_print
    })
  } catch (error: any) {
    console.error("Update settings error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
