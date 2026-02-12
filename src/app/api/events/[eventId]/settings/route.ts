import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAccess } from "@/lib/auth/api-auth"

// PATCH /api/events/[eventId]/settings - Update event settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params

    // Authentication & authorization check
    const { error: authError } = await requireEventAccess(eventId)
    if (authError) {
      return NextResponse.json({ error: authError }, { status: 403 })
    }

    const body = await request.json()

    const supabase = await createAdminClient()

    // Build update object with only valid fields
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    const allowedFields = [
      'name', 'short_name', 'slug', 'description', 'event_type', 'status',
      'start_date', 'end_date', 'venue_name', 'city', 'state', 'country',
      'timezone', 'is_public', 'registration_open', 'max_attendees',
      'contact_email', 'website_url', 'banner_url', 'logo_url', 'primary_color',
      'edition', 'scientific_chairman', 'organizing_chairman',
      'organized_by', 'signatory_title', 'signature_image_url'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const { data, error } = await (supabase as any)
      .from("events")
      .update(updateData)
      .eq("id", eventId)
      .select()
      .single()

    if (error) {
      console.error("Error updating event settings:", error)
      return NextResponse.json({ error: "Failed to update event settings" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error("Error in PATCH /api/events/[eventId]/settings:", error)
    return NextResponse.json({ error: "Failed to update event settings" }, { status: 500 })
  }
}
