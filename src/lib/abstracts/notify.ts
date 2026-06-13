// Centralised send-and-log for abstract-lifecycle notifications.
//
// Both committee-decision and submit-abstract route through this helper, so
// the "insert intent row + send email + bump status" sequence lives in ONE
// place and can't drift. The pre-Phase-3 audit found 5 routes inserting
// abstract_notifications rows without ever sending — this helper exists so
// the next route to grow that need can't make the same mistake.
//
// Contract:
//   - Renders a template if one is configured for the event, otherwise uses
//     the caller-supplied fallback HTML.
//   - Calls sendEmail() (gated externally — caller checks isEmailEnabled
//     and the per-event setting like notify_on_decision / notify_on_submission).
//   - Inserts a row in abstract_notifications carrying the actual delivery
//     state (sent | failed | pending). The row IS the record of delivery —
//     callers don't need to update it after.
//   - Returns { delivered, error? } so the caller can decide whether to bump
//     decision_notified_at. Send failure NEVER throws — it returns delivered:false.
//   - The caller's own DB write (the abstract update) is NOT rolled back if
//     send fails. That's the Phase 3 wrapping rule.

import { sendEmail } from "@/lib/email"
import { renderEmailTemplate, type TemplateType, type TemplateVariables } from "@/lib/email-templates"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

export type AbstractNotifyInput = {
  supabase: AnySupabase
  abstractId: string
  eventId: string
  recipientEmail: string
  recipientName: string | null
  templateType: TemplateType
  // The notification_type stored on the ledger row. Often the same as
  // templateType but not always (e.g. submission_confirmation has no template).
  notificationType: string
  templateVariables: TemplateVariables
  fallbackSubject: string
  fallbackHtml: string
  metadata?: Record<string, unknown>
  sentBy?: string | null
}

export type AbstractNotifyResult = {
  delivered: boolean
  error?: string
  notificationId?: string | null
}

export async function sendAndLogAbstractNotification(
  input: AbstractNotifyInput
): Promise<AbstractNotifyResult> {
  const {
    supabase,
    abstractId,
    eventId,
    recipientEmail,
    recipientName,
    templateType,
    notificationType,
    templateVariables,
    fallbackSubject,
    fallbackHtml,
    metadata,
    sentBy,
  } = input

  if (!recipientEmail) {
    return { delivered: false, error: "missing recipient email" }
  }

  let subject = fallbackSubject
  let htmlBody = fallbackHtml

  // Try event-scoped template; fall back to the caller's fallback HTML if
  // no template is configured. Template rendering itself never throws.
  try {
    const rendered = await renderEmailTemplate(templateType, templateVariables, eventId)
    if (rendered) {
      subject = rendered.subject
      htmlBody = rendered.body_html
    }
  } catch (err) {
    console.error("[notify-abstract] Template render failed; using fallback", err)
  }

  let sendResult: { success: boolean; id?: string; error?: string }
  try {
    sendResult = await sendEmail({ to: recipientEmail, subject, html: htmlBody })
  } catch (err) {
    sendResult = {
      success: false,
      error: err instanceof Error ? err.message : "send threw unexpectedly",
    }
  }

  const nowIso = new Date().toISOString()
  const ledgerRow: Record<string, unknown> = {
    abstract_id: abstractId,
    notification_type: notificationType,
    recipient_email: recipientEmail.toLowerCase(),
    recipient_name: recipientName,
    subject,
    body_preview: htmlBody.substring(0, 500).replace(/<[^>]*>/g, ""),
    metadata: {
      ...(metadata ?? {}),
      event_id: eventId,
      provider_id: sendResult.id ?? null,
      send_error: sendResult.success ? null : sendResult.error ?? "unknown",
    },
    delivery_status: sendResult.success ? "sent" : "failed",
    sent_by: sentBy ?? null,
  }
  if (sendResult.success) {
    ledgerRow.sent_at = nowIso
  }

  // Insert the ledger row. If the insert itself fails (e.g. RLS, schema
  // drift), don't throw — return delivered=false with the send error
  // preserved so the caller's decision/abstract write stays intact.
  let notificationId: string | null = null
  try {
    const { data, error } = await supabase
      .from("abstract_notifications")
      .insert(ledgerRow)
      .select("id")
      .single()
    if (error) {
      console.error("[notify-abstract] Ledger insert failed", error)
    } else {
      notificationId = data?.id ?? null
    }
  } catch (err) {
    console.error("[notify-abstract] Ledger insert threw", err)
  }

  return {
    delivered: sendResult.success,
    error: sendResult.success ? undefined : sendResult.error,
    notificationId,
  }
}
