import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAccess, getEventIdFromRegistration } from "@/lib/auth/api-auth"
import { syncRegistrationToAirtable } from "@/lib/services/airtable-sync"
import { NextRequest, NextResponse } from "next/server"

// GET /api/examination/registrations?event_id=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const { error: accessError } = await requireEventAccess(eventId)
    if (accessError) return accessError

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Fetch event settings and ticket types in parallel
    const [{ data: eventData }, { data: ticketTypes }] = await Promise.all([
      db.from("events").select("settings").eq("id", eventId).maybeSingle(),
      db.from("ticket_types").select("id, name").eq("event_id", eventId),
    ])

    const examTicketTypes = eventData?.settings?.examination?.exam_ticket_types as string[] | undefined

    // Determine which ticket type IDs to filter by
    let filterTicketIds: string[] | null = null
    if (examTicketTypes && examTicketTypes.length > 0) {
      // Use explicitly configured exam ticket types
      filterTicketIds = examTicketTypes
    } else {
      // Auto-filter: only ticket types with "exam" in the name
      const examTypes = (ticketTypes || []).filter((t: any) =>
        t.name?.toLowerCase().includes("exam")
      )
      if (examTypes.length > 0) {
        filterTicketIds = examTypes.map((t: any) => t.id)
      }
    }

    let query = db
      .from("registrations")
      .select("id, registration_number, attendee_name, attendee_email, attendee_phone, ticket_type_id, exam_marks, exam_result, exam_total_marks, convocation_number, convocation_address, checked_in, status")
      .eq("event_id", eventId)
      .in("status", ["confirmed", "attended", "completed", "checked_in"])
      .order("attendee_name")

    // Restrict to exam ticket types BUT always keep candidates who already
    // have an exam_result on record — their ticket may have been entered as
    // a non-exam SKU (e.g. "Skill Course Only") even though they took the
    // exam, and silently hiding them costs us a convocation certificate.
    if (filterTicketIds && filterTicketIds.length > 0) {
      const ticketList = filterTicketIds.map((id) => `"${id}"`).join(",")
      query = query.or(`ticket_type_id.in.(${ticketList}),exam_result.not.is.null`)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching exam registrations:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const ticketMap = new Map((ticketTypes || []).map((t: any) => [t.id, t.name]))

    // Map to frontend-friendly field names
    const mapped = (data || []).map((r: any) => ({
      ...r,
      name: r.attendee_name,
      email: r.attendee_email,
      phone: r.attendee_phone,
      registration_id: r.registration_number,
      ticket_type_name: ticketMap.get(r.ticket_type_id) || null,
      amasi_number: r.exam_marks?.amasi_number || null,
    }))

    return NextResponse.json(mapped)
  } catch (error) {
    console.error("Error in GET /api/examination/registrations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/examination/registrations - Update exam marks/result
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...rawUpdates } = body

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    // Resolve event_id from the registration so the caller can't bypass
    // event-scoped access by editing rows in another event.
    const eventId = await getEventIdFromRegistration(id)
    if (!eventId) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }
    const { error: accessError } = await requireEventAccess(eventId)
    if (accessError) return accessError

    // Whitelist allowed fields to prevent overwriting arbitrary columns
    const ALLOWED_FIELDS = ["exam_marks", "exam_result", "exam_total_marks", "convocation_number", "convocation_address"]
    const updates: Record<string, any> = {}
    for (const key of ALLOWED_FIELDS) {
      if (key in rawUpdates) updates[key] = rawUpdates[key]
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Check for duplicate convocation number before saving
    if (updates.convocation_number) {
      const { data: dup } = await db
        .from("registrations")
        .select("id")
        .eq("convocation_number", updates.convocation_number)
        .neq("id", id)
        .maybeSingle()
      if (dup) {
        return NextResponse.json({ error: `Convocation number ${updates.convocation_number} is already assigned to another candidate` }, { status: 409 })
      }
    }

    // Fetch existing convocation_number to detect new assignment (for Airtable sync)
    let oldConvNo: string | null = null
    if (updates.convocation_number !== undefined) {
      const { data: existing } = await db
        .from("registrations")
        .select("convocation_number")
        .eq("id", id)
        .single()
      oldConvNo = existing?.convocation_number ?? null
    }

    // For exam_marks: use atomic Postgres JSONB merge (||) to avoid read-modify-write race
    // This ensures concurrent updates to different keys don't clobber each other
    if (updates.exam_marks && typeof updates.exam_marks === "object") {
      const marksJson = JSON.stringify(updates.exam_marks)
      await db.rpc("merge_exam_marks", { reg_id: id, new_marks: marksJson }).maybeSingle()
      delete updates.exam_marks
    }

    // Update remaining fields (if any left after extracting exam_marks)
    let data: any = null
    if (Object.keys(updates).length > 0) {
      const { data: updated, error } = await db
        .from("registrations")
        .update(updates)
        .eq("id", id)
        .select()
        .single()
      if (error) {
        console.error("Error updating registration:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      data = updated
    } else {
      // Only exam_marks was updated via RPC, re-fetch the row
      const { data: fetched } = await db
        .from("registrations")
        .select("*")
        .eq("id", id)
        .single()
      data = fetched
    }

    // Auto-create Airtable record when convocation number is newly assigned
    if (updates.convocation_number && !oldConvNo && data) {
      try {
        await syncRegistrationToAirtable(data, db)
      } catch (e) {
        console.error("Airtable sync failed (non-blocking):", e)
      }
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in PATCH /api/examination/registrations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
