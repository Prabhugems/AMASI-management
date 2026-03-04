import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { reassignPending } from "@/app/api/abstract-reviewers/[eventId]/assign/route"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase: SupabaseClient = await createAdminClient()
  const now = new Date().toISOString()

  // Find events with restrict_reviewers ON and review_deadline in the past
  const { data: settings, error } = await supabase
    .from("abstract_settings")
    .select("event_id, review_deadline")
    .eq("restrict_reviewers", true)
    .not("review_deadline", "is", null)
    .lt("review_deadline", now)

  if (error) {
    console.error("Cron reassign-reviews: failed to fetch settings:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!settings || settings.length === 0) {
    return NextResponse.json({ message: "No events past review deadline", processed: 0 })
  }

  const results: { event_id: string; reassigned_count: number }[] = []

  for (const setting of settings) {
    try {
      const response = await reassignPending(supabase, setting.event_id)
      const body = await response.json()
      results.push({
        event_id: setting.event_id,
        reassigned_count: body.reassigned_count || 0,
      })
      console.log(`Cron reassign-reviews: event ${setting.event_id} — reassigned ${body.reassigned_count || 0}`)
    } catch (err) {
      console.error(`Cron reassign-reviews: error processing event ${setting.event_id}:`, err)
      results.push({ event_id: setting.event_id, reassigned_count: -1 })
    }
  }

  return NextResponse.json({
    message: `Processed ${settings.length} events`,
    processed: settings.length,
    results,
  })
}
