import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

type ExaminerToken = {
  id: string
  label: string
  created_at: string
}

type ExamSettings = {
  exam_type: string
  pass_marks: number
  mark_columns: { key: string; label: string; max: number }[]
  convocation_prefix: string
  exam_ticket_types?: string[]
  examiner_tokens?: ExaminerToken[]
}

// Validate examiner token across all events
async function validateToken(db: any, token: string) {
  const { data: events, error } = await db
    .from("events")
    .select("id, name, settings")

  if (error || !events) return null

  for (const event of events) {
    const examination = (event.settings as any)?.examination as ExamSettings | undefined
    if (!examination?.examiner_tokens) continue

    const found = examination.examiner_tokens.find((t: ExaminerToken) => t.id === token)
    if (found) {
      return { event, examination, tokenInfo: found }
    }
  }

  return null
}

// GET /api/examination/examiner?token=xxx&q=search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")
    const query = searchParams.get("q")

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    const db = supabase as any

    const result = await validateToken(db, token)
    if (!result) {
      return NextResponse.json({ error: "Invalid examiner token" }, { status: 401 })
    }

    const { event, examination } = result

    // If no query, return event info and stats
    if (!query || query.trim() === "") {
      // Get all exam candidates for stats
      const examTicketTypes = examination.exam_ticket_types

      let regQuery = db
        .from("registrations")
        .select("id, exam_result, exam_marks")
        .eq("event_id", event.id)
        .in("status", ["confirmed", "attended", "completed", "checked_in"])

      if (examTicketTypes && examTicketTypes.length > 0) {
        regQuery = regQuery.in("ticket_type_id", examTicketTypes)
      } else {
        // Fall back to ticket types with "exam" in name
        const { data: ticketTypes } = await db
          .from("ticket_types")
          .select("id, name")
          .eq("event_id", event.id)

        const examTypes = (ticketTypes || []).filter((t: any) =>
          t.name?.toLowerCase().includes("exam")
        )
        if (examTypes.length > 0) {
          regQuery = regQuery.in("ticket_type_id", examTypes.map((t: any) => t.id))
        }
      }

      const { data: registrations } = await regQuery

      const total = registrations?.length || 0
      const marked = registrations?.filter((r: any) => r.exam_result).length || 0
      const pending = total - marked

      return NextResponse.json({
        event: { id: event.id, name: event.name },
        examination: {
          exam_type: examination.exam_type,
          pass_marks: examination.pass_marks,
          mark_columns: examination.mark_columns,
        },
        stats: { total, marked, pending },
      })
    }

    // Search for candidate
    const trimmedQuery = query.trim()
    const examTicketTypes = examination.exam_ticket_types

    // Get ticket types for filtering
    const { data: ticketTypes } = await db
      .from("ticket_types")
      .select("id, name")
      .eq("event_id", event.id)

    let filterTicketIds: string[] | null = null
    if (examTicketTypes && examTicketTypes.length > 0) {
      filterTicketIds = examTicketTypes
    } else {
      const examTypes = (ticketTypes || []).filter((t: any) =>
        t.name?.toLowerCase().includes("exam")
      )
      if (examTypes.length > 0) {
        filterTicketIds = examTypes.map((t: any) => t.id)
      }
    }

    const ticketMap = new Map((ticketTypes || []).map((t: any) => [t.id, t.name]))

    // Try exact match on registration_number first
    let candidates: any[] = []

    const baseFilters = (q: any) => {
      let filtered = q
        .eq("event_id", event.id)
        .in("status", ["confirmed", "attended", "completed", "checked_in"])
      if (filterTicketIds && filterTicketIds.length > 0) {
        filtered = filtered.in("ticket_type_id", filterTicketIds)
      }
      return filtered
    }

    // Search by registration_number (exact)
    const { data: byRegNo } = await baseFilters(
      db.from("registrations").select("*").eq("registration_number", trimmedQuery)
    )
    if (byRegNo && byRegNo.length > 0) {
      candidates = byRegNo
    }

    // Search by checkin_token (exact)
    if (candidates.length === 0) {
      const { data: byToken } = await baseFilters(
        db.from("registrations").select("*").eq("checkin_token", trimmedQuery)
      )
      if (byToken && byToken.length > 0) {
        candidates = byToken
      }
    }

    // Search by name (ilike)
    if (candidates.length === 0) {
      const { data: byName } = await baseFilters(
        db.from("registrations").select("*").ilike("attendee_name", `%${trimmedQuery}%`)
      ).limit(10)
      if (byName && byName.length > 0) {
        candidates = byName
      }
    }

    const mapped = candidates.map((r: any) => ({
      id: r.id,
      attendee_name: r.attendee_name,
      registration_number: r.registration_number,
      ticket_type_name: ticketMap.get(r.ticket_type_id) || null,
      exam_marks: r.exam_marks,
      exam_result: r.exam_result,
      exam_total_marks: r.exam_total_marks,
      checked_in: r.checked_in,
    }))

    return NextResponse.json({
      event: { id: event.id, name: event.name },
      examination: {
        exam_type: examination.exam_type,
        pass_marks: examination.pass_marks,
        mark_columns: examination.mark_columns,
      },
      candidates: mapped,
    })
  } catch (error) {
    console.error("Error in GET /api/examination/examiner:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/examination/examiner - Save marks
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, registration_id, marks, remarks } = body

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    if (!registration_id) {
      return NextResponse.json({ error: "registration_id is required" }, { status: 400 })
    }

    if (!marks || typeof marks !== "object") {
      return NextResponse.json({ error: "marks object is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    const db = supabase as any

    const result = await validateToken(db, token)
    if (!result) {
      return NextResponse.json({ error: "Invalid examiner token" }, { status: 401 })
    }

    const { examination } = result

    // Calculate total from mark columns only
    let total = 0
    const cleanMarks: Record<string, number | null> = {}
    for (const col of examination.mark_columns) {
      const val = marks[col.key]
      const numVal = val !== null && val !== undefined && val !== "" ? Number(val) : null
      cleanMarks[col.key] = numVal
      if (numVal !== null) {
        total += numVal
      }
    }

    // Add remarks if provided
    if (remarks) {
      cleanMarks.remarks = remarks
    }

    // Determine pass/fail
    const examResult = total >= examination.pass_marks ? "pass" : "fail"

    // Fetch existing exam_marks to preserve non-exam fields (like fillout_link, amasi_number)
    const { data: existing } = await db
      .from("registrations")
      .select("exam_marks")
      .eq("id", registration_id)
      .single()

    const existingMarks = existing?.exam_marks || {}
    const mergedMarks = { ...existingMarks, ...cleanMarks }

    const { data, error } = await db
      .from("registrations")
      .update({
        exam_marks: mergedMarks,
        exam_total_marks: total,
        exam_result: examResult,
      })
      .eq("id", registration_id)
      .select()
      .single()

    if (error) {
      console.error("Error saving marks:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      registration: {
        id: data.id,
        attendee_name: data.attendee_name,
        registration_number: data.registration_number,
        exam_marks: data.exam_marks,
        exam_result: data.exam_result,
        exam_total_marks: data.exam_total_marks,
      },
    })
  } catch (error) {
    console.error("Error in POST /api/examination/examiner:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
