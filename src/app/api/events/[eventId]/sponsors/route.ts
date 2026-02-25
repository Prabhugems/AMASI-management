import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { user: _user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId } = await params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    let query = db
      .from("sponsors")
      .select("*, sponsor_tiers(id, name, color, display_order)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })

    if (status) {
      query = query.eq("status", status)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching sponsors:", error)
      return NextResponse.json({ error: "Failed to fetch sponsors" }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { user: _user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId } = await params
    const body = await request.json()

    const {
      name, tier_id, logo_url, website, description,
      company_address, company_phone, company_email,
      status: sponsorStatus, amount_agreed, amount_paid, payment_status, notes,
    } = body

    if (!name) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data, error } = await db
      .from("sponsors")
      .insert({
        event_id: eventId,
        name,
        tier_id: tier_id || null,
        logo_url: logo_url || null,
        website: website || null,
        description: description || null,
        company_address: company_address || null,
        company_phone: company_phone || null,
        company_email: company_email || null,
        status: sponsorStatus || "pending",
        amount_agreed: amount_agreed || 0,
        amount_paid: amount_paid || 0,
        payment_status: payment_status || "pending",
        notes: notes || null,
        confirmed_at: sponsorStatus === "confirmed" ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating sponsor:", error)
      return NextResponse.json({ error: "Failed to create sponsor" }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
