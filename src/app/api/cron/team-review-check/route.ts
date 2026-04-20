import { createAdminClient } from "@/lib/supabase/server"
import { logCronRun } from "@/lib/services/cron-logger"
import { NextResponse } from "next/server"

/**
 * GET /api/cron/team-review-check
 * Flags active team members whose permissions haven't been reviewed in 90 days.
 * Called by Vercel Cron.
 */
export async function GET(request: Request) {
  // Verify cron secret - Vercel crons send authorization header
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const run = await logCronRun("team-review-check")
  try {
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Find active members not already flagged whose last review was > 90 days ago
    const { data: staleMembers, error: fetchError } = await db
      .from("team_members")
      .select("id")
      .eq("is_active", true)
      .eq("needs_review", false)
      .lt("last_reviewed_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())

    if (fetchError) {
      console.error("[team-review-check] Failed to query stale members:", fetchError)
      await run.err(fetchError)
      return NextResponse.json({ error: "Query failed" }, { status: 500 })
    }

    if (!staleMembers || staleMembers.length === 0) {
      await run.ok({ syncedCount: 0 })
      return NextResponse.json({ flagged: 0, message: "No members need review" })
    }

    const ids = staleMembers.map((m: { id: string }) => m.id)

    const { error: updateError } = await db
      .from("team_members")
      .update({ needs_review: true, updated_at: new Date().toISOString() })
      .in("id", ids)

    if (updateError) {
      console.error("[team-review-check] Failed to flag members:", updateError)
      await run.err(updateError)
      return NextResponse.json({ error: "Update failed" }, { status: 500 })
    }

    console.log(`[team-review-check] Flagged ${ids.length} members for review`)
    await run.ok({ syncedCount: ids.length })
    return NextResponse.json({ flagged: ids.length, ids })
  } catch (error) {
    console.error("[team-review-check] Error:", error)
    await run.err(error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
