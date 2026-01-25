/**
 * Analytics Tracking Utilities
 *
 * Event tracking helpers for analytics
 */

type EventProperties = Record<string, string | number | boolean | null | undefined>

/**
 * Track a custom event
 *
 * Usage:
 * ```
 * track("button_click", { button_name: "signup", page: "/home" })
 * ```
 */
export function track(eventName: string, properties?: EventProperties): void {
  // Send to analytics provider
  if (typeof window !== "undefined") {
    // Google Analytics 4
    if ((window as any).gtag) {
      (window as any).gtag("event", eventName, properties)
    }

    // Plausible
    if ((window as any).plausible) {
      (window as any).plausible(eventName, { props: properties })
    }

    // PostHog
    if ((window as any).posthog) {
      (window as any).posthog.capture(eventName, properties)
    }

    // Console log in development
    if (process.env.NODE_ENV === "development") {
      console.log("[Analytics]", eventName, properties)
    }
  }
}

/**
 * Identify a user
 */
export function identify(
  userId: string,
  traits?: Record<string, string | number | boolean>
): void {
  if (typeof window !== "undefined") {
    // PostHog
    if ((window as any).posthog) {
      (window as any).posthog.identify(userId, traits)
    }

    // Google Analytics
    if ((window as any).gtag) {
      (window as any).gtag("set", { user_id: userId })
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[Analytics] Identify", userId, traits)
    }
  }
}

/**
 * Reset user identity (on logout)
 */
export function reset(): void {
  if (typeof window !== "undefined") {
    if ((window as any).posthog) {
      (window as any).posthog.reset()
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[Analytics] Reset")
    }
  }
}

// ==================== Event Presets ====================

/**
 * Page view tracking
 */
export function trackPageView(pageName: string, properties?: EventProperties): void {
  track("page_view", { page_name: pageName, ...properties })
}

/**
 * Button click tracking
 */
export function trackButtonClick(
  buttonName: string,
  properties?: EventProperties
): void {
  track("button_click", { button_name: buttonName, ...properties })
}

/**
 * Form submission tracking
 */
export function trackFormSubmit(
  formName: string,
  success: boolean,
  properties?: EventProperties
): void {
  track("form_submit", { form_name: formName, success, ...properties })
}

/**
 * Search tracking
 */
export function trackSearch(
  query: string,
  resultsCount: number,
  properties?: EventProperties
): void {
  track("search", { query, results_count: resultsCount, ...properties })
}

/**
 * Error tracking
 */
export function trackError(
  errorType: string,
  errorMessage: string,
  properties?: EventProperties
): void {
  track("error", { error_type: errorType, error_message: errorMessage, ...properties })
}

// ==================== Event-specific Tracking ====================

export const eventTracking = {
  /**
   * Event created
   */
  eventCreated: (eventId: string, eventName: string) => {
    track("event_created", { event_id: eventId, event_name: eventName })
  },

  /**
   * Event published
   */
  eventPublished: (eventId: string, eventName: string) => {
    track("event_published", { event_id: eventId, event_name: eventName })
  },

  /**
   * Registration created
   */
  registrationCreated: (
    eventId: string,
    registrationId: string,
    ticketType?: string
  ) => {
    track("registration_created", {
      event_id: eventId,
      registration_id: registrationId,
      ticket_type: ticketType,
    })
  },

  /**
   * Payment completed
   */
  paymentCompleted: (
    eventId: string,
    registrationId: string,
    amount: number,
    currency: string = "INR"
  ) => {
    track("payment_completed", {
      event_id: eventId,
      registration_id: registrationId,
      amount,
      currency,
    })
  },

  /**
   * Check-in completed
   */
  checkInCompleted: (
    eventId: string,
    registrationId: string,
    listId?: string
  ) => {
    track("checkin_completed", {
      event_id: eventId,
      registration_id: registrationId,
      list_id: listId,
    })
  },

  /**
   * Badge printed
   */
  badgePrinted: (eventId: string, registrationId: string) => {
    track("badge_printed", {
      event_id: eventId,
      registration_id: registrationId,
    })
  },

  /**
   * Export completed
   */
  exportCompleted: (type: string, format: string, count: number) => {
    track("export_completed", { type, format, count })
  },

  /**
   * Email sent
   */
  emailSent: (type: string, recipientCount: number) => {
    track("email_sent", { type, recipient_count: recipientCount })
  },

  /**
   * Feature used
   */
  featureUsed: (featureName: string, properties?: EventProperties) => {
    track("feature_used", { feature_name: featureName, ...properties })
  },
}

// ==================== Performance Tracking ====================

/**
 * Track performance metrics
 */
export function trackPerformance(
  metricName: string,
  valueMs: number,
  properties?: EventProperties
): void {
  track("performance", {
    metric_name: metricName,
    value_ms: valueMs,
    ...properties,
  })
}

/**
 * Measure function execution time
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  properties?: EventProperties
): Promise<T> {
  const start = performance.now()
  try {
    const result = await fn()
    const duration = performance.now() - start
    trackPerformance(name, duration, { success: true, ...properties })
    return result
  } catch (error) {
    const duration = performance.now() - start
    trackPerformance(name, duration, { success: false, ...properties })
    throw error
  }
}

/**
 * Create a performance timer
 */
export function createTimer(name: string, properties?: EventProperties) {
  const start = performance.now()

  return {
    end: (additionalProps?: EventProperties) => {
      const duration = performance.now() - start
      trackPerformance(name, duration, { ...properties, ...additionalProps })
      return duration
    },
  }
}

// ==================== Session Tracking ====================

let sessionStartTime: number | null = null

/**
 * Start session tracking
 */
export function startSession(): void {
  sessionStartTime = Date.now()
  track("session_start")
}

/**
 * End session tracking
 */
export function endSession(): void {
  if (sessionStartTime) {
    const duration = Math.floor((Date.now() - sessionStartTime) / 1000)
    track("session_end", { duration_seconds: duration })
    sessionStartTime = null
  }
}

/**
 * Get session duration in seconds
 */
export function getSessionDuration(): number | null {
  if (!sessionStartTime) return null
  return Math.floor((Date.now() - sessionStartTime) / 1000)
}
