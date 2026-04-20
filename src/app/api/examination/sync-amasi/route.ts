import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAccess } from "@/lib/auth/api-auth"
import { NextRequest, NextResponse } from "next/server"

const AMASI_API = "https://application.amasi.org/api/member_detail_data"

// Lookup member from live AMASI API
async function lookupAmasiMember(emailOrPhone: string): Promise<{
  amasi_number: number | null
  name: string | null
  phone: string | null
  email: string | null
} | null> {
  try {
    const formData = new FormData()
    formData.append("email_or_phone", emailOrPhone)

    const res = await fetch(AMASI_API, { method: "POST", body: formData })
    const data = await res.json()

    if (data.status && data.data?.length > 0) {
      const member = data.data[0]
      return {
        amasi_number: member.membership_no || null,
        name: [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(" "),
        phone: member.mobile || null,
        email: member.email || null,
      }
    }
    return null
  } catch {
    return null
  }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// POST /api/examination/sync-amasi - Sync AMASI numbers using live AMASI API
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
    let memberUpdated = 0
    let notFound = 0
    const notFoundList: string[] = []

    for (const r of regs || []) {
      // Try email first, then phone
      let member = r.attendee_email ? await lookupAmasiMember(r.attendee_email) : null

      if (!member && r.attendee_phone) {
        const phone = String(r.attendee_phone).replace(/[^0-9]/g, "").slice(-10)
        if (phone.length === 10) {
          member = await lookupAmasiMember(phone)
        }
      }

      if (member?.amasi_number) {
        const marks = r.exam_marks || {}
        marks.amasi_number = member.amasi_number

        const updateData: any = { exam_marks: marks }

        // Fill missing phone from AMASI record
        if (!r.attendee_phone && member.phone) {
          updateData.attendee_phone = member.phone
          phoneFilled++
        }

        await db.from("registrations").update(updateData).eq("id", r.id)

        // Also upsert to local members table
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
          memberUpdated++
        }

        matched++
      } else {
        notFound++
        notFoundList.push(r.attendee_email || "no-email")
      }

      // Rate limit: ~2 requests per second to be safe
      await delay(500)
    }

    return NextResponse.json({
      matched,
      phoneFilled,
      memberUpdated,
      notFound,
      notFoundEmails: notFoundList,
      total: (regs || []).length,
    })
  } catch (error) {
    console.error("Error in POST /api/examination/sync-amasi:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
