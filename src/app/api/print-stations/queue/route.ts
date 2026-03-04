import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// GET /api/print-stations/queue?token=xxx - Poll for queued print jobs (called by print agent)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")
    const agentId = searchParams.get("agent_id")

    if (!token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    const db = supabase as any

    // Verify print station
    const { data: station, error: stationError } = await db
      .from("print_stations")
      .select("id, name, event_id, is_active, print_settings, badge_template_id, badge_templates(id, name, template_data), events(id, name, short_name)")
      .eq("access_token", token)
      .maybeSingle()

    if (stationError || !station) {
      return NextResponse.json({ error: "Invalid station token" }, { status: 404 })
    }

    if (!station.is_active) {
      return NextResponse.json({ error: "Station is inactive" }, { status: 400 })
    }

    // Fetch queued jobs (not yet picked up by an agent)
    const { data: jobs, error: jobsError } = await db
      .from("print_jobs")
      .select(`
        id, print_number, status, zpl_data, badge_html, registration_data, created_at,
        registrations (
          id, registration_number, attendee_name, attendee_email, attendee_phone,
          attendee_institution, attendee_designation, ticket_type_id, status,
          ticket_types (name)
        )
      `)
      .eq("print_station_id", station.id)
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(20)

    if (jobsError) {
      console.error("Queue fetch error:", jobsError)
      return NextResponse.json({ error: "Failed to fetch queue" }, { status: 500 })
    }

    // Mark jobs as picked up (so other agents don't grab them)
    if (jobs && jobs.length > 0 && agentId) {
      const jobIds = jobs.map((j: any) => j.id)
      await db
        .from("print_jobs")
        .update({
          status: "printing",
          picked_up_at: new Date().toISOString(),
          agent_id: agentId,
        })
        .in("id", jobIds)
        .eq("status", "queued") // Only update if still queued (prevents race condition)
    }

    return NextResponse.json({
      station: {
        id: station.id,
        name: station.name,
        print_settings: station.print_settings,
        badge_template: station.badge_templates,
        event: station.events,
      },
      jobs: jobs || [],
      count: jobs?.length || 0,
    })
  } catch (error: any) {
    console.error("Queue poll error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/print-stations/queue - Update job status (called by print agent after printing)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { job_id, status, error_message, agent_id, zpl_data } = body

    if (!job_id || !status) {
      return NextResponse.json({ error: "job_id and status are required" }, { status: 400 })
    }

    if (!["completed", "failed", "queued"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    const db = supabase as any

    const updateData: any = {
      status,
    }

    if (status === "completed") {
      updateData.printed_at = new Date().toISOString()
    }

    if (status === "failed" && error_message) {
      updateData.error_message = error_message
    }

    if (agent_id) {
      updateData.agent_id = agent_id
    }

    if (zpl_data) {
      updateData.zpl_data = zpl_data
    }

    const { data, error } = await db
      .from("print_jobs")
      .update(updateData)
      .eq("id", job_id)
      .select()
      .single()

    if (error) {
      console.error("Queue update error:", error)
      return NextResponse.json({ error: "Failed to update job" }, { status: 500 })
    }

    return NextResponse.json({ success: true, job: data })
  } catch (error: any) {
    console.error("Queue update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
