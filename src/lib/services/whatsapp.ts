/**
 * WhatsApp Service Layer
 * Supports multiple providers: Meta Business API, Twilio, Interakt, Wati
 */

export type WhatsAppProvider = "meta" | "twilio" | "interakt" | "wati"

export interface WhatsAppConfig {
  provider: WhatsAppProvider
  // Meta API
  phoneNumberId?: string
  businessAccountId?: string
  accessToken?: string
  // Twilio
  accountSid?: string
  authToken?: string
  phoneNumber?: string
  // Interakt / Wati
  apiKey?: string
}

export interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface WhatsAppMessage {
  to: string // Phone number with country code (e.g., +919876543210)
  message?: string // For text messages
  templateName?: string // For template messages
  templateParams?: string[] // Template parameters
  language?: string // Template language code
}

/**
 * Send WhatsApp message using configured provider
 */
export async function sendWhatsAppMessage(
  config: WhatsAppConfig,
  message: WhatsAppMessage
): Promise<SendResult> {
  switch (config.provider) {
    case "meta":
      return sendViaMeta(config, message)
    case "twilio":
      return sendViaTwilio(config, message)
    case "interakt":
      return sendViaInterakt(config, message)
    case "wati":
      return sendViaWati(config, message)
    default:
      return { success: false, error: "Unknown provider" }
  }
}

/**
 * Send via Meta WhatsApp Business API
 */
async function sendViaMeta(
  config: WhatsAppConfig,
  message: WhatsAppMessage
): Promise<SendResult> {
  if (!config.phoneNumberId || !config.accessToken) {
    return { success: false, error: "Missing Meta API credentials" }
  }

  const url = `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`

  // Format phone number (remove + if present for Meta API)
  const formattedPhone = message.to.replace(/^\+/, "")

  let body: any

  if (message.templateName) {
    // Template message
    body = {
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: "template",
      template: {
        name: message.templateName,
        language: { code: message.language || "en" },
        components: message.templateParams
          ? [
              {
                type: "body",
                parameters: message.templateParams.map((p) => ({
                  type: "text",
                  text: p,
                })),
              },
            ]
          : undefined,
      },
    }
  } else {
    // Text message
    body = {
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: "text",
      text: { body: message.message },
    }
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const result = await response.json()

    if (response.ok && result.messages?.[0]?.id) {
      return { success: true, messageId: result.messages[0].id }
    } else {
      return {
        success: false,
        error: result.error?.message || "Failed to send message",
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Send via Twilio WhatsApp API
 */
async function sendViaTwilio(
  config: WhatsAppConfig,
  message: WhatsAppMessage
): Promise<SendResult> {
  if (!config.accountSid || !config.authToken || !config.phoneNumber) {
    return { success: false, error: "Missing Twilio credentials" }
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`

  // Format numbers for Twilio (whatsapp:+1234567890)
  const from = `whatsapp:${config.phoneNumber}`
  const to = `whatsapp:${message.to.startsWith("+") ? message.to : "+" + message.to}`

  const formData = new URLSearchParams()
  formData.append("From", from)
  formData.append("To", to)

  if (message.templateName) {
    // Twilio uses Content SID for templates
    formData.append("ContentSid", message.templateName)
    if (message.templateParams) {
      formData.append("ContentVariables", JSON.stringify(
        Object.fromEntries(message.templateParams.map((p, i) => [`${i + 1}`, p]))
      ))
    }
  } else {
    formData.append("Body", message.message || "")
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    })

    const result = await response.json()

    if (response.ok && result.sid) {
      return { success: true, messageId: result.sid }
    } else {
      return {
        success: false,
        error: result.message || "Failed to send message",
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Send via Interakt API
 */
async function sendViaInterakt(
  config: WhatsAppConfig,
  message: WhatsAppMessage
): Promise<SendResult> {
  if (!config.apiKey) {
    return { success: false, error: "Missing Interakt API key" }
  }

  const url = "https://api.interakt.ai/v1/public/message/"

  // Format phone (remove + for Interakt)
  const formattedPhone = message.to.replace(/^\+/, "")

  const body: any = {
    countryCode: formattedPhone.substring(0, 2),
    phoneNumber: formattedPhone.substring(2),
    callbackData: "communications_hub",
    type: message.templateName ? "Template" : "Text",
  }

  if (message.templateName) {
    body.template = {
      name: message.templateName,
      languageCode: message.language || "en",
      bodyValues: message.templateParams || [],
    }
  } else {
    body.data = { message: message.message }
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const result = await response.json()

    if (response.ok && result.id) {
      return { success: true, messageId: result.id }
    } else {
      return {
        success: false,
        error: result.message || "Failed to send message",
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Send via Wati API
 */
async function sendViaWati(
  config: WhatsAppConfig,
  message: WhatsAppMessage
): Promise<SendResult> {
  if (!config.apiKey) {
    return { success: false, error: "Missing Wati API key" }
  }

  // Wati uses a different endpoint structure
  const baseUrl = "https://live-server.wati.io/api/v1"

  // Format phone (remove + for Wati)
  const formattedPhone = message.to.replace(/^\+/, "")

  let url: string
  let body: any

  if (message.templateName) {
    url = `${baseUrl}/sendTemplateMessage`
    body = {
      whatsappNumber: formattedPhone,
      template_name: message.templateName,
      broadcast_name: "communications_hub",
      parameters: message.templateParams?.map((p, i) => ({
        name: `${i + 1}`,
        value: p,
      })) || [],
    }
  } else {
    url = `${baseUrl}/sendSessionMessage/${formattedPhone}`
    body = { messageText: message.message }
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const result = await response.json()

    if (response.ok && result.result) {
      return { success: true, messageId: result.messageId || result.id }
    } else {
      return {
        success: false,
        error: result.message || "Failed to send message",
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Check if WhatsApp is configured
 */
export function isWhatsAppConfigured(config: WhatsAppConfig): boolean {
  switch (config.provider) {
    case "meta":
      return !!(config.phoneNumberId && config.accessToken)
    case "twilio":
      return !!(config.accountSid && config.authToken && config.phoneNumber)
    case "interakt":
    case "wati":
      return !!config.apiKey
    default:
      return false
  }
}
