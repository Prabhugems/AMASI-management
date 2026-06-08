import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import crypto from "crypto"

// Qikchat sends delivery callbacks via webhook. The exact payload shape isn't
// fully documented and providers in this space often change it without notice,
// so this handler accepts several common shapes:
//   - { statuses: [ { id, status, timestamp, ... } ] }   (Meta-style)
//   - { events: [ { id, status, timestamp } ] }
//   - { data: { id, status, timestamp } }
//   - { id, status, timestamp }                          (flat)
// Unknown shapes are logged but still ack'd with 200 so Qikchat doesn't retry.

type NormalizedStatus = "sent" | "delivered" | "read" | "failed"

interface NormalizedEvent {
  messageId: string
  status: NormalizedStatus
  timestamp?: string | number
  errorMessage?: string
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null
}

function strField(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "string" && v) return v
    if (typeof v === "number") return String(v)
  }
  return undefined
}

function mapStatus(raw: string): NormalizedStatus | null {
  const s = raw.toLowerCase()
  if (s.includes("read")) return "read"
  if (s.includes("deliver")) return "delivered"
  if (s.includes("fail") || s.includes("undeliver") || s.includes("error") || s.includes("reject")) return "failed"
  if (s.includes("sent") || s === "accepted") return "sent"
  return null
}

function pushNormalized(out: NormalizedEvent[], raw: unknown) {
  if (!isRecord(raw)) return
  const nestedData = isRecord(raw.data) ? raw.data : undefined
  const messageId =
    strField(raw, "id", "messageId", "message_id", "provider_message_id") ??
    (nestedData ? strField(nestedData, "id") : undefined)
  const statusRaw = strField(raw, "status", "event", "type", "delivery_status")
  if (!messageId || !statusRaw) return
  const status = mapStatus(statusRaw)
  if (!status) return

  const errorObj = isRecord(raw.error) ? raw.error : undefined
  const errorMessage =
    (errorObj && strField(errorObj, "message")) ||
    strField(raw, "error_message", "reason") ||
    (typeof raw.error === "string" ? raw.error : undefined)

  out.push({
    messageId,
    status,
    timestamp: strField(raw, "timestamp", "time", "created_at", "updated_at"),
    errorMessage,
  })
}

function normalizeEvents(payload: unknown): NormalizedEvent[] {
  const out: NormalizedEvent[] = []
  if (isRecord(payload)) {
    const data = payload.data
    if (Array.isArray(payload.statuses)) payload.statuses.forEach((e) => pushNormalized(out, e))
    if (isRecord(data) && Array.isArray(data.statuses)) {
      data.statuses.forEach((e: unknown) => pushNormalized(out, e))
    }
    if (Array.isArray(payload.events)) payload.events.forEach((e) => pushNormalized(out, e))
    if (Array.isArray(data)) data.forEach((e: unknown) => pushNormalized(out, e))
    if (isRecord(data) && !Array.isArray(data)) pushNormalized(out, data)
  }
  pushNormalized(out, payload)

  // Dedupe by messageId+status (some shapes nest the same event twice)
  const seen = new Set<string>()
  return out.filter((e) => {
    const key = `${e.messageId}:${e.status}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
  if (signature.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

function toIsoTimestamp(raw: string | number | undefined): string {
  if (raw === undefined || raw === null || raw === "") return new Date().toISOString()
  // Numeric or numeric-string → assume unix seconds if ≤10 digits, ms otherwise
  const n = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isNaN(n) && n > 0) {
    const ms = String(Math.trunc(n)).length <= 10 ? n * 1000 : n
    return new Date(ms).toISOString()
  }
  const d = new Date(String(raw))
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()

    const secret = process.env.QIKCHAT_WEBHOOK_SECRET?.trim()
    if (secret) {
      const sig =
        request.headers.get("x-qikchat-signature") ||
        request.headers.get("x-signature") ||
        request.headers.get("qikchat-signature")
      if (!verifySignature(rawBody, sig, secret)) {
        console.error("[qikchat-webhook] invalid signature")
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
      }
    }

    let payload: unknown
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const events = normalizeEvents(payload)

    if (events.length === 0) {
      console.log("[qikchat-webhook] no recognized events in payload:", JSON.stringify(payload).slice(0, 500))
      return NextResponse.json({ received: true, matched: 0 })
    }

    const supabase = await createAdminClient()
    let matched = 0

    for (const ev of events) {
      const ts = toIsoTimestamp(ev.timestamp)
      const updates: Record<string, string> = { status: ev.status }
      if (ev.status === "delivered") updates.delivered_at = ts
      else if (ev.status === "read") updates.read_at = ts
      else if (ev.status === "failed") {
        updates.failed_at = ts
        if (ev.errorMessage) updates.error_message = ev.errorMessage.slice(0, 1000)
      } else if (ev.status === "sent") updates.sent_at = ts

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error, count } = await (supabase as any)
        .from("message_logs")
        .update(updates, { count: "exact" })
        .eq("provider_message_id", ev.messageId)
        .eq("channel", "whatsapp")

      if (error) {
        console.error(`[qikchat-webhook] update failed for ${ev.messageId}:`, error)
        continue
      }
      matched += count || 0
    }

    return NextResponse.json({ received: true, events: events.length, matched })
  } catch (error) {
    console.error("[qikchat-webhook] error:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: "Qikchat webhook endpoint active" })
}
