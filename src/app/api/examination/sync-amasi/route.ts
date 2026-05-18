import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAccess } from "@/lib/auth/api-auth"
import { lookupAmasiMember } from "@/lib/services/amasi-member-lookup"
import { NextRequest, NextResponse } from "next/server"

// POST /api/examination/sync-amasi - Sync AMASI numbers from local members table
export async function POST(request: NextRequest) {
  try {
    const { event_id } = await request.json()
    if (!event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const { error: accessError } = await requireEventAccess(event_id)
    if (accessError) return accessError

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Get exam registrations
    const { data: regs } = await db
      .from("registrations")
      .select("id, attendee_email, attendee_phone, exam_marks")
      .eq("event_id", event_id)
      .in("status", ["confirmed", "attended", "completed", "checked_in"])

    let matched = 0
    let phoneFilled = 0
    let notFound = 0
    const notFoundList: string[] = []

    for (const r of regs || []) {
      const member = await lookupAmasiMember(
        { email: r.attendee_email, phone: r.attendee_phone },
        db,
      )

      if (member?.amasi_number) {
        const marks = r.exam_marks || {}
        marks.amasi_number = member.amasi_number

        const updateData: any = { exam_marks: marks }

        if (!r.attendee_phone && member.phone) {
          updateData.attendee_phone = member.phone
          phoneFilled++
        }

        await db.from("registrations").update(updateData).eq("id", r.id)
        matched++
      } else {
        notFound++
        notFoundList.push(r.attendee_email || "no-email")
      }
    }

    return NextResponse.json({
      matched,
      phoneFilled,
      notFound,
      notFoundEmails: notFoundList,
      total: (regs || []).length,
    })
  } catch (error) {
    console.error("Error in POST /api/examination/sync-amasi:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
