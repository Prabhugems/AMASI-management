import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getOptionalEnv } from "@/lib/env"
import crypto from "crypto"

// Hash IP for privacy - uses a proper secret or generates a fallback from environment
function hashIP(ip: string): string {
  // Try to get a proper secret, fall back to a combination of env vars for uniqueness
  const secret = getOptionalEnv('NEXTAUTH_SECRET') ||
    getOptionalEnv('SUPABASE_SERVICE_ROLE_KEY', '').substring(0, 32) ||
    'analytics-fallback-secret'

  if (!getOptionalEnv('NEXTAUTH_SECRET')) {
    console.warn('NEXTAUTH_SECRET not set - using fallback for IP hashing. Set NEXTAUTH_SECRET in production.')
  }

  return crypto.createHash("sha256").update(ip + secret).digest("hex").substring(0, 16)
}

// Detect device type from user agent
function getDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase()
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet"
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile"
  return "desktop"
}

// Extract browser name
function getBrowser(userAgent: string): string {
  const ua = userAgent.toLowerCase()
  if (ua.includes("firefox")) return "Firefox"
  if (ua.includes("edg")) return "Edge"
  if (ua.includes("chrome")) return "Chrome"
  if (ua.includes("safari")) return "Safari"
  if (ua.includes("opera") || ua.includes("opr")) return "Opera"
  return "Other"
}

// POST /api/analytics/track - Track page view
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      event_id,
      visitor_id,
      page_type = "event",
      referrer,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      session_id,
    } = body

    if (!event_id || !visitor_id) {
      return NextResponse.json(
        { error: "event_id and visitor_id are required" },
        { status: 400 }
      )
    }

    // Get request metadata
    const userAgent = request.headers.get("user-agent") || ""
    const forwardedFor = request.headers.get("x-forwarded-for")
    const ip = forwardedFor?.split(",")[0]?.trim() || "unknown"

    const supabase = await createAdminClient()

    // Insert page view
    const { error } = await (supabase as any)
      .from("event_page_views")
      .insert({
        event_id,
        visitor_id,
        page_type,
        referrer: referrer || null,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        utm_content: utm_content || null,
        device_type: getDeviceType(userAgent),
        browser: getBrowser(userAgent),
        ip_hash: hashIP(ip),
        session_id: session_id || null,
      })

    if (error) {
      // Silently ignore - table might not exist yet
      // console.error("Failed to track page view:", error)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in POST /api/analytics/track:", error)
    // Return success anyway - tracking shouldn't break the page
    return NextResponse.json({ success: true })
  }
}
