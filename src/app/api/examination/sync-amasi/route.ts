import { createAdminClient } from "@/lib/supabase/server"
import { getApiUser } from "@/lib/auth/api-auth"
import { NextRequest, NextResponse } from "next/server"

// POST /api/examination/sync-amasi - Sync AMASI numbers for exam registrations
export async function POST(request: NextRequest) {
  try {
    const user = await getApiUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { event_id } = await request.json()
    if (!event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Get exam registrations
    const { data: regs } = await db
      .from("registrations")
      .select("id, attendee_email, attendee_phone")
      .eq("event_id", event_id)
      .in("status", ["confirmed", "attended", "completed", "checked_in"])

    // Fetch all members (paginated to handle >1000)
    let allMembers: any[] = []
    let from = 0
    const pageSize = 1000
    while (true) {
      const { data: batch } = await db
        .from("members")
        .select("email, phone, amasi_number")
        .range(from, from + pageSize - 1)
      if (!batch || batch.length === 0) break
      allMembers = allMembers.concat(batch)
      if (batch.length < pageSize) break
      from += pageSize
    }

    // Build lookup maps
    const memberByEmail = new Map<string, { amasi_number: number; phone: string | null }>()
    const memberByPhone = new Map<string, { amasi_number: number; email: string | null }>()
    for (const m of allMembers) {
      const emailKey = m.email?.toLowerCase()?.trim()
      const phoneKey = m.phone ? String(m.phone).replace(/[^0-9]/g, "").slice(-10) : ""
      if (emailKey) {
        memberByEmail.set(emailKey, { amasi_number: m.amasi_number, phone: m.phone ? String(m.phone) : null })
      }
      if (phoneKey.length === 10 && m.amasi_number) {
        memberByPhone.set(phoneKey, { amasi_number: m.amasi_number, email: m.email || null })
      }
    }

    // Match and update registrations (AMASI number + fill missing phone)
    let matched = 0
    let phoneFilled = 0
    let notFound = 0
    const notFoundList: string[] = []

    for (const r of regs || []) {
      const email = r.attendee_email?.toLowerCase()?.trim()
      let member = email ? memberByEmail.get(email) : undefined

      // Try phone if email didn't match
      if (!member && r.attendee_phone) {
        const phone = String(r.attendee_phone).replace(/[^0-9]/g, "").slice(-10)
        if (phone.length === 10) {
          const byPhone = memberByPhone.get(phone)
          if (byPhone) member = { amasi_number: byPhone.amasi_number, phone: null }
        }
      }

      if (member?.amasi_number) {
        // Store amasi_number in exam_marks
        const { data: reg } = await db
          .from("registrations")
          .select("exam_marks")
          .eq("id", r.id)
          .single()

        const marks = reg?.exam_marks || {}
        marks.amasi_number = member.amasi_number

        const updateData: any = { exam_marks: marks }

        // Fill missing phone from member record
        if (!r.attendee_phone && member.phone) {
          updateData.attendee_phone = member.phone
          phoneFilled++
        }

        await db
          .from("registrations")
          .update(updateData)
          .eq("id", r.id)

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
