import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getApiUser } from "@/lib/auth/api-auth"
import { getTenant } from "@/lib/tenant"

// GET /api/events/check-slug?slug=xxx&exclude_id=xxx
//
// Uniqueness is scoped to (slug, tenant), not just slug. The same slug can
// exist for both tenants — the public /register/[eventSlug] handler resolves
// the slug within the current tenant, so collisions across tenants are safe.
export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await getApiUser()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const slug = searchParams.get("slug")
    const excludeId = searchParams.get("exclude_id")

    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    const tenant = getTenant()

    let query = supabase
      .from("events")
      .select("id, slug")
      .eq("slug", slug)
      .eq("tenant", tenant)

    if (excludeId) {
      query = query.neq("id", excludeId)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error checking slug:", error)
      return NextResponse.json({ error: "Failed to check slug" }, { status: 500 })
    }

    const available = !data || data.length === 0

    let suggestion: string | undefined
    if (!available) {
      // Find an available suggestion within the current tenant.
      for (let i = 2; i <= 10; i++) {
        const candidate = `${slug}-${i}`
        const { data: check } = await supabase
          .from("events")
          .select("id")
          .eq("slug", candidate)
          .eq("tenant", tenant)
          .maybeSingle()

        if (!check) {
          suggestion = candidate
          break
        }
      }
    }

    return NextResponse.json({ available, suggestion })
  } catch (error) {
    console.error("Error in GET /api/events/check-slug:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
