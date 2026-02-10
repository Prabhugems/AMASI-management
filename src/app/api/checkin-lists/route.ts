import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getApiUser } from "@/lib/auth/api-auth"

// GET /api/checkin-lists - Get all check-in lists for an event
export async function GET(request: NextRequest) {
  const { error: authError } = await getApiUser()
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")
    const activeOnly = searchParams.get("active_only") === "true"

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    let query = (supabase as any)
      .from("checkin_lists")
      .select("*")
      .eq("event_id", eventId)

    // Filter by active status if requested (for Overview page)
    if (activeOnly) {
      query = query.eq("is_active", true)
    }

    const { data, error } = await query
      .order("sort_order")
      .order("created_at")

    if (error) {
      return NextResponse.json({ error: "Failed to process check-in list request" }, { status: 500 })
    }

    // Get stats for each list
    const listsWithStats = await Promise.all(
      (data || []).map(async (list: any) => {
        // Count total eligible registrations
        let totalQuery = (supabase as any)
          .from("registrations")
          .select("*", { count: "exact", head: true })
          .eq("event_id", eventId)
          .eq("status", "confirmed")

        if (list.ticket_type_ids && list.ticket_type_ids.length > 0) {
          totalQuery = totalQuery.in("ticket_type_id", list.ticket_type_ids)
        }

        // If addon_ids filter is set, we need to filter registrations that have purchased those addons
        let addonFilteredRegIds: string[] | null = null
        if (list.addon_ids && list.addon_ids.length > 0) {
          const { data: addonRegs } = await (supabase as any)
            .from("registration_addons")
            .select("registration_id")
            .in("addon_id", list.addon_ids)

          addonFilteredRegIds = [...new Set((addonRegs || []).map((r: any) => r.registration_id))] as string[]

          if (addonFilteredRegIds && addonFilteredRegIds.length > 0) {
            totalQuery = totalQuery.in("id", addonFilteredRegIds)
          } else {
            // No registrations with these addons
            return {
              ...list,
              stats: {
                total: 0,
                checkedIn: 0,
                remaining: 0,
                percentage: 0
              }
            }
          }
        }

        const { count: totalCount } = await totalQuery

        // Count checked-in registrations
        const { count: checkedInCount } = await (supabase as any)
          .from("checkin_records")
          .select("*", { count: "exact", head: true })
          .eq("checkin_list_id", list.id)
          .is("checked_out_at", null)

        return {
          ...list,
          stats: {
            total: totalCount || 0,
            checkedIn: checkedInCount || 0,
            remaining: (totalCount || 0) - (checkedInCount || 0),
            percentage: totalCount ? Math.round((checkedInCount || 0) / totalCount * 100) : 0
          }
        }
      })
    )

    return NextResponse.json(listsWithStats)
  } catch (error: any) {
    console.error("Error fetching check-in lists:", error)
    return NextResponse.json({ error: "Failed to process check-in list request" }, { status: 500 })
  }
}

// POST /api/checkin-lists - Create a new check-in list
export async function POST(request: NextRequest) {
  const { error: authError } = await getApiUser()
  if (authError) return authError

  try {
    const body = await request.json()
    const { event_id, name, description, ticket_type_ids, addon_ids, starts_at, ends_at, allow_multiple_checkins } = body

    if (!event_id || !name) {
      return NextResponse.json({ error: "event_id and name are required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Get max sort_order
    const { data: existing } = await (supabase as any)
      .from("checkin_lists")
      .select("sort_order")
      .eq("event_id", event_id)
      .order("sort_order", { ascending: false })
      .limit(1)

    const nextOrder = existing?.[0]?.sort_order ? existing[0].sort_order + 1 : 0

    const { data, error } = await (supabase as any)
      .from("checkin_lists")
      .insert({
        event_id,
        name,
        description,
        ticket_type_ids: ticket_type_ids || null,
        addon_ids: addon_ids || null,
        starts_at,
        ends_at,
        allow_multiple_checkins: allow_multiple_checkins || false,
        sort_order: nextOrder
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to process check-in list request" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Error creating check-in list:", error)
    return NextResponse.json({ error: "Failed to process check-in list request" }, { status: 500 })
  }
}

// PUT /api/checkin-lists - Update a check-in list
export async function PUT(request: NextRequest) {
  const { error: authError } = await getApiUser()
  if (authError) return authError

  try {
    const body = await request.json()
    const { id, name, description, ticket_type_ids, addon_ids, starts_at, ends_at, is_active, allow_multiple_checkins, sort_order } = body

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Get the current list to check for event_id
    const { data: currentList } = await (supabase as any)
      .from("checkin_lists")
      .select("event_id, ticket_type_ids, addon_ids")
      .eq("id", id)
      .single()

    const updateData: any = { updated_at: new Date().toISOString() }
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (ticket_type_ids !== undefined) updateData.ticket_type_ids = ticket_type_ids
    if (addon_ids !== undefined) updateData.addon_ids = addon_ids
    if (starts_at !== undefined) updateData.starts_at = starts_at
    if (ends_at !== undefined) updateData.ends_at = ends_at
    if (is_active !== undefined) updateData.is_active = is_active
    if (allow_multiple_checkins !== undefined) updateData.allow_multiple_checkins = allow_multiple_checkins
    if (sort_order !== undefined) updateData.sort_order = sort_order

    const { data, error } = await (supabase as any)
      .from("checkin_lists")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to process check-in list request" }, { status: 500 })
    }

    // Cleanup orphaned check-in records if ticket_type_ids were updated
    let cleanedUp = 0
    if (ticket_type_ids !== undefined && currentList?.event_id) {
      const newTicketTypeIds = ticket_type_ids || []

      // If restrictions are added (not empty), clean up orphaned records
      if (newTicketTypeIds.length > 0) {
        // Get all check-in records for this list
        const { data: checkinRecords } = await (supabase as any)
          .from("checkin_records")
          .select("id, registration_id")
          .eq("checkin_list_id", id)
          .is("checked_out_at", null)

        if (checkinRecords && checkinRecords.length > 0) {
          // Get registrations with their ticket types
          const regIds = checkinRecords.map((r: any) => r.registration_id)
          const { data: registrations } = await (supabase as any)
            .from("registrations")
            .select("id, ticket_type_id")
            .in("id", regIds)

          // Find orphaned records (ticket type not in allowed list)
          const regTicketMap = (registrations || []).reduce((acc: any, r: any) => {
            acc[r.id] = r.ticket_type_id
            return acc
          }, {})

          const orphanedRecordIds = checkinRecords
            .filter((r: any) => !newTicketTypeIds.includes(regTicketMap[r.registration_id]))
            .map((r: any) => r.id)

          // Delete orphaned records
          if (orphanedRecordIds.length > 0) {
            const { error: deleteError } = await (supabase as any)
              .from("checkin_records")
              .delete()
              .in("id", orphanedRecordIds)

            if (!deleteError) {
              cleanedUp = orphanedRecordIds.length
            }
          }
        }
      }
    }

    return NextResponse.json({ ...data, cleanedUp })
  } catch (error: any) {
    console.error("Error updating check-in list:", error)
    return NextResponse.json({ error: "Failed to process check-in list request" }, { status: 500 })
  }
}

// DELETE /api/checkin-lists - Delete a check-in list
export async function DELETE(request: NextRequest) {
  const { error: authError } = await getApiUser()
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    const { error } = await (supabase as any)
      .from("checkin_lists")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: "Failed to process check-in list request" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting check-in list:", error)
    return NextResponse.json({ error: "Failed to process check-in list request" }, { status: 500 })
  }
}
