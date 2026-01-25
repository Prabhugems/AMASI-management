/**
 * SMS Service Layer
 * Supports multiple providers: Twilio, MSG91, TextLocal
 */

export type SMSProvider = "twilio" | "msg91" | "textlocal"

export interface SMSConfig {
  provider: SMSProvider
  // Twilio
  accountSid?: string
  authToken?: string
  phoneNumber?: string
  // MSG91
  apiKey?: string
  senderId?: string
  route?: string // 1=Promotional, 4=Transactional
  // TextLocal
  // apiKey is shared, senderId is shared
}

export interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface SMSMessage {
  to: string // Phone number with country code
  message: string
}

/**
 * Send SMS using configured provider
 */
export async function sendSMS(
  config: SMSConfig,
  message: SMSMessage
): Promise<SendResult> {
  switch (config.provider) {
    case "twilio":
      return sendViaTwilio(config, message)
    case "msg91":
      return sendViaMSG91(config, message)
    case "textlocal":
      return sendViaTextLocal(config, message)
    default:
      return { success: false, error: "Unknown provider" }
  }
}

/**
 * Send via Twilio SMS API
 */
async function sendViaTwilio(
  config: SMSConfig,
  message: SMSMessage
): Promise<SendResult> {
  if (!config.accountSid || !config.authToken || !config.phoneNumber) {
    return { success: false, error: "Missing Twilio credentials" }
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`

  const formData = new URLSearchParams()
  formData.append("From", config.phoneNumber)
  formData.append("To", message.to.startsWith("+") ? message.to : "+" + message.to)
  formData.append("Body", message.message)

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
        error: result.message || "Failed to send SMS",
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Send via MSG91 API
 */
async function sendViaMSG91(
  config: SMSConfig,
  message: SMSMessage
): Promise<SendResult> {
  if (!config.apiKey || !config.senderId) {
    return { success: false, error: "Missing MSG91 credentials" }
  }

  const url = "https://control.msg91.com/api/v5/flow/"

  // Format phone (remove + for MSG91)
  const formattedPhone = message.to.replace(/^\+/, "")

  // MSG91 uses flow-based API for transactional messages
  const body = {
    flow_id: config.route || "default", // You'd typically have a flow ID
    sender: config.senderId,
    mobiles: formattedPhone,
    VAR1: message.message, // Variable replacement
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authkey: config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const result = await response.json()

    if (response.ok && result.type === "success") {
      return { success: true, messageId: result.request_id }
    } else {
      return {
        success: false,
        error: result.message || "Failed to send SMS",
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Alternative MSG91 - Simple Send API (for quick messages)
 */
export async function sendViaMSG91Simple(
  config: SMSConfig,
  message: SMSMessage
): Promise<SendResult> {
  if (!config.apiKey || !config.senderId) {
    return { success: false, error: "Missing MSG91 credentials" }
  }

  const formattedPhone = message.to.replace(/^\+/, "")
  const route = config.route || "4" // Default to transactional

  const url = new URL("https://api.msg91.com/api/v2/sendsms")
  url.searchParams.set("authkey", config.apiKey)
  url.searchParams.set("mobiles", formattedPhone)
  url.searchParams.set("message", message.message)
  url.searchParams.set("sender", config.senderId)
  url.searchParams.set("route", route)
  url.searchParams.set("country", "91") // Default to India

  try {
    const response = await fetch(url.toString(), { method: "GET" })
    const result = await response.json()

    if (response.ok && result.type === "success") {
      return { success: true, messageId: result.request_id }
    } else {
      return {
        success: false,
        error: result.message || "Failed to send SMS",
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Send via TextLocal API
 */
async function sendViaTextLocal(
  config: SMSConfig,
  message: SMSMessage
): Promise<SendResult> {
  if (!config.apiKey || !config.senderId) {
    return { success: false, error: "Missing TextLocal credentials" }
  }

  const url = "https://api.textlocal.in/send/"

  // Format phone (remove + for TextLocal, add 91 prefix if not present)
  let formattedPhone = message.to.replace(/^\+/, "")
  if (!formattedPhone.startsWith("91")) {
    formattedPhone = "91" + formattedPhone
  }

  const formData = new URLSearchParams()
  formData.append("apikey", config.apiKey)
  formData.append("numbers", formattedPhone)
  formData.append("message", message.message)
  formData.append("sender", config.senderId)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    })

    const result = await response.json()

    if (result.status === "success") {
      return { success: true, messageId: result.batch_id }
    } else {
      return {
        success: false,
        error: result.errors?.[0]?.message || "Failed to send SMS",
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Check if SMS is configured
 */
export function isSMSConfigured(config: SMSConfig): boolean {
  switch (config.provider) {
    case "twilio":
      return !!(config.accountSid && config.authToken && config.phoneNumber)
    case "msg91":
      return !!(config.apiKey && config.senderId)
    case "textlocal":
      return !!(config.apiKey && config.senderId)
    default:
      return false
  }
}

/**
 * Get SMS character count and segment info
 */
export function getSMSInfo(message: string): {
  charCount: number
  segments: number
  maxChars: number
  isGSM: boolean
} {
  // GSM 7-bit charset check (simplified)
  const gsmChars = /^[\x20-\x7E\n\r]*$/
  const isGSM = gsmChars.test(message)

  const charCount = message.length
  const maxChars = isGSM ? 160 : 70
  const multipartMax = isGSM ? 153 : 67

  let segments = 1
  if (charCount > maxChars) {
    segments = Math.ceil(charCount / multipartMax)
  }

  return { charCount, segments, maxChars, isGSM }
}
