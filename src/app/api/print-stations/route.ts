import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import crypto from "crypto"

// GET /api/print-stations - List print stations for an event
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")
    const token = searchParams.get("token")

    const supabase = await createAdminClient()

    // If token provided, get single station by token
    if (token) {
      const { data: station, error } = await (supabase as any)
        .from("print_stations")
        .select(`
          *,
          badge_templates (id, name, template_data),
          events (id, name, short_name)
        `)
        .eq("access_token", token)
        .eq("is_active", true)
        .single()

      if (error || !station) {
        return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 })
      }

      // Check if token expired
      if (station.token_expires_at && new Date(station.token_expires_at) < new Date()) {
        return NextResponse.json({ error: "Token has expired" }, { status: 401 })
      }

      return NextResponse.json(station)
    }

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    // Require admin auth for listing all stations (non-token access)
    const { user, error: authError } = await requireAdmin()
    if (authError) return authError

    // Get all print stations for event with stats
    const { data: stations, error } = await (supabase as any)
      .from("print_stations")
      .select(`
        *,
        badge_templates (id, name)
      `)
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: "Failed to process print station request" }, { status: 500 })
    }

    // Get total registrations for progress calculation
    const { count: totalRegistrations } = await (supabase as any)
      .from("registrations")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "confirmed")

    // Add stats to each station
    const stationsWithStats = (stations || []).map((station: any) => ({
      ...station,
      stats: {
        totalPrints: station.total_prints || 0,
        uniquePrints: station.unique_prints || 0,
        totalRegistrations: totalRegistrations || 0,
        progress: totalRegistrations
          ? Math.round((station.unique_prints || 0) / totalRegistrations * 100)
          : 0
      }
    }))

    return NextResponse.json(stationsWithStats)
  } catch (error: any) {
    console.error("Error fetching print stations:", error)
    return NextResponse.json({ error: "Failed to process print station request" }, { status: 500 })
  }
}

// POST /api/print-stations - Create a new print station
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const { user, error: authError } = await requireAdmin()
    if (authError) return authError

    const body = await request.json()
    const {
      event_id,
      name,
      description,
      print_mode,
      badge_template_id,
      print_settings,
      allow_reprint,
      max_reprints,
      auto_print,
      require_checkin,
      ticket_type_ids,
      token_expires_at
    } = body

    if (!event_id || !name) {
      return NextResponse.json({ error: "event_id and name are required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Generate access token
    const accessToken = crypto.randomBytes(24).toString("hex")

    const { data: station, error } = await (supabase as any)
      .from("print_stations")
      .insert({
        event_id,
        name,
        description: description || null,
        print_mode: print_mode || "full_badge",
        badge_template_id: badge_template_id || null,
        print_settings: print_settings || {
          paper_size: "4x6",
          orientation: "portrait",
          margins: { top: 0, right: 0, bottom: 0, left: 0 },
          scale: 100,
          copies: 1
        },
        allow_reprint: allow_reprint !== false,
        max_reprints: max_reprints || 3,
        auto_print: auto_print || false,
        require_checkin: require_checkin || false,
        ticket_type_ids: ticket_type_ids || null,
        access_token: accessToken,
        token_expires_at: token_expires_at || null,
        is_active: true
      })
      .select(`
        *,
        badge_templates (id, name)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to process print station request" }, { status: 500 })
    }

    return NextResponse.json(station)
  } catch (error: any) {
    console.error("Error creating print station:", error)
    return NextResponse.json({ error: "Failed to process print station request" }, { status: 500 })
  }
}

// PUT /api/print-stations - Update a print station
export async function PUT(request: NextRequest) {
  try {
    // Require admin authentication
    const { user, error: authError } = await requireAdmin()
    if (authError) return authError

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Remove fields that shouldn't be updated directly
    delete updates.access_token
    delete updates.total_prints
    delete updates.unique_prints
    delete updates.created_at
    delete updates.created_by

    const { data: station, error } = await (supabase as any)
      .from("print_stations")
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select(`
        *,
        badge_templates (id, name)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to process print station request" }, { status: 500 })
    }

    return NextResponse.json(station)
  } catch (error: any) {
    console.error("Error updating print station:", error)
    return NextResponse.json({ error: "Failed to process print station request" }, { status: 500 })
  }
}

// DELETE /api/print-stations - Delete a print station
export async function DELETE(request: NextRequest) {
  try {
    // Require admin authentication
    const { user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    const { error } = await (supabase as any)
      .from("print_stations")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: "Failed to process print station request" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting print station:", error)
    return NextResponse.json({ error: "Failed to process print station request" }, { status: 500 })
  }
}

// PATCH /api/print-stations - Regenerate token
export async function PATCH(request: NextRequest) {
  try {
    // Require admin authentication
    const { user, error: authError } = await requireAdmin()
    if (authError) return authError

    const body = await request.json()
    const { id, action } = body

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    if (action === "regenerate_token") {
      const newToken = crypto.randomBytes(24).toString("hex")

      const { data: station, error } = await (supabase as any)
        .from("print_stations")
        .update({
          access_token: newToken,
          updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: "Failed to process print station request" }, { status: 500 })
      }

      return NextResponse.json(station)
    }

    if (action === "toggle_active") {
      const { data: current } = await (supabase as any)
        .from("print_stations")
        .select("is_active")
        .eq("id", id)
        .single()

      const { data: station, error } = await (supabase as any)
        .from("print_stations")
        .update({
          is_active: !current?.is_active,
          updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: "Failed to process print station request" }, { status: 500 })
      }

      return NextResponse.json(station)
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    console.error("Error patching print station:", error)
    return NextResponse.json({ error: "Failed to process print station request" }, { status: 500 })
  }
}
