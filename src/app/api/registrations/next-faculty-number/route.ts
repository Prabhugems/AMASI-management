import { NextRequest, NextResponse } from "next/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { createAdminClient } from "@/lib/supabase/server"
import { getNextFacultyRegistrationNumber } from "@/lib/services/registration-number"

// GET /api/registrations/next-faculty-number?event_id=…
// Returns the next faculty registration number (e.g. TECH-F-1002) and
// increments the counter. Used by the admin /faculty page which inserts
// the registration client-side via Supabase RLS — server can't run the
// helper there directly, so this thin endpoint exposes it under admin auth.
//
// Caveat: if the subsequent client-side insert fails, the counter has
// already advanced and the number is "burned". Acceptable for low-volume
// manual faculty additions; high-volume flows should use server-side insert.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("event_id")

  if (!eventId) {
    return NextResponse.json({ error: "event_id is required" }, { status: 400 })
  }

  const { error: authError } = await requireEventAndPermission(eventId, "registrations")
  if (authError) return authError

  const supabase = await createAdminClient()
  const registrationNumber = await getNextFacultyRegistrationNumber(supabase, eventId)

  return NextResponse.json({ registration_number: registrationNumber })
}
