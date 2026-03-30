// @ts-nocheck
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { NextRequest, NextResponse } from "next/server"

// POST /api/abstracts/verify-registrations - Bulk verify registrations for accepted abstracts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { event_id, abstract_ids } = body

    if (!event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const { error: authError } = await requireEventAndPermission(event_id, 'abstracts')
    if (authError) {
      return authError
    }

    const supabase = await createAdminClient()

    // Get all accepted abstracts for this event (or specific IDs)
    let query = (supabase as any)
      .from("abstracts")
      .select("id, presenting_author_email, presenting_author_name, registration_verified")
      .eq("event_id", event_id)
      .eq("status", "accepted")

    if (abstract_ids && abstract_ids.length > 0) {
      query = query.in("id", abstract_ids)
    }

    const { data: abstracts, error: fetchError } = await query

    if (fetchError) {
      console.error("Error fetching abstracts:", fetchError)
      return NextResponse.json({ error: "Failed to fetch abstracts" }, { status: 500 })
    }

    if (!abstracts || abstracts.length === 0) {
      return NextResponse.json({ message: "No accepted abstracts found" })
    }

    // Get all confirmed registrations for this event
    const { data: registrations, error: regError } = await (supabase as any)
      .from("registrations")
      .select("id, attendee_email, registration_number, attendee_name")
      .eq("event_id", event_id)
      .eq("status", "confirmed")

    if (regError) {
      console.error("Error fetching registrations:", regError)
      return NextResponse.json({ error: "Failed to fetch registrations" }, { status: 500 })
    }

    // Create email lookup map
    const registrationMap = new Map(
      (registrations || []).map(r => [r.attendee_email.toLowerCase(), r])
    )

    const results = {
      verified: [] as { abstract_id: string; presenter: string; registration_number: string }[],
      not_registered: [] as { abstract_id: string; presenter: string; email: string }[],
      already_verified: [] as { abstract_id: string; presenter: string }[],
    }

    // Check each abstract
    for (const abstract of abstracts) {
      if (abstract.registration_verified) {
        results.already_verified.push({
          abstract_id: abstract.id,
          presenter: abstract.presenting_author_name,
        })
        continue
      }

      const registration = registrationMap.get(abstract.presenting_author_email.toLowerCase())

      if (registration) {
        // Update abstract with registration
        await (supabase as any)
          .from("abstracts")
          .update({
            registration_id: registration.id,
            registration_verified: true,
            registration_verified_at: new Date().toISOString(),
          })
          .eq("id", abstract.id)

        results.verified.push({
          abstract_id: abstract.id,
          presenter: abstract.presenting_author_name,
          registration_number: registration.registration_number,
        })
      } else {
        results.not_registered.push({
          abstract_id: abstract.id,
          presenter: abstract.presenting_author_name,
          email: abstract.presenting_author_email,
        })
      }
    }

    return NextResponse.json({
      success: true,
      total_checked: abstracts.length,
      verified_count: results.verified.length,
      not_registered_count: results.not_registered.length,
      already_verified_count: results.already_verified.length,
      results,
    })
  } catch (error) {
    console.error("Error in verify registrations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/abstracts/verify-registrations - Get registration status summary
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const { error: authError } = await requireEventAndPermission(eventId, 'abstracts')
    if (authError) {
      return authError
    }

    const supabase = await createAdminClient()

    // Get summary
    const { data: abstracts, error } = await (supabase as any)
      .from("abstracts")
      .select(`
        id,
        title,
        presenting_author_name,
        presenting_author_email,
        registration_verified,
        registration_id,
        status,
        accepted_as
      `)
      .eq("event_id", eventId)
      .eq("status", "accepted")

    if (error) {
      console.error("Error fetching abstracts:", error)
      return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 })
    }

    const verified = abstracts?.filter(a => a.registration_verified) || []
    const notVerified = abstracts?.filter(a => !a.registration_verified) || []

    return NextResponse.json({
      total_accepted: abstracts?.length || 0,
      registration_verified: verified.length,
      registration_pending: notVerified.length,
      pending_list: notVerified.map(a => ({
        id: a.id,
        title: a.title,
        presenter: a.presenting_author_name,
        email: a.presenting_author_email,
        accepted_as: a.accepted_as,
      })),
    })
  } catch (error) {
    console.error("Error in GET verify registrations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
