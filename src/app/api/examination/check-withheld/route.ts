import { createAdminClient } from "@/lib/supabase/server"
import { getApiUser } from "@/lib/auth/api-auth"
import { NextRequest, NextResponse } from "next/server"

const AMASI_API = "https://application.amasi.org/api/member_detail_data"
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function lookupMember(emailOrPhone: string) {
  try {
    const formData = new FormData()
    formData.append("email_or_phone", emailOrPhone)
    const res = await fetch(AMASI_API, { method: "POST", body: formData })
    const data = await res.json()
    if (data.status && data.data?.length > 0) {
      const m = data.data[0]
      return {
        amasi_number: m.membership_no,
        name: [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(" "),
        phone: m.mobile,
        email: m.email,
      }
    }
    return null
  } catch {
    return null
  }
}

// POST /api/examination/check-withheld - Check membership for withheld candidates only
export async function POST(request: NextRequest) {
  try {
    const user = await getApiUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { event_id } = await request.json()
    if (!event_id) return NextResponse.json({ error: "event_id is required" }, { status: 400 })

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
      let member = r.attendee_email ? await lookupMember(r.attendee_email) : null

      if (!member && r.attendee_phone) {
        const phone = String(r.attendee_phone).replace(/[^0-9]/g, "").slice(-10)
        if (phone.length === 10) member = await lookupMember(phone)
      }

      if (member?.amasi_number) {
        // Found membership — declare result as pass
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

        // Upsert to members table
        const { data: existing } = await db
          .from("members")
          .select("id")
          .eq("amasi_number", member.amasi_number)
          .maybeSingle()

        if (!existing) {
          await db.from("members").insert({
            amasi_number: member.amasi_number,
            name: member.name,
            email: member.email,
            phone: member.phone ? parseInt(member.phone.replace(/[^0-9]/g, "")) : null,
            status: "active",
          })
        }

        declaredList.push(`${r.attendee_name} → AMASI ${member.amasi_number} → PASS`)
        declared++
      } else {
        stillWithheld.push(r.attendee_name)
      }

      await delay(500) // Rate limit
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
