import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

// GET /api/checkin/access/[accessToken]/stats
// Lightweight, frequently-polled stats for the volunteer portal's live counter.
// Split from the parent /access/[accessToken] route (which is "strict"-tier,
// 5 req/min) so that polling every 15s from multiple volunteer devices on the
// same venue Wi-Fi (shared/NAT'd IP) doesn't trip rate limiting.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accessToken: string }> }
) {
  const clientIp = getClientIp(request)
  const rateLimit = checkRateLimit(`checkin-access-stats:${clientIp}`, "authenticated")
  if (!rateLimit.success) return rateLimitExceededResponse(rateLimit)

  const { accessToken } = await params

  if (!accessToken || accessToken.length < 10) {
    return NextResponse.json({ error: "Invalid access token" }, { status: 400 })
  }

  const supabase = await createAdminClient()

  const { data: checkinList, error: listError } = await (supabase as any)
    .from("checkin_lists")
    .select("id, event_id, access_token_expires_at, ticket_type_ids")
    .eq("access_token", accessToken)
    .maybeSingle()

  if (listError || !checkinList) {
    return NextResponse.json({ error: "Invalid or expired access link" }, { status: 401 })
  }

  if (checkinList.access_token_expires_at &&
      new Date(checkinList.access_token_expires_at) < new Date()) {
    return NextResponse.json({ error: "This access link has expired." }, { status: 401 })
  }

  let totalQuery = (supabase as any)
    .from("registrations")
    .select("*", { count: "exact", head: true })
    .eq("event_id", checkinList.event_id)
    .eq("status", "confirmed")

  if (checkinList.ticket_type_ids?.length > 0) {
    totalQuery = totalQuery.in("ticket_type_id", checkinList.ticket_type_ids)
  }

  const { count: totalCount } = await totalQuery

  const { count: checkedInCount } = await (supabase as any)
    .from("checkin_records")
    .select("*", { count: "exact", head: true })
    .eq("checkin_list_id", checkinList.id)
    .is("checked_out_at", null)

  return NextResponse.json({
    stats: {
      total: totalCount || 0,
      checkedIn: checkedInCount || 0,
    }
  })
}
