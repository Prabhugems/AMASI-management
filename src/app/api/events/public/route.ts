import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getTenant } from "@/lib/tenant"

// Events considered publicly listable/registerable. Keep in sync with the
// event_status enum — "planning" is not a member and was previously
// hardcoded here, which made every public events query 400.
const PUBLIC_EVENT_STATUSES = ["registration_open", "active", "ongoing"] as const

/**
 * GET /api/events/public?slug=xxx or ?id=xxx — single event with ticket_types.
 * GET /api/events/public (no slug/id) — list of publicly-listable events for
 * the tenant, each with ticket_types embedded.
 *
 * Public endpoint — no auth required. Uses admin client to bypass RLS on
 * ticket_types (there is no anonymous-read policy on that table, so a
 * client-side query for it silently returns zero rows — not an error —
 * which is what made the register listing page show every event as "Free"
 * to actual anonymous visitors despite real ticket prices existing).
 *
 * Scoped to the current tenant. A slug or id that resolves to another
 * tenant's event returns 404 — never leak cross-tenant event details to
 * a public caller.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get("slug")
  const id = searchParams.get("id")

  try {
    const supabase = await createAdminClient()

    if (!slug && !id) {
      const { data, error } = await supabase
        .from("events")
        .select(`*, ticket_types (*)`)
        .eq("tenant", getTenant())
        .in("status", PUBLIC_EVENT_STATUSES)
        .order("start_date", { ascending: true })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json(data || [])
    }

    let query = supabase
      .from("events")
      .select(`*, ticket_types (*)`)
      .eq("tenant", getTenant())

    if (id) {
      query = query.eq("id", id)
    } else {
      query = query.eq("slug", slug!)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
