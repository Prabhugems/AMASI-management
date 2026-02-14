import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAccess } from "@/lib/auth/api-auth"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

export async function DELETE(request: NextRequest) {
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "strict")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return NextResponse.json(
        { error: "event_id is required" },
        { status: 400 }
      )
    }

    const { error: authError } = await requireEventAccess(eventId)
    if (authError) return authError

    const supabase = await createAdminClient()

    // Support deleting specific session IDs or all sessions for the event
    const sessionIds = searchParams.get("ids")

    let error
    if (sessionIds) {
      // Delete specific sessions by IDs (bulk or single delete)
      const ids = sessionIds.split(",")
      const result = await supabase
        .from("sessions")
        .delete()
        .eq("event_id", eventId)
        .in("id", ids)
      error = result.error
    } else {
      // Clear all sessions for the event
      const result = await supabase
        .from("sessions")
        .delete()
        .eq("event_id", eventId)
      error = result.error
    }

    if (error) {
      return NextResponse.json(
        { error: "Failed to clear sessions" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Clear error:", error)
    return NextResponse.json(
      { error: "Clear failed" },
      { status: 500 }
    )
  }
}
