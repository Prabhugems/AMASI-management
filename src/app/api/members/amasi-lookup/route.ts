import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

// GET /api/members/amasi-lookup?email=xxx
//
// Local-only lookup against the `active_amasi_members` view (status='active').
// The external application.amasi.org API is no longer the source of truth —
// all member records are now imported into this Supabase.
export async function GET(request: NextRequest) {
  // Rate limit: strict tier to prevent enumeration
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(`amasi-lookup:${ip}`, "strict")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  const { searchParams } = new URL(request.url)
  const email = searchParams.get("email")?.trim()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Valid email is required" },
      { status: 400 }
    )
  }

  try {
    const supabaseClient = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = supabaseClient as any

    // Query `members` directly (not the view) so we can surface the richer
    // profile fields — pg_degree, pg_college, address — for form auto-fill.
    // The `status='active'` filter gives us the same gate as the view.
    const { data: members, error } = await supabase
      .from("members")
      .select(
        "id, amasi_number, name, email, phone, membership_type, pg_degree, pg_college, city, state, country"
      )
      .eq("status", "active")
      .ilike("email", email)
      .limit(1)

    if (error) {
      console.error("AMASI lookup error:", error)
      return NextResponse.json(
        { error: "Failed to lookup member" },
        { status: 500 }
      )
    }

    const local = members?.[0]
    if (!local) {
      return NextResponse.json({ found: false })
    }

    // Split single `name` into first/last for consumers that expect the old shape.
    const parts = String(local.name || "").trim().split(/\s+/)
    const first_name = parts[0] || null
    const last_name = parts.slice(1).join(" ") || null

    const member = {
      salutation: null,
      first_name,
      last_name,
      name: local.name || null,
      email: local.email || email,
      phone: local.phone != null ? String(local.phone) : null,
      designation: local.pg_degree || null,
      institution: local.pg_college || null,
      city: local.city || null,
      state: local.state || null,
      country: local.country || null,
      amasi_number: local.amasi_number != null ? String(local.amasi_number) : null,
      membership_type: local.membership_type || null,
    }

    return NextResponse.json({
      found: true,
      source: "local",
      member,
    })
  } catch (error) {
    console.error("Error in AMASI lookup:", error)
    return NextResponse.json(
      { error: "Failed to lookup member" },
      { status: 500 }
    )
  }
}
