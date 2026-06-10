/**
 * Qikchat WhatsApp API Helper
 * Alternative WhatsApp provider for sending messages.
 * Uses environment variables for configuration.
 *
 * API Docs: https://qikchat.gitbook.io/apidocs
 */

const QIKCHAT_API_URL = "https://api.qikchat.in/v1/messages"

// Approved Qikchat template names (Meta-approved in the Qikchat dashboard).
// Update here if templates are renamed — every call site reads from these constants.
export const QIKCHAT_TEMPLATE_WELCOME = "technosurg_welcome"
export const QIKCHAT_TEMPLATE_CERTIFICATE_READY = "technosurg_certificate_ready"

function getApiKey(): string {
  return (process.env.QIKCHAT_API_KEY || "").trim()
}

function getWhatsAppId(): string {
  return (process.env.QIKCHAT_WHATSAPP_ID || "").trim()
}

/**
 * Check if Qikchat is configured via environment variables
 */
export function isQikchatEnabled(): boolean {
  return !!(getApiKey())
}

/**
 * Format phone number for Qikchat API.
 * Strips '+' prefix and non-digits. Prepends '91' for 10-digit Indian numbers.
 */
export function formatPhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, "")
  if (cleaned.length === 10) {
    cleaned = "91" + cleaned
  }
  return cleaned
}

interface QikchatResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send a text message via Qikchat
 */
export async function sendQikchatText(
  phone: string,
  text: string
): Promise<QikchatResult> {
  if (!isQikchatEnabled()) {
    return { success: false, error: "Qikchat not configured" }
  }

  const formattedPhone = formatPhone(phone)

  const body = {
    to_contact: formattedPhone,
    type: "text",
    text: {
      body: text,
    },
  }

  return callQikchatApi(body)
}

/**
 * Send a template message via Qikchat
 * Parameters is an array of values for the template variables in order.
 *
 * Note: Qikchat's payload uses `language` as a plain string at the template
 * root (per https://qikchat.gitbook.io/apidocs), NOT the WhatsApp Cloud API
 * shape `language: { code: "en" }`. Sending the object form gets rejected
 * with "invalid message payload".
 */
export async function sendQikchatTemplate(
  phone: string,
  templateName: string,
  parameters: string[],
  language: string = "en"
): Promise<QikchatResult> {
  if (!isQikchatEnabled()) {
    return { success: false, error: "Qikchat not configured" }
  }

  const formattedPhone = formatPhone(phone)

  const body = {
    to_contact: formattedPhone,
    type: "template",
    template: {
      name: templateName,
      language,
      components: parameters.length > 0
        ? [
            {
              type: "body",
              parameters: parameters.map((value) => ({
                type: "text",
                text: value,
              })),
            },
          ]
        : [],
    },
  }

  return callQikchatApi(body)
}

/**
 * Fetch a message's delivery / read status from Qikchat.
 * Qikchat does NOT support webhooks for status callbacks; the only way to learn
 * whether a message was delivered or read is to poll this endpoint.
 *
 * Actual response shape (verified 2026-06-10):
 *   { status: true,                              // request success boolean
 *     message: {
 *       event: "whatsapp:message:dlr",
 *       payload: {
 *         id, contacts: [...],
 *         message: { type, status: "sent"|"delivered"|"read"|"failed",
 *                    sentAt, deliveredAt, readAt, processedAt, lastUpdatedAt }
 *       }
 *     } }
 * Parser is tolerant of older `data` / `data[0]` wrappers as a fallback.
 */
export interface QikchatMessageStatus {
  status: "sent" | "delivered" | "read" | "failed" | "unknown"
  sentAt?: string
  deliveredAt?: string
  readAt?: string
  errorMessage?: string
}

export async function getQikchatMessageStatus(
  messageId: string
): Promise<{ success: boolean; data?: QikchatMessageStatus; error?: string }> {
  if (!isQikchatEnabled()) return { success: false, error: "Qikchat not configured" }
  if (!messageId) return { success: false, error: "Missing messageId" }

  const url = `${QIKCHAT_API_URL}?msgid=${encodeURIComponent(messageId)}`
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "QIKCHAT-API-KEY": getApiKey() },
    })
    const raw = await response.json().catch(() => null)
    if (!response.ok) {
      return { success: false, error: `Qikchat status API error (${response.status})` }
    }

    const r = raw as Record<string, unknown> | null
    const messageWrap = r && typeof r === "object" ? (r.message as Record<string, unknown> | undefined) : undefined
    const payload = messageWrap && typeof messageWrap === "object"
      ? (messageWrap.payload as Record<string, unknown> | undefined)
      : undefined
    const dlrMessage = payload && typeof payload === "object"
      ? (payload.message as Record<string, unknown> | undefined)
      : undefined

    // Prefer the verified shape: message.payload.message; fall back to legacy
    // `data` / `data[0]` wrappers and finally the top-level object.
    const candidate =
      (dlrMessage && typeof dlrMessage === "object" ? dlrMessage : null) ??
      (r && Array.isArray(r.data) ? (r.data as unknown[])[0] : null) ??
      (r && "data" in (r ?? {}) ? (r as { data: unknown }).data : null) ??
      r

    if (!candidate || typeof candidate !== "object") {
      return { success: false, error: "Unrecognized response shape" }
    }
    const c = candidate as Record<string, unknown>

    const rawStatus = String((c.status ?? c.delivery_status ?? "")).toLowerCase()
    let status: QikchatMessageStatus["status"] = "unknown"
    if (rawStatus.includes("read")) status = "read"
    else if (rawStatus.includes("deliver")) status = "delivered"
    else if (rawStatus.includes("fail") || rawStatus.includes("undeliver") || rawStatus.includes("reject")) status = "failed"
    else if (rawStatus.includes("sent") || rawStatus === "accepted") status = "sent"

    const pickStr = (...keys: string[]) => {
      for (const k of keys) {
        const v = c[k]
        if (typeof v === "string" && v) return v
      }
      return undefined
    }

    return {
      success: true,
      data: {
        status,
        sentAt: pickStr("sentAt", "sent_at"),
        deliveredAt: pickStr("deliveredAt", "delivered_at"),
        readAt: pickStr("readAt", "read_at"),
        errorMessage: pickStr("errorMessage", "error_message", "reason"),
      },
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Network error" }
  }
}

async function callQikchatApi(body: Record<string, unknown>): Promise<QikchatResult> {
  try {
    const response = await fetch(QIKCHAT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "QIKCHAT-API-KEY": getApiKey(),
      },
      body: JSON.stringify(body),
    })

    const result = await response.json()

    if (response.ok && result.status === true) {
      const messageId = result.data?.[0]?.id || "sent"
      return { success: true, messageId }
    } else {
      return {
        success: false,
        error: result.message || `Qikchat API error (${response.status})`,
      }
    }
  } catch (error: any) {
    console.error("[Qikchat] API call failed:", error.message)
    return { success: false, error: error.message }
  }
}
