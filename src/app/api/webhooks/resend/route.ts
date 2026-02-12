import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import crypto from "crypto"

// Resend webhook events
type ResendEventType =
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.complained"
  | "email.bounced"
  | "email.opened"
  | "email.clicked"

interface ResendWebhookPayload {
  type: ResendEventType
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    created_at: string
    // For click events
    click?: {
      link: string
      timestamp: string
    }
    // For bounce events
    bounce?: {
      message: string
      type: "hard" | "soft"
    }
  }
}

// Verify webhook signature
function verifyWebhookSignature(payload: string, signature: string | null, secret: string): boolean {
  if (!secret) {
    console.error("[RESEND WEBHOOK] No webhook secret configured - rejecting request")
    return false
  }
  if (!signature) {
    console.error("[RESEND WEBHOOK] No signature provided in request")
    return false
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false // Length mismatch
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get("svix-signature")
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET || ""

    // Always verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const payload: ResendWebhookPayload = JSON.parse(rawBody)
    const { type, data } = payload

    console.log(`Resend webhook received: ${type} for email ${data.email_id}`)

    const supabase = await createAdminClient()

    // Find the email log by resend_email_id
    const { data: emailLog, error: findError } = await (supabase as any)
      .from("email_logs")
      .select("id, open_count, click_count, clicked_links, first_opened_at, first_clicked_at")
      .eq("resend_email_id", data.email_id)
      .single()

    if (findError || !emailLog) {
      console.log(`Email log not found for resend_email_id: ${data.email_id}`)
      // Still return 200 to acknowledge receipt
      return NextResponse.json({ received: true, matched: false })
    }

    // Update based on event type
    const updates: Record<string, any> = {}

    switch (type) {
      case "email.sent":
        updates.status = "sent"
        updates.sent_at = data.created_at
        break

      case "email.delivered":
        updates.status = "delivered"
        updates.delivered_at = data.created_at
        break

      case "email.delivery_delayed":
        updates.status = "delayed"
        break

      case "email.opened":
        updates.status = "opened"
        updates.opened_at = data.created_at
        updates.open_count = (emailLog.open_count || 0) + 1
        if (!emailLog.first_opened_at) {
          updates.first_opened_at = data.created_at
        }
        break

      case "email.clicked":
        updates.status = "clicked"
        updates.clicked_at = data.created_at
        updates.click_count = (emailLog.click_count || 0) + 1
        if (!emailLog.first_clicked_at) {
          updates.first_clicked_at = data.created_at
        }
        // Track clicked link
        if (data.click?.link) {
          const clickedLinks = emailLog.clicked_links || []
          clickedLinks.push({
            url: data.click.link,
            clicked_at: data.click.timestamp || data.created_at,
          })
          updates.clicked_links = clickedLinks
        }
        break

      case "email.bounced":
        updates.status = "bounced"
        updates.bounced_at = data.created_at
        if (data.bounce) {
          updates.error_message = data.bounce.message
          updates.bounce_type = data.bounce.type
        }
        break

      case "email.complained":
        updates.status = "complained"
        updates.complained_at = data.created_at
        break
    }

    // Update the email log
    const { error: updateError } = await (supabase as any)
      .from("email_logs")
      .update(updates)
      .eq("id", emailLog.id)

    if (updateError) {
      console.error("Failed to update email log:", updateError)
      return NextResponse.json({ error: "Failed to update" }, { status: 500 })
    }

    console.log(`Email log updated: ${emailLog.id} -> ${type}`)

    return NextResponse.json({ received: true, matched: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}

// Handle GET for webhook verification (if needed)
export async function GET() {
  return NextResponse.json({ status: "Resend webhook endpoint active" })
}
