"use client"

import { useEffect, useRef } from "react"
import { useSearchParams, usePathname } from "next/navigation"

// Generate a unique visitor ID (persisted in localStorage)
function getVisitorId(): string {
  if (typeof window === "undefined") return ""

  let visitorId = localStorage.getItem("_vid")
  if (!visitorId) {
    visitorId = "v_" + Math.random().toString(36).substring(2) + Date.now().toString(36)
    localStorage.setItem("_vid", visitorId)
  }
  return visitorId
}

// Generate a session ID (persisted in sessionStorage)
function getSessionId(): string {
  if (typeof window === "undefined") return ""

  let sessionId = sessionStorage.getItem("_sid")
  if (!sessionId) {
    sessionId = "s_" + Math.random().toString(36).substring(2) + Date.now().toString(36)
    sessionStorage.setItem("_sid", sessionId)
  }
  return sessionId
}

interface UsePageTrackingOptions {
  eventId: string
  pageType?: "event" | "register" | "checkout"
}

export function usePageTracking({ eventId, pageType = "event" }: UsePageTrackingOptions) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const tracked = useRef(false)

  useEffect(() => {
    // Only track once per page load
    if (tracked.current || !eventId) return
    tracked.current = true

    const trackPageView = async () => {
      try {
        const visitorId = getVisitorId()
        const sessionId = getSessionId()

        // Get UTM parameters
        const utmSource = searchParams.get("utm_source")
        const utmMedium = searchParams.get("utm_medium")
        const utmCampaign = searchParams.get("utm_campaign")
        const utmContent = searchParams.get("utm_content")

        // Get referrer
        const referrer = document.referrer || null

        await fetch("/api/analytics/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_id: eventId,
            visitor_id: visitorId,
            session_id: sessionId,
            page_type: pageType,
            referrer,
            utm_source: utmSource,
            utm_medium: utmMedium,
            utm_campaign: utmCampaign,
            utm_content: utmContent,
          }),
        })
      } catch (error) {
        // Silently fail - tracking shouldn't break the page
        console.debug("Page tracking failed:", error)
      }
    }

    trackPageView()
  }, [eventId, pageType, searchParams])

  // Return helper functions
  return {
    getVisitorId,
    getSessionId,
    trackEvent: async (eventName: string, data?: Record<string, any>) => {
      // Future: track custom events
      console.debug("Track event:", eventName, data)
    },
  }
}

// Standalone tracking function for use outside React components
export async function trackPageView(
  eventId: string,
  pageType: "event" | "register" | "checkout" = "event"
) {
  if (typeof window === "undefined") return

  try {
    const visitorId = getVisitorId()
    const sessionId = getSessionId()
    const urlParams = new URLSearchParams(window.location.search)

    await fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: eventId,
        visitor_id: visitorId,
        session_id: sessionId,
        page_type: pageType,
        referrer: document.referrer || null,
        utm_source: urlParams.get("utm_source"),
        utm_medium: urlParams.get("utm_medium"),
        utm_campaign: urlParams.get("utm_campaign"),
        utm_content: urlParams.get("utm_content"),
      }),
    })
  } catch (error) {
    console.debug("Page tracking failed:", error)
  }
}

// Get visitor and session IDs for use in forms
export function getTrackingIds() {
  return {
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
  }
}
