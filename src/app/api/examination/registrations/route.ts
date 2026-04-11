import { createAdminClient } from "@/lib/supabase/server"
import { getApiUser } from "@/lib/auth/api-auth"
import { NextRequest, NextResponse } from "next/server"

// GET /api/examination/registrations?event_id=xxx
export async function GET(request: NextRequest) {
  try {
    const user = await getApiUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

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

    if (filterTicketIds && filterTicketIds.length > 0) {
      query = query.in("ticket_type_id", filterTicketIds)
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
    const user = await getApiUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...rawUpdates } = body

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

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

    // Fetch existing row when we need it for either:
    //   (a) convocation_number Airtable sync diff, or
    //   (b) exam_marks JSONB merge so we don't clobber sibling keys
    //       like amasi_number, remarks, fillout_link, etc.
    let oldConvNo: string | null = null
    const needsExisting = updates.convocation_number !== undefined || updates.exam_marks
    if (needsExisting) {
      const { data: existing } = await db
        .from("registrations")
        .select("convocation_number, exam_marks")
        .eq("id", id)
        .single()
      oldConvNo = existing?.convocation_number ?? null

      // Merge exam_marks: incoming values win, but preserve any existing keys
      // that aren't in the incoming payload (e.g. amasi_number).
      if (updates.exam_marks && typeof updates.exam_marks === "object") {
        updates.exam_marks = { ...(existing?.exam_marks || {}), ...updates.exam_marks }
      }
    }

    const { data, error } = await db
      .from("registrations")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating registration:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Auto-create Airtable record when convocation number is newly assigned
    if (updates.convocation_number && !oldConvNo && data) {
      try {
        await syncToAirtable(data, db)
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

// Sync convocation record to Airtable and store fillout link back
async function syncToAirtable(reg: any, db: any) {
  const pat = process.env.AIRTABLE_PAT?.trim()
  const baseId = process.env.AIRTABLE_CONVOCATION_BASE?.trim()
  const tableId = process.env.AIRTABLE_CONVOCATION_TABLE?.trim()

  if (!pat || !baseId || !tableId) return

  const ticketName = reg.ticket_type_id
    ? (await db.from("ticket_types").select("name").eq("id", reg.ticket_type_id).single())?.data?.name
    : null

  const res = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      records: [{
        fields: {
          "CONVOCATION NUMBER": reg.convocation_number,
          "Name": reg.attendee_name,
          "AMASI Number": reg.exam_marks?.amasi_number || null,
          "Category": ticketName || "",
          "Email": reg.attendee_email || "",
          "MOBILE": reg.attendee_phone || "",
        },
      }],
    }),
  })

  const result = await res.json()
  if (result.records?.[0]?.id) {
    const recordId = result.records[0].id
    const filloutLink = `https://forms.fillout.com/t/gz1eLocmB9us?id=${recordId}`

    // Store fillout link back on registration
    const marks = reg.exam_marks || {}
    marks.fillout_link = filloutLink
    await db.from("registrations").update({ exam_marks: marks }).eq("id", reg.id)
  }
}
