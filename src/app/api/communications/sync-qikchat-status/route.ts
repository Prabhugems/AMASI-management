import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAccess } from "@/lib/auth/api-auth"
import { getQikchatMessageStatus, isQikchatEnabled } from "@/lib/qikchat"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

// Qikchat doesn't push delivery status via webhook — we have to poll their
// GET /v1/messages?msgid=<id> endpoint. This route grabs all WhatsApp message
// logs for an event that are still in 'sent' or 'delivered' status (no read_at
// yet) and refreshes them in one go.
//
// Practical limits:
//  - 600ms throttle between requests (same spacing we use for sends)
//  - Hard cap of 500 rows per call so serverless timeouts can't bite
//  - Skips rows without provider_message_id (those were dev-mode sends)

const BATCH_LIMIT = 500
const THROTTLE_MS = 600

interface SyncRequest {
  event_id: string
}

export const maxDuration = 300 // 5 min — leave headroom for 500 * 600ms

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "bulk")
  if (!rateLimit.success) return rateLimitExceededResponse(rateLimit)

  try {
    const body: SyncRequest = await request.json()
    if (!body.event_id) {
      return NextResponse.json({ error: "Missing event_id" }, { status: 400 })
    }

    const { error: authError } = await requireEventAccess(body.event_id)
    if (authError) return authError

    if (!isQikchatEnabled()) {
      return NextResponse.json(
        { error: "Qikchat is not configured (QIKCHAT_API_KEY missing)" },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    // Pull rows that still need a status update: WhatsApp sends with a
    // provider_message_id, whose status hasn't progressed to 'read' or 'failed'
    // yet. Newest first so an admin polling after a blast sees recent ones
    // refreshed first if we hit the cap.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error: fetchError } = await (supabase as any)
      .from("message_logs")
      .select("id, provider_message_id, status, delivered_at, read_at, failed_at")
      .eq("event_id", body.event_id)
      .eq("channel", "whatsapp")
      .not("provider_message_id", "is", null)
      .in("status", ["sent", "delivered"])
      .order("created_at", { ascending: false })
      .limit(BATCH_LIMIT)

    if (fetchError) {
      console.error("[sync-qikchat-status] fetch failed:", fetchError)
      return NextResponse.json({ error: "Failed to load message logs" }, { status: 500 })
    }

    const messages = (rows || []) as Array<{
      id: string
      provider_message_id: string | null
      status: string
      delivered_at: string | null
      read_at: string | null
      failed_at: string | null
    }>

    const result = {
      checked: 0,
      updated: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      errors: 0,
      capped: messages.length === BATCH_LIMIT,
    }

    for (let i = 0; i < messages.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, THROTTLE_MS))
      const row = messages[i]
      if (!row.provider_message_id) continue
      result.checked++

      const statusRes = await getQikchatMessageStatus(row.provider_message_id)
      if (!statusRes.success || !statusRes.data) {
        result.errors++
        continue
      }

      const remote = statusRes.data
      // Only escalate forward (sent → delivered → read, or → failed). Never
      // demote a row that already has a stronger status.
      const order: Record<string, number> = {
        sent: 1,
        delivered: 2,
        read: 3,
        failed: 4,
        unknown: 0,
      }
      const remoteRank = order[remote.status] ?? 0
      const localRank = order[row.status] ?? 0
      if (remoteRank <= localRank && row.status !== "sent") continue

      const updates: Record<string, string> = {}
      if (remote.status === "delivered" && !row.delivered_at) {
        updates.status = "delivered"
        updates.delivered_at = remote.deliveredAt || new Date().toISOString()
      } else if (remote.status === "read") {
        updates.status = "read"
        if (!row.delivered_at) {
          updates.delivered_at = remote.deliveredAt || remote.readAt || new Date().toISOString()
        }
        if (!row.read_at) {
          updates.read_at = remote.readAt || new Date().toISOString()
        }
      } else if (remote.status === "failed" && !row.failed_at) {
        updates.status = "failed"
        updates.failed_at = new Date().toISOString()
        if (remote.errorMessage) updates.error_message = remote.errorMessage.slice(0, 1000)
      }

      if (Object.keys(updates).length === 0) continue

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("message_logs")
        .update(updates)
        .eq("id", row.id)

      if (updateError) {
        console.error(`[sync-qikchat-status] update failed for ${row.id}:`, updateError)
        result.errors++
        continue
      }
      result.updated++
      if (updates.status === "delivered") result.delivered++
      else if (updates.status === "read") result.read++
      else if (updates.status === "failed") result.failed++
    }

    return NextResponse.json({ success: true, results: result })
  } catch (error) {
    console.error("[sync-qikchat-status] error:", error)
    return NextResponse.json({ error: "Failed to sync status" }, { status: 500 })
  }
}
