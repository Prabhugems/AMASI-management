import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import dns from "dns/promises"
import net from "net"

// Blocks SSRF on the webhook-test action below: only plain http(s) URLs whose
// hostname resolves exclusively to public IPs may be fetched. Checks the
// *resolved* address, not just the literal string, so a hostname that
// DNS-rebinds to an internal address (e.g. cloud metadata) is still caught,
// not just a literal 169.254.x.x/localhost in the request body.
async function assertPublicHttpUrl(rawUrl: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error("Invalid URL")
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed")
  }

  const hostname = parsed.hostname
  const addresses = net.isIP(hostname)
    ? [hostname]
    : (await dns.lookup(hostname, { all: true })).map((a) => a.address)

  if (addresses.some(isPrivateOrReservedIp)) {
    throw new Error("URL resolves to a private/internal address")
  }
}

function isPrivateOrReservedIp(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number)
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) || // link-local + cloud metadata (169.254.169.254)
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      a >= 224 // multicast + reserved
    )
  }
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase()
    if (normalized === "::1" || normalized === "::") return true
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true // ULA fc00::/7
    if (/^fe[89ab]/.test(normalized)) return true // link-local fe80::/10
    if (normalized.startsWith("::ffff:")) {
      const embeddedV4 = normalized.split(":").pop()!
      return net.isIPv4(embeddedV4) && isPrivateOrReservedIp(embeddedV4)
    }
  }
  return false
}

export interface CommunicationSettings {
  id?: string
  event_id: string

  // Email
  email_provider: string
  email_api_key: string | null
  email_from_address: string | null
  email_from_name: string | null

  // WhatsApp
  whatsapp_provider: string | null
  whatsapp_api_key: string | null
  whatsapp_phone_number_id: string | null
  whatsapp_business_account_id: string | null
  whatsapp_access_token: string | null

  // SMS
  sms_provider: string | null
  sms_api_key: string | null
  sms_sender_id: string | null
  sms_auth_token: string | null

  // Twilio (shared)
  twilio_account_sid: string | null
  twilio_auth_token: string | null
  twilio_phone_number: string | null

  // Webhook
  webhook_enabled: boolean
  webhook_url: string | null
  webhook_secret: string | null
  webhook_headers: Record<string, string>

  // Channels
  channels_enabled: {
    email: boolean
    whatsapp: boolean
    sms: boolean
    webhook: boolean
  }
}

const defaultSettings: Omit<CommunicationSettings, "event_id"> = {
  email_provider: "default",
  email_api_key: null,
  email_from_address: null,
  email_from_name: null,

  whatsapp_provider: null,
  whatsapp_api_key: null,
  whatsapp_phone_number_id: null,
  whatsapp_business_account_id: null,
  whatsapp_access_token: null,

  sms_provider: null,
  sms_api_key: null,
  sms_sender_id: null,
  sms_auth_token: null,

  twilio_account_sid: null,
  twilio_auth_token: null,
  twilio_phone_number: null,

  webhook_enabled: false,
  webhook_url: null,
  webhook_secret: null,
  webhook_headers: {},

  channels_enabled: {
    email: true,
    whatsapp: false,
    sms: false,
    webhook: false,
  },
}

// GET /api/communications/settings?event_id=xxx
export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    const { data, error } = await (supabase as any)
      .from("communication_settings")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle()

    if (error) {
      console.error("Error fetching communication settings:", error)
      return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
    }

    // Return existing settings or defaults
    const settings: CommunicationSettings = data || {
      ...defaultSettings,
      event_id: eventId,
    }

    // Mask sensitive fields for security
    const maskedSettings = {
      ...settings,
      email_api_key: settings.email_api_key ? "••••••••" : null,
      whatsapp_api_key: settings.whatsapp_api_key ? "••••••••" : null,
      whatsapp_access_token: settings.whatsapp_access_token ? "••••••••" : null,
      sms_api_key: settings.sms_api_key ? "••••••••" : null,
      sms_auth_token: settings.sms_auth_token ? "••••••••" : null,
      twilio_account_sid: settings.twilio_account_sid ? "••••••••" : null,
      twilio_auth_token: settings.twilio_auth_token ? "••••••••" : null,
      webhook_secret: settings.webhook_secret ? "••••••••" : null,
    }

    return NextResponse.json({ settings: maskedSettings })
  } catch (error) {
    console.error("Error in GET /api/communications/settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/communications/settings
export async function PUT(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const body = await request.json()
    const { event_id, ...settingsData } = body

    if (!event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Check if settings exist
    const { data: existing } = await (supabase as any)
      .from("communication_settings")
      .select("id")
      .eq("event_id", event_id)
      .maybeSingle()

    // Filter out masked values (don't update if still masked)
    const cleanedData: Record<string, any> = {}
    for (const [key, value] of Object.entries(settingsData)) {
      if (value !== "••••••••") {
        cleanedData[key] = value
      }
    }

    let result
    if (existing) {
      // Update existing
      result = await (supabase as any)
        .from("communication_settings")
        .update(cleanedData)
        .eq("event_id", event_id)
        .select()
        .single()
    } else {
      // Insert new
      result = await (supabase as any)
        .from("communication_settings")
        .insert({ event_id, ...cleanedData })
        .select()
        .single()
    }

    if (result.error) {
      console.error("Error saving communication settings:", result.error)
      return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
    }

    return NextResponse.json({ success: true, settings: result.data })
  } catch (error) {
    console.error("Error in PUT /api/communications/settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/communications/settings/test - Test connection
export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const body = await request.json()
    const { channel, provider, credentials, event_id: _event_id } = body

    // Test the connection based on channel and provider
    let testResult = { success: false, message: "" }

    switch (channel) {
      case "email":
        // Test email by checking API key validity
        if (provider === "resend" && credentials.api_key) {
          try {
            const response = await fetch("https://api.resend.com/domains", {
              headers: { Authorization: `Bearer ${credentials.api_key}` },
            })
            testResult = {
              success: response.ok,
              message: response.ok ? "Resend API key is valid" : "Invalid Resend API key",
            }
          } catch {
            testResult = { success: false, message: "Failed to connect to Resend" }
          }
        }
        break

      case "whatsapp":
        if (provider === "twilio" && credentials.account_sid && credentials.auth_token) {
          try {
            const response = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${credentials.account_sid}.json`,
              {
                headers: {
                  Authorization: `Basic ${Buffer.from(`${credentials.account_sid}:${credentials.auth_token}`).toString("base64")}`,
                },
              }
            )
            testResult = {
              success: response.ok,
              message: response.ok ? "Twilio credentials are valid" : "Invalid Twilio credentials",
            }
          } catch {
            testResult = { success: false, message: "Failed to connect to Twilio" }
          }
        } else if (provider === "meta" && credentials.access_token) {
          try {
            const response = await fetch(
              `https://graph.facebook.com/v18.0/me?access_token=${credentials.access_token}`
            )
            testResult = {
              success: response.ok,
              message: response.ok ? "Meta API token is valid" : "Invalid Meta API token",
            }
          } catch {
            testResult = { success: false, message: "Failed to connect to Meta API" }
          }
        }
        break

      case "webhook":
        if (credentials.url) {
          try {
            await assertPublicHttpUrl(credentials.url)
            const response = await fetch(credentials.url, {
              method: "POST",
              redirect: "manual", // don't let a public URL's redirect pivot to an internal one post-validation
              headers: {
                "Content-Type": "application/json",
                ...credentials.headers,
              },
              body: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
            })
            testResult = {
              success: response.ok,
              message: response.ok ? `Webhook responded with ${response.status}` : `Webhook returned ${response.status}`,
            }
          } catch (err: any) {
            testResult = { success: false, message: `Webhook error: ${err.message}` }
          }
        }
        break

      default:
        testResult = { success: false, message: "Unknown channel" }
    }

    return NextResponse.json(testResult)
  } catch (error) {
    console.error("Error in POST /api/communications/settings/test:", error)
    return NextResponse.json({ success: false, message: "Test failed" }, { status: 500 })
  }
}
