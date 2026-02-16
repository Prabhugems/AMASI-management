import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { syncSpeakerStatus } from "@/lib/services/sync-speaker-status"

// POST — single speaker sync
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { user: _user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId } = await params
    const { email, status } = await request.json()

    if (!email || !status) {
      return NextResponse.json(
        { error: "email and status are required" },
        { status: 400 }
      )
    }

    const validStatuses = ["confirmed", "declined", "cancelled", "pending"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    if (status === "pending") {
      // For pending, just update registration (not a syncable status for assignments)
      const { data: registration } = await db
        .from("registrations")
        .select("id, custom_fields")
        .eq("event_id", eventId)
        .ilike("attendee_email", email.toLowerCase())
        .maybeSingle()

      if (registration) {
        await db
          .from("registrations")
          .update({
            status: "pending",
            custom_fields: {
              ...(registration.custom_fields || {}),
              invitation_status: "pending",
            },
          })
          .eq("id", registration.id)
      }
    } else {
      await syncSpeakerStatus(db, eventId, email, status)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Sync speaker status error:", error)
    return NextResponse.json(
      { error: "Failed to sync speaker status" },
      { status: 500 }
    )
  }
}

// PUT — bulk sync
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { user: _user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId } = await params
    const { speakers, status } = await request.json()

    if (!speakers?.length || !status) {
      return NextResponse.json(
        { error: "speakers array and status are required" },
        { status: 400 }
      )
    }

    const validStatuses = ["confirmed", "declined", "cancelled", "pending"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    for (const speaker of speakers) {
      if (!speaker.email) continue

      if (status === "pending") {
        const { data: registration } = await db
          .from("registrations")
          .select("id, custom_fields")
          .eq("event_id", eventId)
          .ilike("attendee_email", speaker.email.toLowerCase())
          .maybeSingle()

        if (registration) {
          await db
            .from("registrations")
            .update({
              status: "pending",
              custom_fields: {
                ...(registration.custom_fields || {}),
                invitation_status: "pending",
              },
            })
            .eq("id", registration.id)
        }
      } else {
        await syncSpeakerStatus(db, eventId, speaker.email, status)
      }
    }

    return NextResponse.json({ success: true, count: speakers.length })
  } catch (error: any) {
    console.error("Bulk sync speaker status error:", error)
    return NextResponse.json(
      { error: "Failed to bulk sync speaker status" },
      { status: 500 }
    )
  }
}
