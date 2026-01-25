import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// POST /api/print-stations/print - Create a print job (scan to print)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      print_station_id,
      registration_id,
      registration_number,
      event_id,
      token,
      device_info
    } = body

    const supabase = await createAdminClient()

    // Verify print station
    let stationQuery = (supabase as any)
      .from("print_stations")
      .select(`
        *,
        badge_templates (id, name, template_data),
        events (id, name)
      `)

    if (token) {
      stationQuery = stationQuery.eq("access_token", token)
    } else if (print_station_id) {
      stationQuery = stationQuery.eq("id", print_station_id)
    } else {
      return NextResponse.json({ error: "print_station_id or token is required" }, { status: 400 })
    }

    const { data: station, error: stationError } = await stationQuery.single()

    if (stationError || !station) {
      return NextResponse.json({ error: "Print station not found" }, { status: 404 })
    }

    if (!station.is_active) {
      return NextResponse.json({ error: "Print station is not active" }, { status: 400 })
    }

    // Check token expiry
    if (station.token_expires_at && new Date(station.token_expires_at) < new Date()) {
      return NextResponse.json({ error: "Print station token has expired" }, { status: 401 })
    }

    // Find registration
    let regQuery = (supabase as any)
      .from("registrations")
      .select(`
        id,
        registration_number,
        attendee_name,
        attendee_email,
        attendee_phone,
        attendee_institution,
        attendee_designation,
        ticket_type_id,
        status,
        ticket_types (id, name)
      `)
      .eq("event_id", station.event_id)

    if (registration_id) {
      regQuery = regQuery.eq("id", registration_id)
    } else if (registration_number) {
      regQuery = regQuery.eq("registration_number", registration_number)
    } else {
      return NextResponse.json({ error: "registration_id or registration_number is required" }, { status: 400 })
    }

    const { data: registration, error: regError } = await regQuery.single()

    if (regError || !registration) {
      return NextResponse.json({
        error: "Attendee not found",
        registration_number: registration_number
      }, { status: 404 })
    }

    // Check if registration is confirmed
    if (registration.status !== "confirmed") {
      return NextResponse.json({
        error: `Cannot print: Registration status is "${registration.status}"`,
        registration
      }, { status: 400 })
    }

    // Check ticket type restrictions
    if (station.ticket_type_ids?.length > 0 && !station.ticket_type_ids.includes(registration.ticket_type_id)) {
      return NextResponse.json({
        error: `This ticket type is not allowed for printing at this station`,
        registration
      }, { status: 400 })
    }

    // Check existing prints for reprint control
    const { data: existingPrints, error: printError } = await (supabase as any)
      .from("print_jobs")
      .select("*")
      .eq("print_station_id", station.id)
      .eq("registration_id", registration.id)
      .eq("status", "completed")
      .order("print_number", { ascending: false })
      .limit(1)

    const lastPrint = existingPrints?.[0]
    const printNumber = lastPrint ? lastPrint.print_number + 1 : 1

    // Check reprint limits
    if (printNumber > 1 && !station.allow_reprint) {
      return NextResponse.json({
        error: "Reprints are not allowed at this station",
        registration,
        already_printed: true,
        last_printed_at: lastPrint?.printed_at
      }, { status: 400 })
    }

    if (printNumber > station.max_reprints) {
      return NextResponse.json({
        error: `Maximum reprints (${station.max_reprints}) exceeded`,
        registration,
        print_count: lastPrint?.print_number
      }, { status: 400 })
    }

    // Create print job
    const { data: printJob, error: jobError } = await (supabase as any)
      .from("print_jobs")
      .insert({
        print_station_id: station.id,
        registration_id: registration.id,
        print_number: printNumber,
        status: "completed",
        printed_at: new Date().toISOString(),
        device_info: device_info || {}
      })
      .select()
      .single()

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 500 })
    }

    // Check-in if required
    if (station.require_checkin) {
      // You could integrate with check-in system here
    }

    return NextResponse.json({
      success: true,
      print_job: printJob,
      print_number: printNumber,
      is_reprint: printNumber > 1,
      registration: {
        ...registration,
        ticket_type: registration.ticket_types?.name
      },
      station: {
        id: station.id,
        name: station.name,
        print_mode: station.print_mode,
        print_settings: station.print_settings,
        auto_print: station.auto_print
      },
      badge_template: station.badge_templates
    })
  } catch (error: any) {
    console.error("Error creating print job:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET /api/print-stations/print - Get print history for a station
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const stationId = searchParams.get("station_id")
    const registrationId = searchParams.get("registration_id")
    const limit = parseInt(searchParams.get("limit") || "50")

    if (!stationId && !registrationId) {
      return NextResponse.json({ error: "station_id or registration_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    let query = (supabase as any)
      .from("print_jobs")
      .select(`
        *,
        registrations (
          id,
          registration_number,
          attendee_name,
          attendee_email,
          ticket_types (name)
        )
      `)
      .order("printed_at", { ascending: false })
      .limit(limit)

    if (stationId) {
      query = query.eq("print_station_id", stationId)
    }

    if (registrationId) {
      query = query.eq("registration_id", registrationId)
    }

    const { data: printJobs, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(printJobs || [])
  } catch (error: any) {
    console.error("Error fetching print jobs:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
