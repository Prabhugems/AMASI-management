import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

// GET /api/checkin/access/[accessToken] - Validate staff access token and get checkin list info
// This is like Tito's "Set-up with QR code" feature for volunteers
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accessToken: string }> }
) {
  // Rate limit to prevent brute force token guessing
  const clientIp = getClientIp(request)
  const rateLimit = checkRateLimit(`checkin-access:${clientIp}`, "strict")
  if (!rateLimit.success) return rateLimitExceededResponse(rateLimit)

  const { accessToken } = await params

  if (!accessToken || accessToken.length < 10) {
    return NextResponse.json(
      { error: "Invalid access token" },
      { status: 400 }
    )
  }

  const supabase = await createAdminClient()

  // Look up checkin list by access_token
  const { data: checkinList, error } = await (supabase as any)
    .from("checkin_lists")
    .select(`
      id,
      name,
      event_id,
      access_token_expires_at,
      ticket_type_ids,
      allow_multiple_checkins,
      starts_at,
      ends_at,
      events (
        id,
        name,
        start_date,
        end_date
      )
    `)
    .eq("access_token", accessToken)
    .single()

  if (error || !checkinList) {
    return NextResponse.json(
      { error: "Invalid or expired access link" },
      { status: 401 }
    )
  }

  // Check if access token has expired
  if (checkinList.access_token_expires_at &&
      new Date(checkinList.access_token_expires_at) < new Date()) {
    return NextResponse.json(
      { error: "This access link has expired. Please request a new one from the organizer." },
      { status: 401 }
    )
  }

  // Get stats for this checkin list
  const { count: totalCount } = await (supabase as any)
    .from("registrations")
    .select("*", { count: "exact", head: true })
    .eq("event_id", checkinList.event_id)
    .eq("status", "confirmed")

  const { count: checkedInCount } = await (supabase as any)
    .from("checkin_records")
    .select("*", { count: "exact", head: true })
    .eq("checkin_list_id", checkinList.id)

  return NextResponse.json({
    checkinList: {
      id: checkinList.id,
      name: checkinList.name,
      event_id: checkinList.event_id,
      events: checkinList.events,
      allow_multiple_checkins: checkinList.allow_multiple_checkins,
    },
    stats: {
      total: totalCount || 0,
      checkedIn: checkedInCount || 0,
    }
  })
}
