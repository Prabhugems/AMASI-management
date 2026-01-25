/**
 * Webhooks for external integrations (Boost.space, Zapier, Make, etc.)
 * Sends event data to configured webhook URLs
 */

type WebhookEvent =
  | "registration.created"
  | "registration.updated"
  | "speaker.responded"
  | "speaker.travel_submitted"
  | "speaker.invitation_sent"
  | "booking.created"
  | "booking.updated"

type WebhookPayload = {
  event: WebhookEvent
  timestamp: string
  data: Record<string, any>
}

/**
 * Send data to a webhook URL
 */
async function sendWebhook(url: string, payload: WebhookPayload): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": payload.event,
        "X-Webhook-Timestamp": payload.timestamp,
      },
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      console.log(`[Webhook] Sent ${payload.event} to ${url}`)
      return true
    } else {
      console.error(`[Webhook] Failed ${payload.event} to ${url}: ${response.status}`)
      return false
    }
  } catch (error) {
    console.error(`[Webhook] Error sending ${payload.event}:`, error)
    return false
  }
}

/**
 * Get webhook URLs from environment
 * Format: WEBHOOK_URL_1, WEBHOOK_URL_2, etc. or comma-separated WEBHOOK_URLS
 */
function getWebhookUrls(): string[] {
  const urls: string[] = []

  // Check for comma-separated URLs
  if (process.env.WEBHOOK_URLS) {
    urls.push(...process.env.WEBHOOK_URLS.split(",").map(u => u.trim()).filter(Boolean))
  }

  // Check for individual URLs
  for (let i = 1; i <= 5; i++) {
    const url = process.env[`WEBHOOK_URL_${i}`]
    if (url) urls.push(url)
  }

  // Boost.space specific
  if (process.env.BOOSTSPACE_WEBHOOK_URL) {
    urls.push(process.env.BOOSTSPACE_WEBHOOK_URL)
  }

  return [...new Set(urls)] // Remove duplicates
}

/**
 * Trigger webhooks for an event
 */
export async function triggerWebhook(event: WebhookEvent, data: Record<string, any>): Promise<void> {
  const urls = getWebhookUrls()

  if (urls.length === 0) {
    return // No webhooks configured
  }

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  }

  // Send to all webhook URLs in parallel
  await Promise.allSettled(urls.map(url => sendWebhook(url, payload)))
}

/**
 * Webhook trigger functions for specific events
 */

export async function webhookRegistrationCreated(registration: {
  id: string
  event_id: string
  event_name?: string
  attendee_name: string
  attendee_email: string
  attendee_phone?: string
  registration_type?: string
  created_at?: string
}) {
  await triggerWebhook("registration.created", {
    registration_id: registration.id,
    event_id: registration.event_id,
    event_name: registration.event_name,
    name: registration.attendee_name,
    email: registration.attendee_email,
    phone: registration.attendee_phone,
    type: registration.registration_type,
    registered_at: registration.created_at || new Date().toISOString(),
  })
}

export async function webhookSpeakerResponded(data: {
  registration_id: string
  event_id: string
  event_name: string
  speaker_name: string
  speaker_email: string
  response: "accepted" | "declined" | "tentative"
  sessions?: string[]
}) {
  await triggerWebhook("speaker.responded", data)
}

export async function webhookTravelSubmitted(data: {
  registration_id: string
  event_id: string
  event_name: string
  speaker_name: string
  speaker_email: string
  from_city?: string
  arrival_date?: string
  departure_date?: string
  hotel_required?: boolean
  pickup_required?: boolean
  drop_required?: boolean
}) {
  await triggerWebhook("speaker.travel_submitted", data)
}

export async function webhookBookingCreated(data: {
  registration_id: string
  event_id: string
  event_name: string
  speaker_name: string
  speaker_email: string
  booking_type: "flight" | "hotel" | "transport"
  details: Record<string, any>
}) {
  await triggerWebhook("booking.created", data)
}

/**
 * Check if webhooks are enabled
 */
export function isWebhooksEnabled(): boolean {
  return getWebhookUrls().length > 0
}
