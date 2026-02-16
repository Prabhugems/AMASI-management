/**
 * Gallabox WhatsApp API Helper
 * Global helper for sending WhatsApp messages via Gallabox.
 * Uses environment variables for configuration.
 *
 * API Docs: https://docs.gallabox.com
 */

const GALLABOX_API_URL = "https://server.gallabox.com/devapi/messages/whatsapp"

function getApiKey(): string {
  return (process.env.GALLABOX_API_KEY || "").trim()
}

function getApiSecret(): string {
  return (process.env.GALLABOX_API_SECRET || "").trim()
}

function getChannelId(): string {
  return (process.env.GALLABOX_CHANNEL_ID || "").trim()
}

/**
 * Check if Gallabox is configured via environment variables
 */
export function isGallaboxEnabled(): boolean {
  return !!(getApiKey() && getApiSecret() && getChannelId())
}

/**
 * Format phone number for Gallabox API.
 * Strips '+' prefix. Prepends '91' for 10-digit Indian numbers.
 */
export function formatPhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, "")
  if (cleaned.length === 10) {
    cleaned = "91" + cleaned
  }
  return cleaned
}

interface GallaboxResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send a template message via Gallabox
 */
export async function sendGallaboxTemplate(
  phone: string,
  recipientName: string,
  templateName: string,
  bodyValues: string[]
): Promise<GallaboxResult> {
  if (!isGallaboxEnabled()) {
    return { success: false, error: "Gallabox not configured" }
  }

  const formattedPhone = formatPhone(phone)

  const body = {
    channelId: getChannelId(),
    channelType: "whatsapp",
    recipient: {
      name: recipientName,
      phone: formattedPhone,
    },
    whatsapp: {
      type: "template",
      template: {
        templateName,
        bodyValues,
      },
    },
  }

  return callGallaboxApi(body)
}

/**
 * Send a free-form text message via Gallabox
 */
export async function sendGallaboxText(
  phone: string,
  recipientName: string,
  text: string
): Promise<GallaboxResult> {
  if (!isGallaboxEnabled()) {
    return { success: false, error: "Gallabox not configured" }
  }

  const formattedPhone = formatPhone(phone)

  const body = {
    channelId: getChannelId(),
    channelType: "whatsapp",
    recipient: {
      name: recipientName,
      phone: formattedPhone,
    },
    whatsapp: {
      type: "text",
      text: {
        body: text,
      },
    },
  }

  return callGallaboxApi(body)
}

async function callGallaboxApi(body: Record<string, unknown>): Promise<GallaboxResult> {
  try {
    const response = await fetch(GALLABOX_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apiKey: getApiKey(),
        apiSecret: getApiSecret(),
      },
      body: JSON.stringify(body),
    })

    const result = await response.json()

    if (response.ok && result.id) {
      return { success: true, messageId: result.id }
    } else {
      return {
        success: false,
        error: result.message || result.error || `Gallabox API error (${response.status})`,
      }
    }
  } catch (error: any) {
    console.error("[Gallabox] API call failed:", error.message)
    return { success: false, error: error.message }
  }
}
