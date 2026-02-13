import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Find registration by portal_token in custom_fields
    const { data: registrations, error } = await db
      .from("registrations")
      .select("id, event_id, attendee_name, attendee_email, attendee_designation, custom_fields")
      .filter("custom_fields->>portal_token", "eq", token)

    if (error || !registrations || registrations.length === 0) {
      return NextResponse.json(
        { error: "Invalid or expired portal link" },
        { status: 404 }
      )
    }

    const registration = registrations[0]

    // Fetch event details
    const { data: event } = await db
      .from("events")
      .select("id, name, short_name, logo_url, start_date, end_date, venue_name")
      .eq("id", registration.event_id)
      .maybeSingle()

    return NextResponse.json({
      speaker: {
        id: registration.id,
        name: registration.attendee_name,
        email: registration.attendee_email,
        designation: registration.attendee_designation,
        bio_submitted: registration.custom_fields?.bio_submitted || false,
        photo_submitted: registration.custom_fields?.photo_submitted || false,
        presentation_submitted: registration.custom_fields?.presentation_submitted || false,
        bio_text: registration.custom_fields?.bio_text || "",
        photo_url: registration.custom_fields?.photo_url || "",
        presentation_url: registration.custom_fields?.presentation_url || "",
      },
      event,
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { bio_text, photo_url, presentation_url } = body

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Find registration by portal_token
    const { data: registrations, error: findError } = await db
      .from("registrations")
      .select("id, custom_fields")
      .filter("custom_fields->>portal_token", "eq", token)

    if (findError || !registrations || registrations.length === 0) {
      return NextResponse.json(
        { error: "Invalid or expired portal link" },
        { status: 404 }
      )
    }

    const registration = registrations[0]

    // Build updated custom_fields
    const updatedFields = {
      ...(registration.custom_fields || {}),
      bio_text: bio_text !== undefined ? bio_text : registration.custom_fields?.bio_text,
      bio_submitted: bio_text ? true : registration.custom_fields?.bio_submitted,
      photo_url: photo_url !== undefined ? photo_url : registration.custom_fields?.photo_url,
      photo_submitted: photo_url ? true : registration.custom_fields?.photo_submitted,
      presentation_url: presentation_url !== undefined ? presentation_url : registration.custom_fields?.presentation_url,
      presentation_submitted: presentation_url ? true : registration.custom_fields?.presentation_submitted,
      documents_submitted_at: new Date().toISOString(),
    }

    // Update documents_submitted if both bio and photo are done
    updatedFields.documents_submitted = updatedFields.bio_submitted && updatedFields.photo_submitted

    const { error: updateError } = await db
      .from("registrations")
      .update({ custom_fields: updatedFields })
      .eq("id", registration.id)

    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
