import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail, isEmailEnabled } from "@/lib/email"
import { sendWhatsAppMessage, WhatsAppConfig } from "@/lib/services/whatsapp"
import { sendSMS, SMSConfig } from "@/lib/services/sms"
import { sendWebhook, buildCommunicationPayload } from "@/lib/services/webhook"
import { COMPANY_CONFIG } from "@/lib/config"
import { requireEventAccess } from "@/lib/auth/api-auth"
import { escapeHtml } from "@/lib/string-utils"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

interface SendRequest {
  event_id: string
  channel: "email" | "whatsapp" | "sms"
  recipient_ids: string[]
  subject?: string
  message: string
  template_id?: string
}

// POST /api/communications/send
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "bulk")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  try {
    const body: SendRequest = await request.json()
    const { event_id, channel, recipient_ids, subject, message, template_id } = body

    if (!event_id || !channel || !recipient_ids || recipient_ids.length === 0 || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const { error: authError } = await requireEventAccess(event_id)
    if (authError) return authError

    const supabase = await createAdminClient()

    // Get event details
    const { data: event } = await (supabase as any)
      .from("events")
      .select("id, name, short_name")
      .eq("id", event_id)
      .single()

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Get communication settings
    const { data: settings } = await (supabase as any)
      .from("communication_settings")
      .select("*")
      .eq("event_id", event_id)
      .maybeSingle()

    // Get registrations
    const { data: registrations } = await (supabase as any)
      .from("registrations")
      .select("id, attendee_name, attendee_email, attendee_phone")
      .in("id", recipient_ids)
      .eq("event_id", event_id)

    if (!registrations || registrations.length === 0) {
      return NextResponse.json({ error: "No recipients found" }, { status: 404 })
    }

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    }

    // Process each recipient
    for (const reg of registrations) {
      // Personalize message
      const safeName = escapeHtml(reg.attendee_name || "")
      const personalizedMessage = message.replace(/\{\{name\}\}/gi, safeName)
      const personalizedSubject = subject?.replace(/\{\{name\}\}/gi, safeName)

      let sendResult: { success: boolean; messageId?: string; error?: string } = { success: false }
      let recipient = ""

      try {
        switch (channel) {
          case "email":
            recipient = reg.attendee_email
            if (!recipient) {
              results.failed++
              results.errors.push(`${reg.attendee_name}: No email address`)
              continue
            }

            // Build email HTML
            const emailHtml = buildEmailHtml(event, personalizedMessage)

            if (settings?.email_provider && settings.email_provider !== "default" && settings.email_api_key) {
              // Use event-specific email settings
              // For now, fall back to default - could implement per-event provider later
              sendResult = await sendEmail({
                to: recipient,
                subject: personalizedSubject || `Message from ${event.short_name || event.name}`,
                html: emailHtml,
              })
            } else if (isEmailEnabled()) {
              sendResult = await sendEmail({
                to: recipient,
                subject: personalizedSubject || `Message from ${event.short_name || event.name}`,
                html: emailHtml,
              })
            } else {
              // Dev mode
              sendResult = { success: true, messageId: `dev-${Date.now()}` }
              console.log(`[DEV] Would send email to ${recipient}`)
            }
            break

          case "whatsapp":
            recipient = reg.attendee_phone
            if (!recipient) {
              results.failed++
              results.errors.push(`${reg.attendee_name}: No phone number`)
              continue
            }

            if (settings?.whatsapp_provider) {
              // Validate required fields based on provider
              const provider = settings.whatsapp_provider
              if (provider === "meta" && (!settings.whatsapp_phone_number_id || !settings.whatsapp_access_token)) {
                results.failed++
                results.errors.push(`${reg.attendee_name}: WhatsApp Meta provider not configured (missing phone_number_id or access_token)`)
                continue
              }
              if (provider === "twilio" && (!settings.twilio_account_sid || !settings.twilio_auth_token || !settings.twilio_phone_number)) {
                results.failed++
                results.errors.push(`${reg.attendee_name}: WhatsApp Twilio provider not configured`)
                continue
              }

              const whatsappConfig: WhatsAppConfig = {
                provider: settings.whatsapp_provider,
                phoneNumberId: settings.whatsapp_phone_number_id,
                businessAccountId: settings.whatsapp_business_account_id,
                accessToken: settings.whatsapp_access_token,
                accountSid: settings.twilio_account_sid,
                authToken: settings.twilio_auth_token,
                phoneNumber: settings.twilio_phone_number,
                apiKey: settings.whatsapp_api_key,
              }

              sendResult = await sendWhatsAppMessage(whatsappConfig, {
                to: recipient,
                message: personalizedMessage,
              })
            } else {
              // Dev mode
              sendResult = { success: true, messageId: `dev-wa-${Date.now()}` }
              console.log(`[DEV] Would send WhatsApp to ${recipient}`)
            }
            break

          case "sms":
            recipient = reg.attendee_phone
            if (!recipient) {
              results.failed++
              results.errors.push(`${reg.attendee_name}: No phone number`)
              continue
            }

            if (settings?.sms_provider) {
              // Validate required fields based on provider
              const smsProvider = settings.sms_provider
              if (smsProvider === "twilio" && (!settings.twilio_account_sid || !settings.twilio_auth_token || !settings.twilio_phone_number)) {
                results.failed++
                results.errors.push(`${reg.attendee_name}: SMS Twilio provider not configured`)
                continue
              }
              if ((smsProvider === "msg91" || smsProvider === "textlocal") && !settings.sms_api_key) {
                results.failed++
                results.errors.push(`${reg.attendee_name}: SMS provider ${smsProvider} not configured (missing api_key)`)
                continue
              }

              const smsConfig: SMSConfig = {
                provider: settings.sms_provider,
                accountSid: settings.twilio_account_sid,
                authToken: settings.twilio_auth_token,
                phoneNumber: settings.twilio_phone_number,
                apiKey: settings.sms_api_key,
                senderId: settings.sms_sender_id,
              }

              sendResult = await sendSMS(smsConfig, {
                to: recipient,
                message: personalizedMessage,
              })
            } else {
              // Dev mode
              sendResult = { success: true, messageId: `dev-sms-${Date.now()}` }
              console.log(`[DEV] Would send SMS to ${recipient}`)
            }
            break
        }

        if (sendResult.success) {
          results.sent++

          // Log message
          await (supabase as any).from("message_logs").insert({
            event_id,
            registration_id: reg.id,
            template_id: template_id || null,
            channel,
            provider: channel === "email"
              ? (settings?.email_provider || "default")
              : channel === "whatsapp"
              ? settings?.whatsapp_provider
              : settings?.sms_provider,
            recipient,
            recipient_name: reg.attendee_name,
            subject: personalizedSubject,
            message_body: personalizedMessage,
            status: "sent",
            provider_message_id: sendResult.messageId,
            sent_at: new Date().toISOString(),
          })

          // Send to webhook if enabled
          if (settings?.webhook_enabled && settings.webhook_url) {
            const webhookPayload = buildCommunicationPayload("message.sent", {
              eventId: event_id,
              registrationId: reg.id,
              recipientName: reg.attendee_name,
              recipientEmail: reg.attendee_email,
              recipientPhone: reg.attendee_phone,
              channel,
              subject: personalizedSubject,
              messageBody: personalizedMessage,
              messageId: sendResult.messageId,
            })

            // Fire and forget webhook
            sendWebhook(
              { url: settings.webhook_url, secret: settings.webhook_secret, headers: settings.webhook_headers },
              webhookPayload
            ).catch((err) => console.error("Webhook error:", err))
          }
        } else {
          results.failed++
          results.errors.push(`${recipient}: ${sendResult.error}`)

          // Log failed message
          await (supabase as any).from("message_logs").insert({
            event_id,
            registration_id: reg.id,
            template_id: template_id || null,
            channel,
            recipient,
            recipient_name: reg.attendee_name,
            subject: personalizedSubject,
            message_body: personalizedMessage,
            status: "failed",
            error_message: sendResult.error,
            failed_at: new Date().toISOString(),
          })
        }
      } catch (err: any) {
        results.failed++
        results.errors.push(`${reg.attendee_name}: ${err.message}`)
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    console.error("Error in POST /api/communications/send:", error)
    return NextResponse.json({ error: "Failed to send messages" }, { status: 500 })
  }
}

function buildEmailHtml(event: any, message: string): string {
  return `
    <!DOCTYPE html>
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
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">${escapeHtml(event.short_name || event.name || "")}</h1>
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="background-color: white; padding: 30px;">
                  <div style="color: #1f2937; font-size: 15px; line-height: 1.8; white-space: pre-wrap;">${escapeHtml(message || "")}</div>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background-color: #1f2937; padding: 20px 30px; border-radius: 0 0 16px 16px; text-align: center;">
                  <p style="color: #6b7280; margin: 0; font-size: 12px;">
                    &copy; ${new Date().getFullYear()} ${COMPANY_CONFIG.name}. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}
