import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"
import {
  isGallaboxEnabled,
  sendGallaboxTemplate,
  sendGallaboxText,
} from "@/lib/gallabox"

interface SendRequest {
  phone: string
  recipient_name: string
  type: "template" | "text"
  template_name?: string
  body_values?: string[]
  text?: string
  event_id?: string
  registration_id?: string
}

// POST /api/whatsapp/send
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "bulk")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  const { error: authError } = await requireAdmin()
  if (authError) return authError

  if (!isGallaboxEnabled()) {
    return NextResponse.json(
      { error: "WhatsApp (Gallabox) is not configured. Set GALLABOX_API_KEY, GALLABOX_API_SECRET, and GALLABOX_CHANNEL_ID environment variables." },
      { status: 503 }
    )
  }

  try {
    const body: SendRequest = await request.json()
    const { phone, recipient_name, type, template_name, body_values, text, event_id, registration_id } = body

    if (!phone || !recipient_name) {
      return NextResponse.json({ error: "phone and recipient_name are required" }, { status: 400 })
    }

    let result: { success: boolean; messageId?: string; error?: string }

    if (type === "template") {
      if (!template_name) {
        return NextResponse.json({ error: "template_name is required for template messages" }, { status: 400 })
      }
      result = await sendGallaboxTemplate(phone, recipient_name, template_name, body_values || [])
    } else {
      if (!text) {
        return NextResponse.json({ error: "text is required for text messages" }, { status: 400 })
      }
      result = await sendGallaboxText(phone, recipient_name, text)
    }

    // Log to message_logs
    try {
      const supabase = await createAdminClient()
      await (supabase as any).from("message_logs").insert({
        event_id: event_id || null,
        registration_id: registration_id || null,
        channel: "whatsapp",
        provider: "gallabox",
        recipient: phone,
        recipient_name,
        subject: null,
        message_body: type === "template" ? `Template: ${template_name}` : text,
        status: result.success ? "sent" : "failed",
        provider_message_id: result.messageId || null,
        error_message: result.error || null,
        sent_at: result.success ? new Date().toISOString() : null,
        failed_at: result.success ? null : new Date().toISOString(),
      })
    } catch (logError: any) {
      console.error("[WhatsApp Send] Failed to log message:", logError.message)
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send WhatsApp message" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    })
  } catch (error: any) {
    console.error("Error in POST /api/whatsapp/send:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to send WhatsApp message" },
      { status: 500 }
    )
  }
}
