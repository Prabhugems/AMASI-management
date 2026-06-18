import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"
import { sanitizeSearchInput, validatePagination } from "@/lib/validation"

// GET /api/checkin/access/[accessToken]/attendees
// Returns the attendee roster for a check-in list, scoped to a staff access token.
// Used by the volunteer portal's "List" tab.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accessToken: string }> }
) {
  const clientIp = getClientIp(request)
  const rateLimit = checkRateLimit(`checkin-access-list:${clientIp}`, "authenticated")
  if (!rateLimit.success) return rateLimitExceededResponse(rateLimit)

  const { accessToken } = await params

  if (!accessToken || accessToken.length < 10) {
    return NextResponse.json({ error: "Invalid access token" }, { status: 400 })
  }

  const supabase = await createAdminClient()

  const { data: checkinList, error: listError } = await (supabase as any)
    .from("checkin_lists")
    .select("id, event_id, access_token_expires_at, ticket_type_ids, addon_ids")
    .eq("access_token", accessToken)
    .maybeSingle()

  if (listError || !checkinList) {
    return NextResponse.json({ error: "Invalid or expired access link" }, { status: 401 })
  }

  if (checkinList.access_token_expires_at &&
      new Date(checkinList.access_token_expires_at) < new Date()) {
    return NextResponse.json({ error: "This access link has expired." }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")
  const status = searchParams.get("status") // "checked_in" | "not_checked_in" | null
  const { page, limit, offset } = validatePagination(
    searchParams.get("page"),
    searchParams.get("limit") || "100",
    200
  )

  // If the list restricts by addons, fetch eligible registration IDs first.
  let addonFilteredRegIds: string[] | null = null
  if (checkinList.addon_ids?.length > 0) {
    const { data: addonRegs } = await (supabase as any)
      .from("registration_addons")
      .select("registration_id")
      .in("addon_id", checkinList.addon_ids)
    addonFilteredRegIds = [...new Set((addonRegs || []).map((r: any) => r.registration_id))] as string[]
    if (addonFilteredRegIds.length === 0) {
      return NextResponse.json({ data: [], total: 0, page, limit, totalPages: 0 })
    }
  }

  let dbQuery = (supabase as any)
    .from("registrations")
    .select(`
      id,
      registration_number,
      attendee_name,
      attendee_email,
      attendee_institution,
      attendee_designation,
      ticket_type_id,
      ticket_types (id, name)
    `, { count: "exact" })
    .eq("event_id", checkinList.event_id)
    .eq("status", "confirmed")
    .order("attendee_name", { ascending: true })

  if (checkinList.ticket_type_ids?.length > 0) {
    dbQuery = dbQuery.in("ticket_type_id", checkinList.ticket_type_ids)
  }

  if (addonFilteredRegIds !== null) {
    dbQuery = dbQuery.in("id", addonFilteredRegIds)
  }

  if (query) {
    const sanitized = sanitizeSearchInput(query)
    dbQuery = dbQuery.or(
      `attendee_name.ilike.%${sanitized}%,registration_number.ilike.%${sanitized}%,attendee_email.ilike.%${sanitized}%,attendee_phone.ilike.%${sanitized}%`
    )
  }

  dbQuery = dbQuery.range(offset, offset + limit - 1)

  const { data: registrations, error, count } = await dbQuery
  if (error) {
    return NextResponse.json({ error: "Failed to load attendees" }, { status: 500 })
  }

  // Merge check-in status for this list
  let checkinMap: Record<string, any> = {}
  if (registrations && registrations.length > 0) {
    const regIds = registrations.map((r: any) => r.id)
    const { data: records } = await (supabase as any)
      .from("checkin_records")
      .select("registration_id, checked_in_at")
      .eq("checkin_list_id", checkinList.id)
      .in("registration_id", regIds)
      .is("checked_out_at", null)
    checkinMap = (records || []).reduce((acc: any, r: any) => {
      acc[r.registration_id] = r
      return acc
    }, {})
  }

  let merged = (registrations || []).map((r: any) => ({
    id: r.id,
    registration_number: r.registration_number,
    attendee_name: r.attendee_name,
    attendee_email: r.attendee_email,
    attendee_institution: r.attendee_institution,
    attendee_designation: r.attendee_designation,
    ticket_type: r.ticket_types ? { name: r.ticket_types.name } : null,
    checked_in: !!checkinMap[r.id],
    checked_in_at: checkinMap[r.id]?.checked_in_at || null,
  }))

  // Filter by status post-merge (cheap — already paginated)
  if (status === "checked_in") {
    merged = merged.filter((r: { checked_in: boolean }) => r.checked_in)
  } else if (status === "not_checked_in") {
    merged = merged.filter((r: { checked_in: boolean }) => !r.checked_in)
  }

  return NextResponse.json({
    data: merged,
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  })
}
