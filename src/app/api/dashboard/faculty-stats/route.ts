import { NextResponse } from "next/server"
import { getApiUser } from "@/lib/auth/api-auth"
import { createAdminClient } from "@/lib/supabase/server"

export async function GET() {
  const { error: authError } = await getApiUser()
  if (authError) return authError

  const supabase = await createAdminClient()

  const [totalResult, activeResult, pendingResult, inactiveResult, recentResult] = await Promise.all([
    supabase.from("faculty").select("*", { count: "exact", head: true }),
    supabase.from("faculty").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("faculty").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("faculty").select("*", { count: "exact", head: true }).eq("status", "inactive"),
    supabase.from("faculty")
      .select("id, name, email, designation, institution, status, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ])

  return NextResponse.json({
    total: totalResult.count ?? 0,
    active: activeResult.count ?? 0,
    pending: pendingResult.count ?? 0,
    inactive: inactiveResult.count ?? 0,
    recent: recentResult.data || [],
  })
}
