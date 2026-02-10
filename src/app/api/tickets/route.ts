import { createServerSupabaseClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { requireEventAccess } from "@/lib/auth/api-auth"

// GET - List tickets for an event
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    const eventId = searchParams.get("event_id")
    const status = searchParams.get("status")
    const includeHidden = searchParams.get("include_hidden") === "true"

    if (!eventId) {
      return NextResponse.json(
        { error: "event_id is required" },
        { status: 400 }
      )
    }

    let query = (supabase as any)
      .from("ticket_types")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true })

    if (status) {
      query = query.eq("status", status)
    }

    if (!includeHidden) {
      query = query.eq("is_hidden", false)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: "Failed to process ticket request" }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to process ticket request" }, { status: 500 })
  }
}

// POST - Create new ticket type
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const {
      event_id,
      name,
      description,
      price = 0,
      currency = "INR",
      quantity_total,
      min_per_order = 1,
      max_per_order = 10,
      sale_start_date,
      sale_end_date,
      status = "draft",
      is_hidden = false,
      requires_approval = false,
      tax_percentage = 18,
      sort_order,
    } = body

    if (!event_id || !name) {
      return NextResponse.json(
        { error: "event_id and name are required" },
        { status: 400 }
      )
    }

    const { error: authError } = await requireEventAccess(event_id)
    if (authError) return authError

    // Get the highest sort order if not provided
    let finalSortOrder = sort_order
    if (finalSortOrder === undefined) {
      const { data: existing } = await (supabase as any)
        .from("ticket_types")
        .select("sort_order")
        .eq("event_id", event_id)
        .order("sort_order", { ascending: false })
        .limit(1)

      finalSortOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 1
    }

    const { data, error } = await (supabase as any)
      .from("ticket_types")
      .insert({
        event_id,
        name,
        description,
        price,
        currency,
        quantity_total,
        min_per_order,
        max_per_order,
        sale_start_date: sale_start_date || null,
        sale_end_date: sale_end_date || null,
        status,
        is_hidden,
        requires_approval,
        tax_percentage,
        sort_order: finalSortOrder,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to process ticket request" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to process ticket request" }, { status: 500 })
  }
}
