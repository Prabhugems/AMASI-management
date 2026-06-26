import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import crypto from "crypto"

// Gallabox sends WhatsApp delivery/read events under `Message.WA.status.received`
// (sent → delivered → read live inside an inner `status` field) and message
// failures under `Message.WA.status.failed`. Field names inside the payload
// are not stable across plans — we look up the WhatsApp message id in several
// likely locations and extract the inner status keyword permissively. The raw
// payload of the first hit per server instance is logged at INFO so we can
// adapt the parser once we see what Gallabox actually posts on this account.

function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!secret) {
    console.warn(
      "[Gallabox] GALLABOX_WEBHOOK_SECRET not set — signature verification disabled",
    )
    return true
  }
  if (!signature) return false
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

type Json = Record<string, unknown>

function getString(obj: unknown, ...paths: string[][]): string | undefined {
  for (const path of paths) {
    let cur: unknown = obj
    for (const k of path) {
      if (cur && typeof cur === "object" && k in (cur as Json)) {
        cur = (cur as Json)[k]
      } else {
        cur = undefined
        break
      }
    }
    if (typeof cur === "string" && cur.length > 0) return cur
    if (typeof cur === "number") return String(cur)
  }
  return undefined
}

function parseTimestamp(raw: string | undefined): string {
  if (!raw) return new Date().toISOString()
  if (/^\d+$/.test(raw)) {
    const n = Number(raw)
    const ms = n < 1e12 ? n * 1000 : n
    return new Date(ms).toISOString()
  }
  const d = new Date(raw)
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

let firstHitLogged = false

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get("x-gallabox-signature")
    const secret = (process.env.GALLABOX_WEBHOOK_SECRET || "").trim()

    if (secret && !verifyWebhookSignature(rawBody, signature, secret)) {
      console.error("[Gallabox] Invalid webhook signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const payload: Json = JSON.parse(rawBody) as Json

    if (!firstHitLogged) {
      firstHitLogged = true
      console.log(
        "[Gallabox] First webhook received — raw payload (truncated):",
        rawBody.slice(0, 4000),
      )
    }

    const event = getString(payload, ["event"], ["type"], ["eventName"]) || ""

    // WhatsApp message id Gallabox returned on the outbound send. Stored in our
    // `message_logs.provider_message_id` at send time. Try every plausible path.
    const providerMessageId = getString(
      payload,
      ["data", "id"],
      ["data", "messageId"],
      ["data", "whatsappMessageId"],
      ["data", "message", "id"],
      ["payload", "message", "id"],
      ["payload", "id"],
      ["message", "id"],
      ["whatsapp", "id"],
      ["id"],
    )

    if (!providerMessageId) {
      console.warn(
        "[Gallabox] No message id found in payload (event=%s); raw=%s",
        event,
        rawBody.slice(0, 2000),
      )
      return NextResponse.json({ received: true, matched: false })
    }

    const innerStatus =
      getString(
        payload,
        ["data", "status"],
        ["data", "deliveryStatus"],
        ["data", "message", "status"],
        ["payload", "message", "status"],
        ["status"],
      )?.toLowerCase() || ""

    const timestamp = parseTimestamp(
      getString(
        payload,
        ["data", "timestamp"],
        ["data", "statusAt"],
        ["data", "updatedAt"],
        ["data", "message", "timestamp"],
        ["payload", "message", "timestamp"],
        ["timestamp"],
      ),
    )

    const errorMessage = getString(
      payload,
      ["data", "errorMessage"],
      ["data", "error"],
      ["data", "failureReason"],
      ["data", "reason"],
      ["payload", "message", "errorMessage"],
    )

    let status: "sent" | "delivered" | "read" | "failed" | null = null
    let timestampColumn: "sent_at" | "delivered_at" | "read_at" | "failed_at" | null = null

    const isFailureEvent = event.toLowerCase().includes("failed")
    if (isFailureEvent || innerStatus.includes("fail") || innerStatus.includes("undeliver") || innerStatus.includes("reject")) {
      status = "failed"
      timestampColumn = "failed_at"
    } else if (innerStatus.includes("read")) {
      status = "read"
      timestampColumn = "read_at"
    } else if (innerStatus.includes("deliver")) {
      status = "delivered"
      timestampColumn = "delivered_at"
    } else if (innerStatus.includes("sent") || innerStatus === "accepted") {
      status = "sent"
      timestampColumn = "sent_at"
    } else {
      console.warn(
        "[Gallabox] Unrecognised status event=%s innerStatus=%s id=%s",
        event,
        innerStatus,
        providerMessageId,
      )
      return NextResponse.json({ received: true, matched: false })
    }

    const supabase = await createAdminClient()

    const { data: row, error: findError } = await (supabase as any)
      .from("message_logs")
      .select("id, status")
      .eq("provider_message_id", providerMessageId)
      .maybeSingle()

    if (findError) {
      console.error("[Gallabox] message_logs lookup error:", findError)
      return NextResponse.json({ received: true, matched: false })
    }
    if (!row) {
      console.log(
        "[Gallabox] No message_logs row for provider_message_id=%s",
        providerMessageId,
      )
      return NextResponse.json({ received: true, matched: false })
    }

    // Don't regress status: read > delivered > sent > pending.
    const rank = { pending: 0, queued: 0, sent: 1, delivered: 2, read: 3, failed: 4 } as const
    const currentRank = (rank as Record<string, number>)[row.status as string] ?? 0
    const newRank = (rank as Record<string, number>)[status] ?? 0

    const updates: Record<string, unknown> = { [timestampColumn]: timestamp }
    if (newRank >= currentRank) updates.status = status
    if (status === "failed" && errorMessage) updates.error_message = errorMessage

    const { error: updateError } = await (supabase as any)
      .from("message_logs")
      .update(updates)
      .eq("id", row.id)

    if (updateError) {
      console.error("[Gallabox] Update failed:", updateError)
      return NextResponse.json({ received: true, matched: false })
    }

    console.log(
      "[Gallabox] %s → %s for provider_message_id=%s",
      row.status,
      status,
      providerMessageId,
    )
    return NextResponse.json({ received: true, matched: true, status })
  } catch (error) {
    console.error("[Gallabox] Webhook handler error:", error)
    // Return 200 so Gallabox doesn't retry-loop on a payload our parser can't read.
    return NextResponse.json({ received: true, matched: false })
  }
}

export async function GET() {
  return NextResponse.json({ status: "Gallabox webhook endpoint active" })
}
