import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAccess } from "@/lib/auth/api-auth"
import { syncRegistrationToAirtable } from "@/lib/services/airtable-sync"
import { NextRequest, NextResponse } from "next/server"

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

// POST /api/examination/sync-airtable - Create missing Airtable convocation records for one event
export async function POST(request: NextRequest) {
  try {
    const { event_id } = await request.json()
    if (!event_id) return NextResponse.json({ error: "event_id is required" }, { status: 400 })

    const { error: accessError } = await requireEventAccess(event_id)
    if (accessError) return accessError

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data: regsWithConv } = await db
      .from("registrations")
      .select("id, registration_number, attendee_name, attendee_email, attendee_phone, convocation_number, exam_marks, ticket_type_id")
      .eq("event_id", event_id)
      .in("exam_result", ["pass", "without_exam"])
      .not("convocation_number", "is", null)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const noFillout = (regsWithConv || []).filter((r: any) => !r.exam_marks?.fillout_link)

    let created = 0
    const errors: string[] = []

    for (const r of noFillout) {
      try {
        const link = await syncRegistrationToAirtable(r, db)
        if (link) created++
      } catch (e) {
        errors.push(`${r.attendee_name}: ${e}`)
      }
      await delay(200)
    }

    return NextResponse.json({ created, errors, total: noFillout.length })
  } catch (error) {
    console.error("Error in POST /api/examination/sync-airtable:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
