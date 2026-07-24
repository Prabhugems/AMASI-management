import { createAdminClient } from "@/lib/supabase/server"
import { getApiUser } from "@/lib/auth/api-auth"
import { sendEmail, isEmailEnabled } from "@/lib/email"
import { COMPANY_CONFIG } from "@/lib/config"
import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"
import { sendWithheldNotifications, sendPassNotifications } from "@/lib/services/exam-emails"

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function generateFailEmail(name: string, venue: string) {
  const cleanName = name.replace(/^(dr\.?\s*)/i, "").trim()

  return `
<div style="font-family: 'Georgia', serif; max-width: 650px; margin: 0 auto; padding: 40px 30px; color: #1a1a1a; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #1a5276; margin: 0; font-size: 22px;">${COMPANY_CONFIG.fullName}</h2>
    <p style="color: #666; font-size: 13px; margin: 5px 0 0;">${COMPANY_CONFIG.name}</p>
  </div>

  <p>Dear <strong>Dr. ${cleanName},</strong></p>

  <p>Greetings from ${COMPANY_CONFIG.name}.</p>

  <p>We regret to inform you that you have not succeeded in the Fellowship examination held at <strong>${venue}</strong>.</p>

  <p>Please use the course attendance certificate to get exemption from the Examination fee during your next appearance.</p>

  <p>We encourage you to continue your preparation and wish you the very best for your future attempts.</p>

  <p style="margin-top: 25px;">
    Sincerely,<br/>
    <strong>Dr. Roshan Shetty A</strong><br/>
    Secretary
  </p>
</div>`
}

// POST /api/examination/send-pass-email
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "bulk")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  try {
    const { error: authError } = await getApiUser()
    if (authError) return authError

    if (!isEmailEnabled()) {
      return NextResponse.json({ error: "Email not configured" }, { status: 500 })
    }

    const { event_id, registration_ids, type = "pass" } = await request.json()
    if (!event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data: eventRow } = await db
      .from("events")
      .select("city")
      .eq("id", event_id)
      .maybeSingle()
    const venue = eventRow?.city || "the examination venue"

    if (type === "withheld") {
      const result = await sendWithheldNotifications(db, event_id, { registrationIds: registration_ids })
      return NextResponse.json(result)
    }

    if (type === "fail") {
      let query = db
        .from("registrations")
        .select("id, attendee_name, attendee_email, exam_result, exam_marks")
        .eq("event_id", event_id)
        .eq("exam_result", "fail")

      if (registration_ids?.length) query = query.in("id", registration_ids)

      const { data: regs, error } = await query
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const eligible = (regs || []).filter((r: any) => r.attendee_email && !r.exam_marks?.email_sent_fail)
      const skipped = (regs || []).filter((r: any) => !r.attendee_email).length
      const alreadySentFail = (regs || []).filter((r: any) => r.attendee_email && r.exam_marks?.email_sent_fail).length
      let sent = 0
      let failedCount = 0
      const errors: string[] = []

      for (const r of eligible) {
        const html = generateFailEmail(r.attendee_name, venue)
        const result = await sendEmail({
          to: r.attendee_email,
          subject: "FMAS Examination Result",
          html,
        })
        if (result.success) {
          sent++
          const marks = r.exam_marks || {}
          marks.email_sent_fail = new Date().toISOString()
          await db.from("registrations").update({ exam_marks: marks }).eq("id", r.id)
        } else { failedCount++; errors.push(`${r.attendee_name}: ${result.error}`) }
        await delay(250)
      }

      return NextResponse.json({ sent, failed: failedCount, skipped, alreadySent: alreadySentFail, total: (regs || []).length, errors })
    }

    // Send pass emails
    const result = await sendPassNotifications(db, event_id, registration_ids)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error sending pass emails:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
