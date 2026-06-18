import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"
import { sanitizeSearchInput, isValidUUID } from "@/lib/validation"

// GET /api/audio-devices/find-attendee?event_id=&q=
// Public, event-scoped, returns minimal attendee info for the audio-desk lookup.
export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`audio-desk-find:${ip}`, "authenticated")
  if (!rl.success) return rateLimitExceededResponse(rl)

  const { searchParams } = new URL(request.url)
  const event_id = searchParams.get("event_id")
  const q = searchParams.get("q")?.trim()
  if (!event_id || !isValidUUID(event_id)) return NextResponse.json({ error: "event_id required" }, { status: 400 })
  if (!q) return NextResponse.json({ data: null })

  const supabase = await createAdminClient()
  const needle = sanitizeSearchInput(q)

  const { data } = await (supabase as any)
    .from("registrations")
    .select("id, registration_number, attendee_name, ticket_types(name)")
    .eq("event_id", event_id)
    .eq("status", "confirmed")
    .or(`registration_number.ilike.%${needle}%,attendee_name.ilike.%${needle}%,attendee_phone.ilike.%${needle}%`)
    .order("registration_number", { ascending: true })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ data: data || null })
}
