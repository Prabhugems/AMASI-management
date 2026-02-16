import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// POST - Join waitlist
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_id, ticket_type_id, email, name, phone } = body

    if (!event_id || !email || !name) {
      return NextResponse.json(
        { error: "Missing required fields: event_id, email, name" },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    // Check if already on waitlist
    // Using type assertion since waitlist table is not in generated types yet
    const { data: existing } = await (supabase as any)
      .from("waitlist")
      .select("id")
      .eq("event_id", event_id)
      .eq("email", email.toLowerCase())
      .eq("ticket_type_id", ticket_type_id || null)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: "You are already on the waitlist for this event" },
        { status: 400 }
      )
    }

    // Check if already registered
    const { data: existingReg } = await supabase
      .from("registrations")
      .select("id")
      .eq("event_id", event_id)
      .eq("attendee_email", email.toLowerCase())
      .not("status", "in", "(cancelled,refunded)")
      .maybeSingle()

    if (existingReg) {
      return NextResponse.json(
        { error: "You are already registered for this event" },
        { status: 400 }
      )
    }

    // Get current waitlist position
    const { count } = await (supabase as any)
      .from("waitlist")
      .select("*", { count: "exact", head: true })
      .eq("event_id", event_id)
      .eq("ticket_type_id", ticket_type_id || null)
      .eq("status", "waiting")

    const position = (count || 0) + 1

    // Add to waitlist
    const { data, error } = await (supabase as any)
      .from("waitlist")
      .insert({
        event_id,
        ticket_type_id: ticket_type_id || null,
        email: email.toLowerCase(),
        name,
        phone,
        position,
        status: "waiting",
      })
      .select()
      .single()

    if (error) {
      console.error("Failed to add to waitlist:", error)
      return NextResponse.json(
        { error: "Failed to join waitlist" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      position,
      message: `You are #${position} on the waitlist`,
      data,
    })
  } catch (error: any) {
    console.error("Waitlist error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// GET - Check waitlist status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const event_id = searchParams.get("event_id")
    const email = searchParams.get("email")
    const ticket_type_id = searchParams.get("ticket_type_id")

    if (!event_id) {
      return NextResponse.json(
        { error: "Missing event_id" },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    // If email provided, check specific user's status
    if (email) {
      let query = (supabase as any)
        .from("waitlist")
        .select("*")
        .eq("event_id", event_id)
        .eq("email", email.toLowerCase())

      if (ticket_type_id) {
        query = query.eq("ticket_type_id", ticket_type_id)
      }

      const { data, error } = await query.maybeSingle()

      if (error || !data) {
        return NextResponse.json({ onWaitlist: false })
      }

      return NextResponse.json({
        onWaitlist: true,
        position: data.position,
        status: data.status,
        joinedAt: data.created_at,
      })
    }

    // Otherwise, return waitlist count
    let countQuery = (supabase as any)
      .from("waitlist")
      .select("*", { count: "exact", head: true })
      .eq("event_id", event_id)
      .eq("status", "waiting")

    if (ticket_type_id) {
      countQuery = countQuery.eq("ticket_type_id", ticket_type_id)
    }

    const { count } = await countQuery

    return NextResponse.json({
      waitlistCount: count || 0,
    })
  } catch (error: any) {
    console.error("Waitlist check error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
