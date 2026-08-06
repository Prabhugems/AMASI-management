import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAccess } from "@/lib/auth/api-auth"

// POST /api/analytics/leads - Capture a lead
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      event_id,
      email,
      name,
      phone,
      source = "notify_me",
      visitor_id,
      utm_source,
      utm_medium,
      utm_campaign,
    } = body

    if (!event_id || !email) {
      return NextResponse.json(
        { error: "event_id and email are required" },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    // Check if lead already exists
    const { data: existingLead } = await (supabase as any)
      .from("event_leads")
      .select("id, status")
      .eq("event_id", event_id)
      .eq("email", email.toLowerCase())
      .maybeSingle()

    if (existingLead) {
      // Update existing lead with new info if provided
      const { error: updateError } = await (supabase as any)
        .from("event_leads")
        .update({
          name: name || null,
          phone: phone || null,
          visitor_id: visitor_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingLead.id)

      if (updateError) {
        console.error("Failed to update lead:", updateError)
      }

      return NextResponse.json({
        success: true,
        message: "You're already on our list!",
        lead_id: existingLead.id,
        is_existing: true,
      })
    }

    // Create new lead
    const { data: lead, error } = await (supabase as any)
      .from("event_leads")
      .insert({
        event_id,
        email: email.toLowerCase(),
        name: name || null,
        phone: phone || null,
        source,
        visitor_id: visitor_id || null,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        status: "new",
      })
      .select()
      .single()

    if (error) {
      console.error("Failed to create lead:", error)
      return NextResponse.json(
        { error: "Failed to save your information" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Thanks! We'll notify you about this event.",
      lead_id: lead.id,
      is_existing: false,
    })
  } catch (error: any) {
    console.error("Error in POST /api/analytics/leads:", error)
    return NextResponse.json({ error: "Failed to process leads request" }, { status: 500 })
  }
}

// GET /api/analytics/leads - Get leads for an event
export async function GET(request: NextRequest) {
  try {
    const supabase = await createAdminClient()
    const { searchParams } = new URL(request.url)

    const eventId = searchParams.get("event_id")
    const status = searchParams.get("status")
    const limit = parseInt(searchParams.get("limit") || "100")
    const offset = parseInt(searchParams.get("offset") || "0")

    if (!eventId) {
      return NextResponse.json(
        { error: "event_id is required" },
        { status: 400 }
      )
    }

    // This handler was reachable with no credentials at all and returned
    // `select("*")` from event_leads — email, name, phone and notes for every
    // lead on an event, to anyone who knew an event_id. Middleware does not
    // protect /api (its protectedRoutes list holds page prefixes only), so an
    // API route is unauthenticated unless it says otherwise, and this one did
    // not. The sibling GET /api/events/[eventId]/leads, serving the same table,
    // has always required auth.
    //
    // Event-scoped rather than requireAdmin() so event admins keep access to
    // their own event's leads, matching how the kiosk-station routes gate.
    //
    // POST below stays public on purpose: it is the "notify me" capture called
    // from public event pages.
    const { error: authError } = await requireEventAccess(eventId)
    if (authError) return authError

    let query = (supabase as any)
      .from("event_leads")
      .select("*", { count: "exact" })
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (status && status !== "all") {
      query = query.eq("status", status)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: "Failed to process leads request" }, { status: 500 })
    }

    return NextResponse.json({
      data,
      count,
      limit,
      offset,
    })
  } catch (error: any) {
    console.error("Error in GET /api/analytics/leads:", error)
    return NextResponse.json({ error: "Failed to process leads request" }, { status: 500 })
  }
}

// PATCH /api/analytics/leads - Update lead status
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createAdminClient()
    const body = await request.json()
    const { lead_id, status, notes, registration_id } = body

    if (!lead_id) {
      return NextResponse.json(
        { error: "lead_id is required" },
        { status: 400 }
      )
    }

    // Was an unauthenticated WRITE: anyone could rewrite any lead's status,
    // notes and registration_id given only a lead_id. Same root cause as the
    // GET above — middleware does not gate /api, so a route is open unless it
    // gates itself.
    //
    // PATCH carries no event_id, so the owning event is resolved first and then
    // access is checked against it. That keeps the same event-scoped model as
    // GET instead of falling back to a blanket requireAdmin(), which would lock
    // event admins out of their own leads. The lookup selects one column and
    // reveals nothing beyond whether the id exists.
    const { data: leadRow } = await (supabase as any)
      .from("event_leads")
      .select("event_id")
      .eq("id", lead_id)
      .maybeSingle()

    if (!leadRow) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    const { error: authError } = await requireEventAccess(leadRow.event_id)
    if (authError) return authError

    const updateData: any = { updated_at: new Date().toISOString() }
    if (status) updateData.status = status
    if (notes !== undefined) updateData.notes = notes
    if (registration_id) {
      updateData.registration_id = registration_id
      updateData.converted_at = new Date().toISOString()
      updateData.status = "converted"
    }

    const { data, error } = await (supabase as any)
      .from("event_leads")
      .update(updateData)
      .eq("id", lead_id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to process leads request" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error("Error in PATCH /api/analytics/leads:", error)
    return NextResponse.json({ error: "Failed to process leads request" }, { status: 500 })
  }
}
