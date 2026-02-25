import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string; id: string }> }
) {
  try {
    const { user: _user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId, id } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Get the waitlist entry
    const { data: entry, error: fetchError } = await db
      .from("waitlist")
      .select("*")
      .eq("id", id)
      .eq("event_id", eventId)
      .single()

    if (fetchError || !entry) {
      return NextResponse.json({ error: "Waitlist entry not found" }, { status: 404 })
    }

    if (entry.status === "converted") {
      return NextResponse.json({ error: "Already converted to registration" }, { status: 400 })
    }

    // Check if already registered
    const { data: existingReg } = await db
      .from("registrations")
      .select("id")
      .eq("event_id", eventId)
      .eq("attendee_email", entry.email)
      .not("status", "in", "(cancelled,refunded)")
      .maybeSingle()

    if (existingReg) {
      return NextResponse.json({ error: "This person is already registered" }, { status: 400 })
    }

    // Create registration
    const { data: registration, error: regError } = await db
      .from("registrations")
      .insert({
        event_id: eventId,
        ticket_type_id: entry.ticket_type_id,
        attendee_name: entry.name,
        attendee_email: entry.email,
        attendee_phone: entry.phone || null,
        status: "confirmed",
        source: "waitlist",
      })
      .select()
      .single()

    if (regError) {
      console.error("Error creating registration:", regError)
      return NextResponse.json({ error: "Failed to create registration" }, { status: 500 })
    }

    // Update waitlist entry
    const { error: updateError } = await db
      .from("waitlist")
      .update({
        status: "converted",
        converted_at: new Date().toISOString(),
        registration_id: registration.id,
      })
      .eq("id", id)

    if (updateError) {
      console.error("Error updating waitlist entry:", updateError)
    }

    return NextResponse.json({
      success: true,
      registration,
      message: `${entry.name} has been registered successfully`,
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
