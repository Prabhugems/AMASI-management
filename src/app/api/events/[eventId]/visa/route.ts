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
      .from("visa_requests")
      .select("*, registrations(id, attendee_name, attendee_email)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })

    if (status) {
      query = query.eq("letter_status", status)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching visa requests:", error)
      return NextResponse.json({ error: "Failed to fetch visa requests" }, { status: 500 })
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
      registration_id, applicant_name, applicant_email,
      passport_number, nationality, passport_expiry,
      visa_type, embassy_country, travel_dates_from, travel_dates_to,
      letter_type, notes,
    } = body

    if (!applicant_name) {
      return NextResponse.json({ error: "Applicant name is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data, error } = await db
      .from("visa_requests")
      .insert({
        event_id: eventId,
        registration_id: registration_id || null,
        applicant_name,
        applicant_email: applicant_email || null,
        passport_number: passport_number || null,
        nationality: nationality || null,
        passport_expiry: passport_expiry || null,
        visa_type: visa_type || "conference",
        embassy_country: embassy_country || null,
        travel_dates_from: travel_dates_from || null,
        travel_dates_to: travel_dates_to || null,
        letter_type: letter_type || "invitation",
        letter_status: "pending",
        notes: notes || null,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating visa request:", error)
      return NextResponse.json({ error: "Failed to create visa request" }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
