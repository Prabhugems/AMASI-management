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

  // Count only check-in records whose registration is still eligible — same
  // basis as `total` above (confirmed + this list's ticket-type filter) — so
  // the two numbers can't diverge. The scanner (/api/verify) checks in a
  // wrong-ticket badge with a warning rather than blocking it, so an
  // unfiltered record count could otherwise report checkedIn > total. The
  // `registrations!inner(...)` embed makes this an inner join, kept as a single
  // head+count query so the 15s poll stays cheap.
  let checkedInQuery = (supabase as any)
    .from("checkin_records")
    .select("registration_id, registrations!inner(status, ticket_type_id)", { count: "exact", head: true })
    .eq("checkin_list_id", checkinList.id)
    .is("checked_out_at", null)
    .eq("registrations.status", "confirmed")

  if (checkinList.ticket_type_ids?.length > 0) {
    checkedInQuery = checkedInQuery.in("registrations.ticket_type_id", checkinList.ticket_type_ids)
  }

  const { count: checkedInCount } = await checkedInQuery

  return NextResponse.json({
    stats: {
      total: totalCount || 0,
      checkedIn: checkedInCount || 0,
    }
  })
}
