import { createClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/email"
import { isGallaboxEnabled, sendGallaboxText } from "@/lib/gallabox"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()

type TriggerType = "on_registration" | "on_payment" | "on_checkin" | "on_certificate_ready" | "days_before_event"

interface TriggerContext {
  event_id: string
  registration_id?: string
  recipient_email: string
  recipient_phone?: string
  recipient_name: string
  // Additional context for variable replacement
  registration_number?: string
  ticket_type?: string
  amount?: number
  event_name?: string
  event_date?: string
  venue?: string
  session_name?: string
  session_date?: string
  session_time?: string
}

// Get templates that should be auto-sent for a trigger
async function getAutoSendTemplates(eventId: string, triggerType: TriggerType, triggerValue?: number) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  let query = supabase
    .from("message_templates")
    .select("*")
    .eq("event_id", eventId)
    .eq("auto_send", true)
    .eq("trigger_type", triggerType)
    .eq("is_active", true)

  if (triggerValue !== undefined) {
    query = query.eq("trigger_value", triggerValue)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching auto-send templates:", error)
    return []
  }

  return data || []
}

// Replace template variables with actual values
function replaceVariables(text: string, context: TriggerContext): string {
  if (!text) return text

  return text
    .replace(/\{\{name\}\}/gi, context.recipient_name || "")
    .replace(/\{\{registration_id\}\}/gi, context.registration_number || "")
    .replace(/\{\{event_name\}\}/gi, context.event_name || "")
    .replace(/\{\{event_date\}\}/gi, context.event_date || "")
    .replace(/\{\{venue\}\}/gi, context.venue || "")
    .replace(/\{\{ticket_type\}\}/gi, context.ticket_type || "")
    .replace(/\{\{amount\}\}/gi, context.amount?.toString() || "")
    .replace(/\{\{session_name\}\}/gi, context.session_name || "")
    .replace(/\{\{session_date\}\}/gi, context.session_date || "")
    .replace(/\{\{session_time\}\}/gi, context.session_time || "")
}

// Log message to database
async function logMessage(
  eventId: string,
  registrationId: string | undefined,
  templateId: string,
  channel: string,
  recipient: string,
  recipientName: string,
  subject: string | null,
  messageBody: string,
  status: string,
  providerMessageId?: string,
  errorMessage?: string
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  await supabase.from("message_logs").insert({
    event_id: eventId,
    registration_id: registrationId,
    template_id: templateId,
    channel,
    recipient,
    recipient_name: recipientName,
    subject,
    message_body: messageBody,
    status,
    provider_message_id: providerMessageId,
    error_message: errorMessage,
    sent_at: status === "sent" ? new Date().toISOString() : null,
  })
}

// Send email using template
async function sendTemplateEmail(
  template: any,
  context: TriggerContext
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const subject = replaceVariables(template.email_subject, context)
  const body = replaceVariables(template.email_body, context)

  try {
    const result = await sendEmail({
      to: context.recipient_email,
      subject,
      text: body,
      html: body.replace(/\n/g, "<br>"),
    })

    if (result.success) {
      return { success: true, messageId: result.id }
    } else {
      return { success: false, error: result.error }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Main function to trigger auto-send messages
export async function triggerAutoSend(
  triggerType: TriggerType,
  context: TriggerContext,
  triggerValue?: number
): Promise<{ sent: number; failed: number; templates: string[] }> {
  const templates = await getAutoSendTemplates(context.event_id, triggerType, triggerValue)

  if (templates.length === 0) {
    return { sent: 0, failed: 0, templates: [] }
  }

  let sent = 0
  let failed = 0
  const processedTemplates: string[] = []

  for (const template of templates) {
    processedTemplates.push(template.name)

    // Handle different channels
    const channels = template.channel === "all" ? ["email", "whatsapp", "sms"] : [template.channel]

    for (const channel of channels) {
      if (channel === "email" && context.recipient_email && template.email_subject) {
        const result = await sendTemplateEmail(template, context)

        await logMessage(
          context.event_id,
          context.registration_id,
          template.id,
          "email",
          context.recipient_email,
          context.recipient_name,
          replaceVariables(template.email_subject, context),
          replaceVariables(template.email_body, context),
          result.success ? "sent" : "failed",
          result.messageId,
          result.error
        )

        if (result.success) {
          sent++
        } else {
          failed++
        }
      }

      if (channel === "whatsapp" && context.recipient_phone && template.message_body) {
        const waMessage = replaceVariables(template.message_body, context)

        if (isGallaboxEnabled()) {
          const waResult = await sendGallaboxText(
            context.recipient_phone,
            context.recipient_name,
            waMessage
          )

          await logMessage(
            context.event_id,
            context.registration_id,
            template.id,
            "whatsapp",
            context.recipient_phone,
            context.recipient_name,
            null,
            waMessage,
            waResult.success ? "sent" : "failed",
            waResult.messageId,
            waResult.error
          )

          if (waResult.success) {
            sent++
          } else {
            failed++
          }
        } else {
          // Gallabox not configured — log as pending
          await logMessage(
            context.event_id,
            context.registration_id,
            template.id,
            "whatsapp",
            context.recipient_phone,
            context.recipient_name,
            null,
            waMessage,
            "pending"
          )
        }
      }

      if (channel === "sms" && context.recipient_phone && template.message_body) {
        await logMessage(
          context.event_id,
          context.registration_id,
          template.id,
          "sms",
          context.recipient_phone,
          context.recipient_name,
          null,
          replaceVariables(template.message_body, context),
          "pending" // Will be sent when SMS is configured
        )
      }
    }
  }

  console.log(`[AutoSend] ${triggerType}: Sent ${sent}, Failed ${failed}, Templates: ${processedTemplates.join(", ")}`)

  return { sent, failed, templates: processedTemplates }
}

// Convenience functions for specific triggers
export async function onRegistration(context: TriggerContext) {
  return triggerAutoSend("on_registration", context)
}

export async function onPayment(context: TriggerContext) {
  return triggerAutoSend("on_payment", context)
}

export async function onCheckin(context: TriggerContext) {
  return triggerAutoSend("on_checkin", context)
}

export async function onCertificateReady(context: TriggerContext) {
  return triggerAutoSend("on_certificate_ready", context)
}
