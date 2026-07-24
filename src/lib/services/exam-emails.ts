import { sendEmail } from "@/lib/email"
import { syncRegistrationToAirtable } from "@/lib/services/airtable-sync"
import { COMPANY_CONFIG } from "@/lib/config"

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function generatePassEmail(name: string, convocationNumber: string, formLink: string) {
  const cleanName = name.replace(/^(dr\.?\s*)/i, "").trim()

  const html = `
<div style="font-family: 'Georgia', serif; max-width: 650px; margin: 0 auto; padding: 40px 30px; color: #1a1a1a; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #1a5276; margin: 0; font-size: 22px;">${COMPANY_CONFIG.fullName}</h2>
    <p style="color: #666; font-size: 13px; margin: 5px 0 0;">${COMPANY_CONFIG.name}</p>
  </div>

  <p>Dear <strong>Dr. ${cleanName},</strong></p>

  <p>Greetings from ${COMPANY_CONFIG.name}.</p>

  <p>I am writing to inform you that you have <strong>successfully passed</strong> your FMAS examination. On behalf of the ${COMPANY_CONFIG.fullName} (${COMPANY_CONFIG.name}), I extend my heartfelt congratulations to you on this impressive accomplishment.</p>

  <p>As a mark of your hard work, dedication, and academic excellence, we would like to invite you to attend the upcoming convocation ceremony on <strong>27th August 2026 at Biswa Bangla Convention Centre, Kolkata, India.</strong></p>

  <p>The convocation ceremony is a momentous occasion where we celebrate the achievements of our graduates and formally confer your degree.</p>

  <p>We believe that your attendance at the convocation ceremony will be a memorable experience for you, your family, and the entire academic community. It is an opportunity for you to celebrate your accomplishments, reflect on your academic journey, and recognise the efforts of your mentors, professors, and peers.</p>

  <p>Please note that you will receive a formal invitation with all the details, including the dress code, instructions for registering for the ceremony, and other relevant information. We kindly request that you keep an eye out for the invitation in your mailbox and ensure that you respond by the deadline mentioned.</p>

  <p>Once again, congratulations on your outstanding achievement, and we look forward to seeing you at the convocation ceremony.</p>

  <p style="margin-top: 25px;">
    Sincerely,<br/>
    <strong>Dr. Roshan Shetty A</strong><br/>
    Secretary
  </p>

  <hr style="border: none; border-top: 2px solid #1a5276; margin: 30px 0;" />

  <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; font-weight: bold; width: 180px;">NAME</td>
        <td style="padding: 8px 0;">Dr. ${cleanName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Convocation Number</td>
        <td style="padding: 8px 0; font-family: monospace; font-size: 16px; color: #1a5276;"><strong>${convocationNumber}</strong></td>
      </tr>
    </table>
  </div>

  <div style="text-align: center; margin: 25px 0;">
    <a href="${formLink}" style="display: inline-block; background: #1a5276; color: #ffffff; text-decoration: none; padding: 14px 35px; border-radius: 6px; font-weight: bold; font-size: 15px;">Click to fill your Convocation Form</a>
  </div>

  <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin-top: 20px;">
    <p style="margin: 0; font-size: 14px;"><strong>AMASICON 2026 SPECIAL OFFER:</strong> Your registered email will grant a discount of ₹1,000 — valid for one registration only.</p>
  </div>

  <div style="text-align: center; margin-top: 20px;">
    <a href="https://v0-faq-redraft.vercel.app/" style="color: #1a5276; font-size: 14px;">Frequently Asked Questions</a>
  </div>
</div>`

  return html
}

export function generateWithheldEmail(name: string) {
  const cleanName = name.replace(/^(dr\.?\s*)/i, "").trim()

  return `
<div style="font-family: 'Georgia', serif; max-width: 650px; margin: 0 auto; padding: 40px 30px; color: #1a1a1a; line-height: 1.8;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #1a5276; margin: 0; font-size: 22px;">${COMPANY_CONFIG.fullName}</h2>
    <p style="color: #666; font-size: 13px; margin: 5px 0 0;">${COMPANY_CONFIG.name}</p>
  </div>

  <p>Dear <strong>Dr. ${cleanName},</strong></p>

  <p>Greetings from ${COMPANY_CONFIG.name}.</p>

  <p>For the FMAS Examination, <strong>${COMPANY_CONFIG.name} Membership is mandatory</strong>.</p>

  <p>To obtain your ${COMPANY_CONFIG.name} Membership Number, please click the link below and apply accordingly:</p>

  <div style="text-align: center; margin: 25px 0;">
    <a href="${COMPANY_CONFIG.website}" style="display: inline-block; background: #1a5276; color: #ffffff; text-decoration: none; padding: 14px 35px; border-radius: 6px; font-weight: bold; font-size: 15px;">Apply for ${COMPANY_CONFIG.name} Membership</a>
  </div>

  <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0;">
    <p style="margin: 0; font-size: 14px;"><strong>Note:</strong> Gynaecologists should apply as <strong>Associate Life Membership</strong>.</p>
  </div>

  <p><strong>Your result will be declared only after your ${COMPANY_CONFIG.name} Membership Number is confirmed.</strong></p>

  <p style="margin-top: 25px;">
    With regards,<br/>
    <strong>${COMPANY_CONFIG.name} Head Office</strong>
  </p>
</div>`
}

export interface EmailBatchResult {
  sent: number
  failed: number
  skipped: number
  alreadySent: number
  total: number
  errors: string[]
}

/**
 * Send (or resend) the withheld-membership notification to candidates still
 * marked `exam_result = 'withheld'`. Without `includeReminders`, this matches
 * the original manual-trigger behavior exactly (first send only) — the cron
 * passes `includeReminders: true` so candidates still withheld after
 * `reminderIntervalDays` get nudged again, repeating every interval until
 * they resolve (membership found, or someone intervenes manually).
 */
export async function sendWithheldNotifications(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  eventId: string,
  opts: { registrationIds?: string[]; includeReminders?: boolean; reminderIntervalDays?: number } = {}
): Promise<EmailBatchResult> {
  const { registrationIds, includeReminders = false, reminderIntervalDays = 5 } = opts

  let query = db
    .from("registrations")
    .select("id, attendee_name, attendee_email, exam_result, exam_marks")
    .eq("event_id", eventId)
    .eq("exam_result", "withheld")

  if (registrationIds?.length) query = query.in("id", registrationIds)

  const { data: regs, error } = await query
  if (error) throw new Error(error.message)

  const reminderCutoff = Date.now() - reminderIntervalDays * 24 * 60 * 60 * 1000

  const isDue = (r: { exam_marks?: { email_sent_withheld?: string } }) => {
    const lastSent = r.exam_marks?.email_sent_withheld
    if (!lastSent) return true
    if (!includeReminders) return false
    return new Date(lastSent).getTime() <= reminderCutoff
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eligible = (regs || []).filter((r: any) => r.attendee_email && isDue(r))
  const skipped = (regs || []).filter((r: any) => !r.attendee_email).length
  const alreadySent = (regs || []).length - eligible.length - skipped

  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const r of eligible) {
    const html = generateWithheldEmail(r.attendee_name)
    const result = await sendEmail({
      to: r.attendee_email,
      subject: `${COMPANY_CONFIG.name} Membership Required - FMAS Examination Result`,
      html,
    })
    if (result.success) {
      sent++
      const marks = r.exam_marks || {}
      marks.email_sent_withheld = new Date().toISOString()
      await db.from("registrations").update({ exam_marks: marks }).eq("id", r.id)
    } else {
      failed++
      errors.push(`${r.attendee_name}: ${result.error}`)
    }
    await delay(250)
  }

  return { sent, failed, skipped, alreadySent, total: (regs || []).length, errors }
}

/**
 * Send the pass-result email to candidates who are eligible: exam_result is
 * pass/without_exam, a convocation_number has been assigned, and an Airtable
 * fillout_link exists (or can be created now). Candidates missing a
 * convocation_number are silently skipped — that's assigned separately by an
 * admin, not something this can create.
 */
export async function sendPassNotifications(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  eventId: string,
  registrationIds?: string[]
): Promise<EmailBatchResult & { synced: number }> {
  let query = db
    .from("registrations")
    .select("id, attendee_name, attendee_email, attendee_phone, convocation_number, exam_marks, exam_result, ticket_type_id")
    .eq("event_id", eventId)
    .in("exam_result", ["pass", "without_exam"])
    .not("convocation_number", "is", null)

  if (registrationIds?.length) query = query.in("id", registrationIds)

  const { data: regs, error } = await query
  if (error) throw new Error(error.message)

  // Retry Airtable sync for registrations missing fillout_link
  const missingLink = (regs || []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => r.convocation_number && r.attendee_email && !r.exam_marks?.fillout_link && !r.exam_marks?.email_sent_pass
  )
  let synced = 0
  for (const r of missingLink) {
    try {
      const link = await syncRegistrationToAirtable(r, db)
      if (link) {
        const { data: updated } = await db
          .from("registrations")
          .select("exam_marks")
          .eq("id", r.id)
          .single()
        if (updated?.exam_marks) {
          r.exam_marks = updated.exam_marks
          synced++
        }
      }
    } catch (e) {
      console.error(`Airtable retry sync failed for ${r.attendee_name}:`, e)
    }
    await delay(200)
  }

  const eligible = (regs || []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => r.convocation_number && r.exam_marks?.fillout_link && r.attendee_email && !r.exam_marks?.email_sent_pass
  )
  const skipped = (regs || []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => !r.convocation_number || !r.exam_marks?.fillout_link || !r.attendee_email
  ).length

  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const r of eligible) {
    // Set flag BEFORE sending to prevent duplicates if process crashes after send
    const marks = { ...r.exam_marks }
    marks.email_sent_pass = new Date().toISOString()
    await db.from("registrations").update({ exam_marks: marks }).eq("id", r.id)

    const html = generatePassEmail(r.attendee_name, r.convocation_number, r.exam_marks.fillout_link)
    const result = await sendEmail({
      to: r.attendee_email,
      subject: "Congratulations! You have passed your FMAS Examination",
      html,
    })

    if (result.success) {
      sent++
    } else {
      failed++
      marks.email_sent_pass = null
      await db.from("registrations").update({ exam_marks: marks }).eq("id", r.id)
      errors.push(`${r.attendee_name}: ${result.error}`)
    }
    await delay(250)
  }

  return { sent, failed, skipped, alreadySent: (regs || []).length - eligible.length - skipped, total: (regs || []).length, errors, synced }
}
