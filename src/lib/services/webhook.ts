/**
 * Custom Webhook Service
 * Send messages/data to external webhook URLs
 */

import crypto from "crypto"

export interface WebhookConfig {
  url: string
  secret?: string
  headers?: Record<string, string>
}

export interface SendResult {
  success: boolean
  statusCode?: number
  response?: any
  error?: string
}

export interface WebhookPayload {
  event_type: string
  event_id?: string
  registration_id?: string
  recipient?: {
    name: string
    email?: string
    phone?: string
  }
  message?: {
    subject?: string
    body: string
    channel: string
  }
  metadata?: Record<string, any>
  timestamp: string
}

/**
 * Send data to a webhook URL
 */
export async function sendWebhook(
  config: WebhookConfig,
  payload: WebhookPayload
): Promise<SendResult> {
  if (!config.url) {
    return { success: false, error: "Webhook URL is required" }
  }

  // Prepare headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "AMASI-Communications/1.0",
    ...config.headers,
  }

  // Add timestamp to payload
  const fullPayload = {
    ...payload,
    timestamp: payload.timestamp || new Date().toISOString(),
  }

  const bodyString = JSON.stringify(fullPayload)

  // Add signature if secret is provided
  if (config.secret) {
    const signature = generateSignature(bodyString, config.secret)
    headers["X-Webhook-Signature"] = signature
    headers["X-Webhook-Signature-256"] = `sha256=${signature}`
  }

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers,
      body: bodyString,
    })

    let responseBody: any = null
    try {
      responseBody = await response.json()
    } catch {
      // Response may not be JSON
      try {
        responseBody = await response.text()
      } catch {
        // Ignore if we can't read the body
      }
    }

    return {
      success: response.ok,
      statusCode: response.status,
      response: responseBody,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Webhook request failed",
    }
  }
}

/**
 * Generate HMAC-SHA256 signature
 */
function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex")
}

/**
 * Verify incoming webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateSignature(payload, secret)

  // Handle both "sha256=xxx" format and raw signature
  const cleanSignature = signature.startsWith("sha256=")
    ? signature.slice(7)
    : signature

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(cleanSignature)
  )
}

/**
 * Build a standard webhook payload for communication events
 */
export function buildCommunicationPayload(
  eventType: "message.sent" | "message.delivered" | "message.failed" | "message.read",
  data: {
    eventId?: string
    registrationId?: string
    recipientName: string
    recipientEmail?: string
    recipientPhone?: string
    channel: "email" | "whatsapp" | "sms"
    subject?: string
    messageBody: string
    messageId?: string
    error?: string
  }
): WebhookPayload {
  return {
    event_type: eventType,
    event_id: data.eventId,
    registration_id: data.registrationId,
    recipient: {
      name: data.recipientName,
      email: data.recipientEmail,
      phone: data.recipientPhone,
    },
    message: {
      subject: data.subject,
      body: data.messageBody,
      channel: data.channel,
    },
    metadata: {
      message_id: data.messageId,
      error: data.error,
    },
    timestamp: new Date().toISOString(),
  }
}

/**
 * Test webhook connectivity
 */
export async function testWebhook(config: WebhookConfig): Promise<SendResult> {
  return sendWebhook(config, {
    event_type: "webhook.test",
    timestamp: new Date().toISOString(),
    metadata: {
      test: true,
      message: "This is a test webhook from AMASI Communications Hub",
    },
  })
}
