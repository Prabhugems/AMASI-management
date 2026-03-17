import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail, isEmailEnabled } from "@/lib/email"
import { NextRequest, NextResponse } from "next/server"

function generateReminderEmail(name: string, convocationNumber: string, formLink: string) {
  const cleanName = name.replace(/^(dr\.?\s*)/i, "").trim()

  return `
<div style="font-family: 'Georgia', serif; max-width: 650px; margin: 0 auto; padding: 40px 30px; color: #1a1a1a; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #1a5276; margin: 0; font-size: 22px;">Association of Minimal Access Surgeons of India</h2>
    <p style="color: #666; font-size: 13px; margin: 5px 0 0;">AMASI</p>
  </div>

  <div style="background: #dc2626; color: white; text-align: center; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-weight: bold; font-size: 15px;">
    URGENT REMINDER - FMAS Certificate Details
  </div>

  <p>Dear <strong>Dr. ${cleanName},</strong></p>

  <p>Greetings from AMASI.</p>

  <p>We have noticed that you have <strong>not yet updated your details</strong> in our system.</p>

  <div style="text-align: center; margin: 25px 0;">
    <a href="${formLink}" style="display: inline-block; background: #7c3aed; color: #ffffff; text-decoration: none; padding: 14px 35px; border-radius: 6px; font-weight: bold; font-size: 15px;">Fill the Form Here</a>
  </div>

  <div style="background: #fef2f2; border: 1px solid #dc2626; border-radius: 8px; padding: 15px; margin: 20px 0;">
    <p style="margin: 0 0 8px; font-weight: bold; color: #dc2626;">Important:</p>
    <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
      <li style="margin-bottom: 6px;">Your certificate name cannot be corrected after the deadline. Any spelling errors will remain as-is.</li>
      <li style="margin-bottom: 6px;">Your dispatch address is mandatory — without it, your FMAS certificate will <strong>NOT be dispatched</strong> and will remain at the AMASI Head Office.</li>
      <li>This is also required for your convocation registration.</li>
    </ul>
  </div>

  <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
    <p style="margin: 0; font-size: 14px;"><strong>Convocation Number:</strong> ${convocationNumber}</p>
  </div>

  <p>Kindly complete this today itself to avoid any issues.</p>

  <p>For queries, feel free to reach out.</p>

  <p style="margin-top: 25px;">
    Thank you &amp; regards,<br/>
    <strong>AMASI Secretariat</strong>
  </p>
</div>`
}

// GET /api/examination/send-address-reminder - Cron endpoint (no auth needed for cron)
// POST /api/examination/send-address-reminder - Manual trigger (auth required)
export async function GET() {
  return handleReminder()
}

export async function POST(request: NextRequest) {
  // Allow manual trigger with auth or cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    // Cron trigger - OK
  } else {
    // Check user auth
    const { getApiUser } = await import("@/lib/auth/api-auth")
    const user = await getApiUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  return handleReminder()
}

async function handleReminder() {
  try {
    if (!isEmailEnabled()) {
      return NextResponse.json({ error: "Email not configured" }, { status: 500 })
    }

    const supabase = await createAdminClient()
    const db = supabase as any

    // Get all passed candidates with fillout link but no address filled
    // (convocation_address is null = not filled yet)
    const { data: regs } = await db
      .from("registrations")
      .select("id, attendee_name, attendee_email, convocation_number, exam_marks, convocation_address, exam_result")
      .eq("exam_result", "pass")
      .not("convocation_number", "is", null)
      .is("convocation_address", null)

    const eligible = (regs || []).filter(
      (r: any) => r.exam_marks?.fillout_link && r.attendee_email
    )

    let sent = 0
    let failed = 0

    for (const r of eligible) {
      const cleanName = r.attendee_name?.replace(/^(dr\.?\s*)/i, "").trim()
      const html = generateReminderEmail(cleanName, r.convocation_number, r.exam_marks.fillout_link)

      const result = await sendEmail({
        to: r.attendee_email,
        subject: "Reminder: Fill your FMAS Certificate Dispatch Form",
        html,
      })

      if (result.success) sent++
      else failed++
    }

    return NextResponse.json({
      sent,
      failed,
      total: eligible.length,
      message: `Sent ${sent} reminders to candidates who haven't filled the address form`,
    })
  } catch (error) {
    console.error("Error sending address reminders:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
