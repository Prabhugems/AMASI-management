import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"
import { sanitizeSearchInput } from "@/lib/validation"

// GET /api/membership/applications - List membership applications
export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "authenticated")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  try {
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createAdminClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || "pending"
    const search = searchParams.get("search") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = (page - 1) * limit

    let query = (supabase as any)
      .from("membership_applications")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (status !== "all") {
      query = query.eq("status", status)
    }

    if (search) {
      const sanitized = sanitizeSearchInput(search)
      query = query.or(
        `name.ilike.%${sanitized}%,email.ilike.%${sanitized}%,application_number.ilike.%${sanitized}%`
      )
    }

    const { data, error, count } = await query

    if (error) {
      console.error("Error fetching applications:", error)
      return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 })
    }

    return NextResponse.json({ data, count, page, limit })
  } catch (error: any) {
    console.error("Error in GET /api/membership/applications:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
