import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail, isEmailEnabled } from "@/lib/email"
import { syncAddressesFromFillout } from "@/lib/services/fillout-sync"
import { COMPANY_CONFIG } from "@/lib/config"
import { NextRequest, NextResponse } from "next/server"

function generateReminderEmail(name: string, convocationNumber: string, formLink: string) {
  const cleanName = name.replace(/^(dr\.?\s*)/i, "").trim()

  return `
<div style="font-family: 'Georgia', serif; max-width: 650px; margin: 0 auto; padding: 40px 30px; color: #1a1a1a; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #1a5276; margin: 0; font-size: 22px;">${COMPANY_CONFIG.fullName}</h2>
    <p style="color: #666; font-size: 13px; margin: 5px 0 0;">${COMPANY_CONFIG.name}</p>
  </div>

  <div style="background: #dc2626; color: white; text-align: center; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-weight: bold; font-size: 15px;">
    URGENT REMINDER - FMAS Certificate Details
  </div>

  <p>Dear <strong>Dr. ${cleanName},</strong></p>

  <p>Greetings from ${COMPANY_CONFIG.name}.</p>

  <p>We have noticed that you have <strong>not yet updated your details</strong> in our system.</p>

  <div style="text-align: center; margin: 25px 0;">
    <a href="${formLink}" style="display: inline-block; background: #7c3aed; color: #ffffff; text-decoration: none; padding: 14px 35px; border-radius: 6px; font-weight: bold; font-size: 15px;">Fill the Form Here</a>
  </div>

  <div style="background: #fef2f2; border: 1px solid #dc2626; border-radius: 8px; padding: 15px; margin: 20px 0;">
    <p style="margin: 0 0 8px; font-weight: bold; color: #dc2626;">Important:</p>
    <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
      <li style="margin-bottom: 6px;">Your certificate name cannot be corrected after the deadline. Any spelling errors will remain as-is.</li>
      <li style="margin-bottom: 6px;">Your dispatch address is mandatory — without it, your FMAS certificate will <strong>NOT be dispatched</strong> and will remain at the ${COMPANY_CONFIG.name} Head Office.</li>
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
    <strong>${COMPANY_CONFIG.name} Secretariat</strong>
  </p>
</div>`
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// GET /api/examination/send-address-reminder - Cron endpoint (requires CRON_SECRET)
// POST /api/examination/send-address-reminder - Manual trigger (auth required)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    // Cron trigger - OK
  } else {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return handleReminder()
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    // Cron trigger - OK
  } else {
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

    // ===== FAIL-SAFE: Sync addresses from Fillout BEFORE sending any reminders =====
    // This ensures we don't email people who already submitted their address.
    // If Fillout is unavailable, we abort entirely — better to skip reminders than send false ones.
    let totalSynced = 0
    try {
      // Get all active exam events
      const { data: eventSettings } = await db
        .from("event_settings")
        .select("event_id")
        .eq("enable_examination", true)

      const eventIds = (eventSettings || []).map((s: any) => s.event_id)

      for (const eventId of eventIds) {
        const syncResult = await syncAddressesFromFillout({ eventId })
        totalSynced += syncResult.synced
        console.log(`[send-address-reminder] Pre-sync for event ${eventId}: synced=${syncResult.synced}, notFilled=${syncResult.notFilled}`)
      }
    } catch (syncError) {
      // FAIL CLOSED: Cannot verify who already submitted → send zero emails
      console.error("[send-address-reminder] Fillout sync failed, aborting reminder run:", syncError)
      return NextResponse.json({
        error: "Cannot verify Fillout submissions — aborting to prevent false reminders",
        detail: String(syncError),
        sent: 0,
        aborted: true,
      }, { status: 503 })
    }

    // Now query candidates who STILL have no address after sync
    const { data: regs } = await db
      .from("registrations")
      .select("id, attendee_name, attendee_email, convocation_number, exam_marks, convocation_address, exam_result")
      .in("exam_result", ["pass", "without_exam"])
      .not("convocation_number", "is", null)
      .is("convocation_address", null)

    // Filter: must have fillout_link, email, and not sent a reminder in the last 3 days
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000
    const now = Date.now()

    const eligible = (regs || []).filter((r: any) => {
      if (!r.exam_marks?.fillout_link || !r.attendee_email) return false
      const lastReminder = r.exam_marks?.last_reminder_sent
      if (lastReminder && (now - new Date(lastReminder).getTime()) < THREE_DAYS_MS) return false
      return true
    })

    const skipped = (regs || []).length - eligible.length
    let sent = 0
    let failed = 0
    const errors: string[] = []

    for (const r of eligible) {
      // Set flag BEFORE sending to prevent duplicates if process crashes after send
      const marks = { ...r.exam_marks }
      marks.last_reminder_sent = new Date().toISOString()
      marks.reminder_count = (marks.reminder_count || 0) + 1
      await db.from("registrations").update({ exam_marks: marks }).eq("id", r.id)

      const cleanName = r.attendee_name?.replace(/^(dr\.?\s*)/i, "").trim()
      const html = generateReminderEmail(cleanName, r.convocation_number, r.exam_marks.fillout_link)

      const result = await sendEmail({
        to: r.attendee_email,
        subject: "Reminder: Fill your FMAS Certificate Dispatch Form",
        html,
      })

      if (result.success) {
        sent++
      } else {
        failed++
        errors.push(`${r.attendee_name}: ${result.error}`)
      }
      await delay(250)
    }

    return NextResponse.json({
      addressesSyncedBeforeSending: totalSynced,
      sent,
      failed,
      skipped,
      total: eligible.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Pre-synced ${totalSynced} addresses, then sent ${sent} reminders to candidates who haven't filled the address form`,
    })
  } catch (error) {
    console.error("Error sending address reminders:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
