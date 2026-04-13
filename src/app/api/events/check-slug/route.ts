import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getApiUser } from "@/lib/auth/api-auth"

// GET /api/events/check-slug?slug=xxx&exclude_id=xxx
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

    let query = supabase
      .from("events")
      .select("id, slug")
      .eq("slug", slug)

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
      // Find an available suggestion
      for (let i = 2; i <= 10; i++) {
        const candidate = `${slug}-${i}`
        const { data: check } = await supabase
          .from("events")
          .select("id")
          .eq("slug", candidate)
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
