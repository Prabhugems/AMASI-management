import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createAdminClient()) as any
  const today = new Date().toISOString().split("T")[0]

  // Find events where end_date (or start_date if no end_date) has passed
  // and status is not already completed/cancelled/archived
  const { data: pastEvents, error: fetchError } = await supabase
    .from("events")
    .select("id, short_name, status, start_date, end_date")
    .not("status", "in", '("completed","archived")')
    .or(`end_date.lt.${today},and(end_date.is.null,start_date.lt.${today})`)

  if (fetchError) {
    console.error("Failed to fetch past events:", fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!pastEvents || pastEvents.length === 0) {
    return NextResponse.json({ message: "No events to auto-complete", updated: 0 })
  }

  const eventIds = pastEvents.map((e: { id: string }) => e.id)

  const { error: updateError } = await supabase
    .from("events")
    .update({ status: "completed" })
    .in("id", eventIds)

  if (updateError) {
    console.error("Failed to auto-complete events:", updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const names = pastEvents.map((e: { short_name?: string; id: string }) => e.short_name || e.id)
  console.log(`Auto-completed ${eventIds.length} events:`, names)

  return NextResponse.json({
    message: `Auto-completed ${eventIds.length} events`,
    updated: eventIds.length,
    events: names,
  })
}
