/**
 * Unified WhatsApp send helper with Qikchat → Gallabox fallback.
 *
 * Send order:
 *  1. Try Qikchat if QIKCHAT_API_KEY is set.
 *  2. If Qikchat returns a synchronous failure AND Gallabox is configured,
 *     retry the same message via Gallabox.
 *  3. If Qikchat is not configured at all, send directly via Gallabox.
 *
 * Note: this only catches **synchronous** Qikchat failures (HTTP error or
 * `result.status !== true`). Qikchat can also accept a message and later
 * mark it failed asynchronously — those rejections only surface via the
 * polling sync route and are not retried here.
 */
import { isQikchatEnabled, sendQikchatTemplate, sendQikchatText } from "@/lib/qikchat"
import { isGallaboxEnabled, sendGallaboxTemplate, sendGallaboxText } from "@/lib/gallabox"

export type WhatsAppProvider = "qikchat" | "gallabox"

export interface WhatsAppSendResult {
  success: boolean
  messageId?: string
  provider?: WhatsAppProvider
  error?: string
  fallback?: boolean
  qikchatError?: string
}

export async function sendWhatsAppTemplate(
  phone: string,
  recipientName: string,
  templateName: string,
  bodyValues: Record<string, string>
): Promise<WhatsAppSendResult> {
  const qikchatEnabled = isQikchatEnabled()
  const gallaboxEnabled = isGallaboxEnabled()
  if (!qikchatEnabled && !gallaboxEnabled) {
    return { success: false, error: "No WhatsApp provider configured" }
  }

  if (qikchatEnabled) {
    const params = Object.values(bodyValues)
    const primary = await sendQikchatTemplate(phone, templateName, params)
    if (primary.success) {
      return { success: true, messageId: primary.messageId, provider: "qikchat" }
    }
    if (!gallaboxEnabled) {
      return { success: false, error: primary.error, provider: "qikchat" }
    }
    const fallback = await sendGallaboxTemplate(phone, recipientName, templateName, bodyValues)
    if (fallback.success) {
      return {
        success: true,
        messageId: fallback.messageId,
        provider: "gallabox",
        fallback: true,
        qikchatError: primary.error,
      }
    }
    return {
      success: false,
      provider: "gallabox",
      fallback: true,
      qikchatError: primary.error,
      error: `qikchat: ${primary.error || "unknown"}; gallabox: ${fallback.error || "unknown"}`,
    }
  }

  const only = await sendGallaboxTemplate(phone, recipientName, templateName, bodyValues)
  return {
    success: only.success,
    messageId: only.messageId,
    error: only.error,
    provider: "gallabox",
  }
}

export async function sendWhatsAppText(
  phone: string,
  recipientName: string,
  text: string
): Promise<WhatsAppSendResult> {
  const qikchatEnabled = isQikchatEnabled()
  const gallaboxEnabled = isGallaboxEnabled()
  if (!qikchatEnabled && !gallaboxEnabled) {
    return { success: false, error: "No WhatsApp provider configured" }
  }

  if (qikchatEnabled) {
    const primary = await sendQikchatText(phone, text)
    if (primary.success) {
      return { success: true, messageId: primary.messageId, provider: "qikchat" }
    }
    if (!gallaboxEnabled) {
      return { success: false, error: primary.error, provider: "qikchat" }
    }
    const fallback = await sendGallaboxText(phone, recipientName, text)
    if (fallback.success) {
      return {
        success: true,
        messageId: fallback.messageId,
        provider: "gallabox",
        fallback: true,
        qikchatError: primary.error,
      }
    }
    return {
      success: false,
      provider: "gallabox",
      fallback: true,
      qikchatError: primary.error,
      error: `qikchat: ${primary.error || "unknown"}; gallabox: ${fallback.error || "unknown"}`,
    }
  }

  const only = await sendGallaboxText(phone, recipientName, text)
  return {
    success: only.success,
    messageId: only.messageId,
    error: only.error,
    provider: "gallabox",
  }
}
