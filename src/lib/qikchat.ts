/**
 * Qikchat WhatsApp API Helper
 * Alternative WhatsApp provider for sending messages.
 * Uses environment variables for configuration.
 *
 * API Docs: https://qikchat.gitbook.io/apidocs
 */

const QIKCHAT_API_URL = "https://api.qikchat.in/v1/messages"

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
 * Parameters is an array of values for the template variables in order
 */
export async function sendQikchatTemplate(
  phone: string,
  templateName: string,
  parameters: string[]
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
      language: {
        code: "en",
      },
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
