import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { sanitizeSearchInput, isValidUUID } from "@/lib/validation"

// GET /api/help-desk/search?event_id=&q= -- partial-match search across name,
// email, registration number, and phone for the help desk screen (work order
// §4). Mirrors /api/checkin's search fields, but scoped with
// requireEventAndPermission (that route only used the weaker getApiUser()).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("event_id")
  const query = searchParams.get("q")

  if (!eventId || !isValidUUID(eventId)) {
    return NextResponse.json({ error: "Valid event_id is required" }, { status: 400 })
  }

  const { error: authError } = await requireEventAndPermission(eventId, "checkin")
  if (authError) return authError

  // Bug-audit fix (2026-08): sanitizeSearchInput escapes ilike wildcards
  // (%, _) and strips quotes/semicolons, but not the comma/parenthesis
  // characters that are structural in PostgREST's .or() filter syntax below
  // -- see /api/kiosk/checkin's own stripping of exactly these characters
  // for the identical reason. A delegate whose name or institution
  // legitimately contains one (e.g. "Apollo Hospitals (Cardiology), Chennai")
  // couldn't be found by the exact text on their badge.
  const term = sanitizeSearchInput((query || "").replace(/[(),]/g, ""))
  if (term.trim().length < 2) {
    return NextResponse.json({ data: [] })
  }

  const supabase = await createAdminClient()

  const { data, error } = await (supabase as any)
    .from("registrations")
    .select(
      "id, registration_number, attendee_name, attendee_email, attendee_phone, attendee_designation, attendee_institution, status, ticket_type:ticket_types(name)"
    )
    .eq("event_id", eventId)
    .or(
      `attendee_name.ilike.%${term}%,attendee_email.ilike.%${term}%,registration_number.ilike.%${term}%,attendee_phone.ilike.%${term}%`
    )
    .order("attendee_name")
    .limit(20)

  if (error) {
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }

  return NextResponse.json({ data: data || [] })
}
