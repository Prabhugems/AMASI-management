#!/usr/bin/env node
/**
 * 122 FMAS Skill Course & FMAS Exam - WhatsApp Group Setup + Email Blast
 *
 * 1. Sets whatsapp_group_url in event settings (shows in delegate portal /my)
 * 2. Sends bulk email to all registrants inviting them to join the group
 *
 * Usage:
 *   node scripts/whatsapp-group-blast.mjs              # Dry run (no emails sent)
 *   node scripts/whatsapp-group-blast.mjs --send       # Actually send emails
 *   node scripts/whatsapp-group-blast.mjs --db-only    # Only update DB settings
 */
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://jmdwxymbgxwdsmcwbahp.supabase.co"
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptZHd4eW1iZ3h3ZHNtY3diYWhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzAxMTA1NSwiZXhwIjoyMDgyNTg3MDU1fQ.rvk94RhIk7lcDonsR_dWdPL7rEzmn91tdXLChDg9b4Y"

const EVENT_ID = "9f1e659b-6809-4502-b3c1-b0a98175e813"
const WHATSAPP_URL = "https://chat.whatsapp.com/IxkpXWB3Y0p0JSGmwZlgGs"
const COURSE_MATERIALS_URL = "https://airtable.com/appWyJApPKetiAPqX/tblosJWhOw2NCGQQN/viwX5lXI1kkkALyk3"

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const args = process.argv.slice(2)
const SEND_EMAILS = args.includes("--send")
const DB_ONLY = args.includes("--db-only")

async function main() {
  console.log("=== 122 FMAS WhatsApp Group Setup ===\n")

  // Step 1: Update event settings with WhatsApp group URL
  console.log("Step 1: Updating event settings...")
  const { data: event, error: fetchErr } = await supabase
    .from("events")
    .select("id, name, short_name, settings")
    .eq("id", EVENT_ID)
    .single()

  if (fetchErr || !event) {
    console.error("Failed to fetch event:", fetchErr)
    process.exit(1)
  }

  console.log(`  Event: ${event.short_name || event.name}`)

  const currentSettings = event.settings || {}
  const newSettings = {
    ...currentSettings,
    whatsapp_group_url: WHATSAPP_URL,
    course_materials_url: COURSE_MATERIALS_URL,
  }

  const { error: updateErr } = await supabase
    .from("events")
    .update({ settings: newSettings })
    .eq("id", EVENT_ID)

  if (updateErr) {
    console.error("Failed to update settings:", updateErr)
    process.exit(1)
  }

  console.log(`  Settings updated:`)
  console.log(`    whatsapp_group_url = ${WHATSAPP_URL}`)
  console.log(`    course_materials_url = ${COURSE_MATERIALS_URL}`)
  console.log("  Delegate portal (/my) will now show WhatsApp + Course Materials cards.\n")

  if (DB_ONLY) {
    console.log("--db-only flag set. Skipping email blast.")
    process.exit(0)
  }

  // Step 2: Fetch all registrations for this event
  console.log("Step 2: Fetching registrations...")
  const { data: registrations, error: regErr } = await supabase
    .from("registrations")
    .select("id, attendee_name, attendee_email, status")
    .eq("event_id", EVENT_ID)
    .in("status", ["confirmed", "pending"])

  if (regErr || !registrations) {
    console.error("Failed to fetch registrations:", regErr)
    process.exit(1)
  }

  console.log(`  Found ${registrations.length} registrations\n`)

  if (!SEND_EMAILS) {
    console.log("=== DRY RUN (add --send to actually send emails) ===")
    console.log(`Would send email to ${registrations.length} recipients:`)
    registrations.slice(0, 10).forEach((r) => {
      console.log(`  - ${r.attendee_name} <${r.attendee_email}>`)
    })
    if (registrations.length > 10) {
      console.log(`  ... and ${registrations.length - 10} more`)
    }
    console.log("\nRun with --send to actually send.")
    process.exit(0)
  }

  // Step 3: Send emails in batches
  console.log("Step 3: Sending emails...")
  const BATCH_SIZE = 50
  let totalSent = 0
  let totalFailed = 0

  const subject = "Join the 122 FMAS WhatsApp Group"
  const eventName = event.short_name || event.name

  for (let i = 0; i < registrations.length; i += BATCH_SIZE) {
    const batch = registrations.slice(i, i + BATCH_SIZE)
    console.log(`\n  Batch ${Math.floor(i / BATCH_SIZE) + 1}: sending to ${batch.length} recipients...`)

    for (const reg of batch) {
      const message = `Dear ${reg.attendee_name},

We're excited to have you at the 122 AMASI Skill Course & FMAS Exam (March 6-8, 2026) at Meril Academy, Vapi!

Join our official WhatsApp group for real-time updates, schedule changes, and coordination:

${WHATSAPP_URL}

You can also find this link anytime in your Delegate Portal at https://collegeofmas.org.in/my

Looking forward to seeing you!

Warm regards,
AMASI Team`

      const emailHtml = buildEmailHtml(eventName, reg.attendee_email, message)

      try {
        // Use Blastable API directly (same as the app's email.ts)
        const BLASTABLE_API_KEY = process.env.BLASTABLE_API_KEY || "6e957a3c-3450-4ea2-854a-39d26e2e6529"

        const res = await fetch("https://api.blastable.io/v1/email/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${BLASTABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: { email: "noreply@collegeofmas.org.in", name: "AMASI" },
            to: [{ email: reg.attendee_email, name: reg.attendee_name }],
            subject,
            html: emailHtml,
          }),
        })

        if (res.ok) {
          totalSent++
          // Log to email_logs
          await supabase.from("email_logs").insert({
            email_type: "other",
            status: "sent",
            to_email: reg.attendee_email,
            subject,
            event_id: EVENT_ID,
            registration_id: reg.id,
            sent_at: new Date().toISOString(),
          })
        } else {
          const errText = await res.text()
          totalFailed++
          console.error(`    FAIL: ${reg.attendee_email} - ${errText}`)
        }
      } catch (err) {
        totalFailed++
        console.error(`    ERROR: ${reg.attendee_email} - ${err.message}`)
      }
    }

    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < registrations.length) {
      console.log("  Waiting 2s before next batch...")
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  console.log(`\n=== Done ===`)
  console.log(`  Sent: ${totalSent}`)
  console.log(`  Failed: ${totalFailed}`)
  console.log(`  Total: ${registrations.length}`)
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function buildEmailHtml(eventName, recipientEmail, message) {
  // Convert URLs in plain text to clickable links
  const messageWithLinks = escapeHtml(message).replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" style="color: #25D366; font-weight: bold; text-decoration: underline;">$1</a>'
  )

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">${escapeHtml(eventName)}</h1>
            </td>
          </tr>
          <tr>
            <td style="background-color: white; padding: 30px;">
              <div style="color: #1f2937; font-size: 15px; line-height: 1.8; white-space: pre-wrap;">${messageWithLinks}</div>
            </td>
          </tr>
          <tr>
            <td style="background-color: white; padding: 0 30px 30px 30px; text-align: center;">
              <a href="${WHATSAPP_URL}" style="display: inline-block; background-color: #25D366; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: bold;">
                Join WhatsApp Group
              </a>
            </td>
          </tr>
          <tr>
            <td style="background-color: #1f2937; padding: 20px 30px; border-radius: 0 0 16px 16px; text-align: center;">
              <p style="color: #9ca3af; margin: 0 0 10px 0; font-size: 12px;">
                This email was sent to ${escapeHtml(recipientEmail)}
              </p>
              <p style="color: #6b7280; margin: 0; font-size: 12px;">
                &copy; ${new Date().getFullYear()} AMASI. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
