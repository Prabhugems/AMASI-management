import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { validatePagination, sanitizeSearchInput, isValidUUID } from "@/lib/validation"

// GET /api/checkin - Search for attendees (with check-in status for a specific list)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")
    const checkinListId = searchParams.get("checkin_list_id")
    const query = searchParams.get("q")
    const ticketTypeId = searchParams.get("ticket_type_id")
    const checkedIn = searchParams.get("checked_in")

    // Validate required fields
    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    // Validate UUID formats
    if (!isValidUUID(eventId)) {
      return NextResponse.json({ error: "Invalid event_id format" }, { status: 400 })
    }

    if (checkinListId && !isValidUUID(checkinListId)) {
      return NextResponse.json({ error: "Invalid checkin_list_id format" }, { status: 400 })
    }

    if (ticketTypeId && ticketTypeId !== "all" && !isValidUUID(ticketTypeId)) {
      return NextResponse.json({ error: "Invalid ticket_type_id format" }, { status: 400 })
    }

    // Validate and clamp pagination
    const { page, limit, offset } = validatePagination(
      searchParams.get("page"),
      searchParams.get("limit") || "50",
      200 // Max limit for checkin queries
    )

    const supabase = await createAdminClient()

    // Get the check-in list to filter by ticket types and addons if needed
    let allowedTicketTypes: string[] | null = null
    let allowedAddonIds: string[] | null = null
    if (checkinListId) {
      const { data: listData } = await (supabase as any)
        .from("checkin_lists")
        .select("ticket_type_ids, addon_ids")
        .eq("id", checkinListId)
        .single()

      if (listData?.ticket_type_ids?.length > 0) {
        allowedTicketTypes = listData.ticket_type_ids
      }
      if (listData?.addon_ids?.length > 0) {
        allowedAddonIds = listData.addon_ids
      }
    }

    // If addon filter is set, get registration IDs that have purchased those addons
    let addonFilteredRegIds: string[] | null = null
    if (allowedAddonIds) {
      const { data: addonRegs } = await (supabase as any)
        .from("registration_addons")
        .select("registration_id")
        .in("addon_id", allowedAddonIds)

      addonFilteredRegIds = [...new Set((addonRegs || []).map((r: any) => r.registration_id))] as string[]
    }

    // If filtering by checked_in status, first get the registration IDs
    let checkedInRegIds: string[] | null = null
    if (checkinListId && checkedIn) {
      const { data: checkinRecords } = await (supabase as any)
        .from("checkin_records")
        .select("registration_id")
        .eq("checkin_list_id", checkinListId)
        .is("checked_out_at", null)

      checkedInRegIds = (checkinRecords || []).map((r: any) => r.registration_id)
    }

    let dbQuery = (supabase as any)
      .from("registrations")
      .select(`
        id,
        registration_number,
        attendee_name,
        attendee_email,
        attendee_phone,
        attendee_institution,
        attendee_designation,
        ticket_type_id,
        status,
        created_at,
        ticket_types (id, name)
      `, { count: "exact" })
      .eq("event_id", eventId)
      .eq("status", "confirmed")
      .order("attendee_name", { ascending: true })

    // Filter by allowed ticket types from the check-in list
    if (allowedTicketTypes) {
      dbQuery = dbQuery.in("ticket_type_id", allowedTicketTypes)
    }

    // Filter by addon purchases (only registrations that have purchased required addons)
    if (addonFilteredRegIds !== null) {
      if (addonFilteredRegIds.length === 0) {
        // No registrations with these addons, return empty
        return NextResponse.json({
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0
        })
      }
      dbQuery = dbQuery.in("id", addonFilteredRegIds)
    }

    // Filter by checked_in status BEFORE pagination
    if (checkedIn === "true" && checkedInRegIds !== null) {
      if (checkedInRegIds.length === 0) {
        // No one is checked in, return empty
        return NextResponse.json({
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0
        })
      }
      dbQuery = dbQuery.in("id", checkedInRegIds)
    } else if (checkedIn === "false" && checkedInRegIds !== null) {
      if (checkedInRegIds.length > 0) {
        // Exclude checked-in registrations
        // Use NOT IN by filtering out the IDs
        dbQuery = dbQuery.not("id", "in", `(${checkedInRegIds.join(",")})`)
      }
    }

    // Apply additional filters
    if (query) {
      const sanitizedQuery = sanitizeSearchInput(query)
      dbQuery = dbQuery.or(`attendee_name.ilike.%${sanitizedQuery}%,attendee_email.ilike.%${sanitizedQuery}%,registration_number.ilike.%${sanitizedQuery}%,attendee_phone.ilike.%${sanitizedQuery}%`)
    }

    if (ticketTypeId && ticketTypeId !== "all") {
      dbQuery = dbQuery.eq("ticket_type_id", ticketTypeId)
    }

    // Pagination
    dbQuery = dbQuery.range(offset, offset + limit - 1)

    const { data: registrations, error, count } = await dbQuery

    if (error) {
      return NextResponse.json({ error: "Failed to search attendees" }, { status: 500 })
    }

    // Get check-in records for this list (for all fetched registrations)
    let checkinRecordsMap: Record<string, any> = {}
    if (checkinListId && registrations?.length > 0) {
      const regIds = registrations.map((r: any) => r.id)
      const { data: records } = await (supabase as any)
        .from("checkin_records")
        .select("*")
        .eq("checkin_list_id", checkinListId)
        .in("registration_id", regIds)
        .is("checked_out_at", null)

      checkinRecordsMap = (records || []).reduce((acc: any, r: any) => {
        acc[r.registration_id] = r
        return acc
      }, {})
    }

    // Merge check-in status with registrations
    const dataWithCheckin = (registrations || []).map((r: any) => ({
      ...r,
      checked_in: !!checkinRecordsMap[r.id],
      checked_in_at: checkinRecordsMap[r.id]?.checked_in_at || null,
      checked_in_by: checkinRecordsMap[r.id]?.checked_in_by || null,
      checkin_record_id: checkinRecordsMap[r.id]?.id || null
    }))

    return NextResponse.json({
      data: dataWithCheckin,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    })
  } catch (error: any) {
    console.error("Error searching attendees:", error)
    return NextResponse.json({ error: "Failed to search attendees" }, { status: 500 })
  }
}

// POST /api/checkin - Check in/out an attendee to a specific list
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { registration_id, registration_number, event_id, checkin_list_id, action, user_id } = body

    if (!event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    if (!checkin_list_id) {
      return NextResponse.json({ error: "checkin_list_id is required" }, { status: 400 })
    }

    if (!registration_id && !registration_number) {
      return NextResponse.json({ error: "registration_id or registration_number is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Find the registration
    let query = (supabase as any)
      .from("registrations")
      .select(`
        id,
        registration_number,
        attendee_name,
        attendee_email,
        attendee_phone,
        attendee_institution,
        attendee_designation,
        ticket_type_id,
        status,
        ticket_types (id, name)
      `)
      .eq("event_id", event_id)

    if (registration_id) {
      query = query.eq("id", registration_id)
    } else {
      query = query.eq("registration_number", registration_number)
    }

    const { data: registration, error: findError } = await query.single()

    if (findError || !registration) {
      return NextResponse.json({
        error: "Attendee not found",
        registration_number: registration_number || registration_id
      }, { status: 404 })
    }

    // Check if registration is confirmed
    if (registration.status !== "confirmed") {
      return NextResponse.json({
        error: `Cannot check in: Registration status is "${registration.status}"`,
        registration
      }, { status: 400 })
    }

    // Verify the check-in list exists and check ticket type restrictions
    const { data: checkinList, error: listError } = await (supabase as any)
      .from("checkin_lists")
      .select("*")
      .eq("id", checkin_list_id)
      .eq("event_id", event_id)
      .single()

    if (listError || !checkinList) {
      return NextResponse.json({ error: "Check-in list not found" }, { status: 404 })
    }

    // Check if ticket type is allowed for this list
    if (checkinList.ticket_type_ids?.length > 0 && !checkinList.ticket_type_ids.includes(registration.ticket_type_id)) {
      return NextResponse.json({
        error: `This ticket type is not allowed for "${checkinList.name}"`,
        registration
      }, { status: 400 })
    }

    // Check if registration has required addons for this list
    if (checkinList.addon_ids?.length > 0) {
      const { data: regAddons } = await (supabase as any)
        .from("registration_addons")
        .select("addon_id")
        .eq("registration_id", registration.id)
        .in("addon_id", checkinList.addon_ids)

      if (!regAddons || regAddons.length === 0) {
        // Fetch addon names for error message
        const { data: addonNames } = await (supabase as any)
          .from("addons")
          .select("name")
          .in("id", checkinList.addon_ids)

        const addonNameList = (addonNames || []).map((a: any) => a.name).join(", ")
        return NextResponse.json({
          error: `This attendee has not purchased the required addon(s): ${addonNameList}`,
          registration
        }, { status: 400 })
      }
    }

    // Check if already checked in to this list
    const { data: existingRecord } = await (supabase as any)
      .from("checkin_records")
      .select("*")
      .eq("checkin_list_id", checkin_list_id)
      .eq("registration_id", registration.id)
      .is("checked_out_at", null)
      .maybeSingle()

    const isCheckedIn = !!existingRecord
    const shouldCheckIn = action === "check_in" || (action === "toggle" && !isCheckedIn)

    if (shouldCheckIn) {
      if (isCheckedIn) {
        // Already checked in
        return NextResponse.json({
          success: true,
          action: "already_checked_in",
          message: `${registration.attendee_name} is already checked in to ${checkinList.name}`,
          registration: { ...registration, checked_in: true, checked_in_at: existingRecord.checked_in_at }
        })
      }

      // Create check-in record
      const { data: newRecord, error: insertError } = await (supabase as any)
        .from("checkin_records")
        .insert({
          checkin_list_id: checkin_list_id,
          registration_id: registration.id,
          checked_in_at: new Date().toISOString(),
          checked_in_by: user_id || null
        })
        .select()
        .single()

      if (insertError) {
        return NextResponse.json({ error: "Failed to check in attendee" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        action: "checked_in",
        list_name: checkinList.name,
        registration: {
          ...registration,
          checked_in: true,
          checked_in_at: newRecord.checked_in_at,
          checkin_record_id: newRecord.id
        }
      })
    } else {
      // Check out - mark the record as checked out
      if (!isCheckedIn) {
        return NextResponse.json({
          success: true,
          action: "already_checked_out",
          message: `${registration.attendee_name} is not checked in to ${checkinList.name}`,
          registration: { ...registration, checked_in: false }
        })
      }

      const { error: updateError } = await (supabase as any)
        .from("checkin_records")
        .update({ checked_out_at: new Date().toISOString() })
        .eq("id", existingRecord.id)

      if (updateError) {
        return NextResponse.json({ error: "Failed to check out attendee" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        action: "checked_out",
        list_name: checkinList.name,
        registration: { ...registration, checked_in: false, checked_in_at: null }
      })
    }
  } catch (error: any) {
    console.error("Error checking in attendee:", error)
    return NextResponse.json({ error: "Failed to process check-in" }, { status: 500 })
  }
}

// PATCH /api/checkin - Bulk check-in to a specific list
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_id, checkin_list_id, registration_ids, action, user_id } = body

    if (!event_id || !checkin_list_id || !registration_ids?.length) {
      return NextResponse.json({ error: "event_id, checkin_list_id, and registration_ids are required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    const shouldCheckIn = action === "check_in"

    if (shouldCheckIn) {
      // Get existing check-in records
      const { data: existingRecords } = await (supabase as any)
        .from("checkin_records")
        .select("registration_id")
        .eq("checkin_list_id", checkin_list_id)
        .in("registration_id", registration_ids)
        .is("checked_out_at", null)

      const alreadyCheckedIn = new Set((existingRecords || []).map((r: any) => r.registration_id))
      const toCheckIn = registration_ids.filter((id: string) => !alreadyCheckedIn.has(id))

      if (toCheckIn.length > 0) {
        const records = toCheckIn.map((id: string) => ({
          checkin_list_id,
          registration_id: id,
          checked_in_at: new Date().toISOString(),
          checked_in_by: user_id || null
        }))

        const { error } = await (supabase as any)
          .from("checkin_records")
          .insert(records)

        if (error) {
          return NextResponse.json({ error: "Failed to bulk check in" }, { status: 500 })
        }
      }

      return NextResponse.json({
        success: true,
        action: "checked_in",
        count: toCheckIn.length,
        skipped: alreadyCheckedIn.size
      })
    } else {
      // Bulk check-out
      const { data, error } = await (supabase as any)
        .from("checkin_records")
        .update({ checked_out_at: new Date().toISOString() })
        .eq("checkin_list_id", checkin_list_id)
        .in("registration_id", registration_ids)
        .is("checked_out_at", null)
        .select()

      if (error) {
        return NextResponse.json({ error: "Failed to bulk check out" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        action: "checked_out",
        count: data?.length || 0
      })
    }
  } catch (error: any) {
    console.error("Error bulk checking in:", error)
    return NextResponse.json({ error: "Failed to process bulk check-in" }, { status: 500 })
  }
}
