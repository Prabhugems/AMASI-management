import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAccess } from "@/lib/auth/api-auth"
import { lookupAmasiMember } from "@/lib/services/amasi-member-lookup"
import { NextRequest, NextResponse } from "next/server"

// POST /api/examination/check-withheld - Check membership for withheld candidates only
export async function POST(request: NextRequest) {
  try {
    const { event_id } = await request.json()
    if (!event_id) return NextResponse.json({ error: "event_id is required" }, { status: 400 })

    const { error: accessError } = await requireEventAccess(event_id)
    if (accessError) return accessError

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Only fetch withheld candidates
    const { data: regs } = await db
      .from("registrations")
      .select("id, attendee_name, attendee_email, attendee_phone, exam_marks, exam_result")
      .eq("event_id", event_id)
      .eq("exam_result", "withheld")

    if (!regs?.length) {
      return NextResponse.json({ declared: 0, stillWithheld: 0, total: 0, details: [] })
    }

    let declared = 0
    const stillWithheld: string[] = []
    const declaredList: string[] = []

    for (const r of regs) {
      const member = await lookupAmasiMember(
        { email: r.attendee_email, phone: r.attendee_phone },
        db,
      )

      if (member?.amasi_number) {
        const marks = r.exam_marks || {}
        marks.amasi_number = member.amasi_number

        const updateData: any = {
          exam_result: "pass",
          exam_marks: marks,
        }

        if (!r.attendee_phone && member.phone) {
          updateData.attendee_phone = member.phone
        }

        await db.from("registrations").update(updateData).eq("id", r.id)

        declaredList.push(`${r.attendee_name} → AMASI ${member.amasi_number} → PASS`)
        declared++
      } else {
        stillWithheld.push(r.attendee_name)
      }
    }

    return NextResponse.json({
      declared,
      stillWithheld: stillWithheld.length,
      total: regs.length,
      declaredList,
      stillWithheldList: stillWithheld,
    })
  } catch (error) {
    console.error("Error checking withheld:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
