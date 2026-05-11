import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getTenant } from "@/lib/tenant"

/**
 * GET /api/events/public?slug=xxx or ?id=xxx
 * Public endpoint - no auth required. Returns event with ticket_types.
 * Uses admin client to bypass RLS on ticket_types table.
 *
 * Scoped to the current tenant. A slug or id that resolves to another
 * tenant's event returns 404 — never leak cross-tenant event details to
 * a public caller.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get("slug")
  const id = searchParams.get("id")

  if (!slug && !id) {
    return NextResponse.json({ error: "slug or id required" }, { status: 400 })
  }

  try {
    const supabase = await createAdminClient()

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
