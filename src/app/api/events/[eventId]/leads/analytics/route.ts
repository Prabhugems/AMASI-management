import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { createAdminClient } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data: leads, error } = await db
      .from("event_leads")
      .select("id, status, source, created_at, converted_at")
      .eq("event_id", eventId)

    if (error) {
      console.error("Error fetching lead analytics:", error)
      return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 })
    }

    const allLeads = leads || []
    const total = allLeads.length

    const byStatus: Record<string, number> = {}
    const bySource: Record<string, number> = {}
    const dayCounts: Record<string, number> = {}
    let convertedCount = 0

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    for (const lead of allLeads) {
      byStatus[lead.status] = (byStatus[lead.status] || 0) + 1

      const src = lead.source || "unknown"
      bySource[src] = (bySource[src] || 0) + 1

      if (lead.status === "converted") {
        convertedCount++
      }

      const createdDate = new Date(lead.created_at)
      if (createdDate >= thirtyDaysAgo) {
        const dateKey = createdDate.toISOString().split("T")[0]
        dayCounts[dateKey] = (dayCounts[dateKey] || 0) + 1
      }
    }

    const byDay = Object.entries(dayCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const conversionRate = total > 0 ? Math.round((convertedCount / total) * 10000) / 100 : 0

    return NextResponse.json({
      byStatus,
      bySource,
      byDay,
      conversionRate,
      total,
    })
  } catch (error: any) {
    console.error("Error in GET /api/events/[eventId]/leads/analytics:", error)
    return NextResponse.json({ error: error.message || "Server error" }, { status: error.status || 500 })
  }
}
