import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireEventAccess } from "@/lib/auth/api-auth"

// GET /api/analytics/event/[eventId] - Get event analytics (requires event access)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params

    // Check authorization
    const { error: authError } = await requireEventAccess(eventId)
    if (authError) return authError

    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    const days = parseInt(searchParams.get("days") || "30")
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get total page views and unique visitors
    const { data: pageViews, error: pvError } = await (supabase as any)
      .from("event_page_views")
      .select("id, visitor_id, page_type, device_type, referrer, utm_source, created_at")
      .eq("event_id", eventId)
      .gte("created_at", startDate.toISOString())

    if (pvError) {
      console.error("Error fetching page views:", pvError)
    }

    // Get registrations count
    const { count: registrationCount } = await (supabase as any)
      .from("registrations")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .neq("status", "cancelled")

    // Get leads count
    const { count: leadsCount } = await (supabase as any)
      .from("event_leads")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)

    // Calculate metrics
    const totalPageViews = pageViews?.length || 0
    const uniqueVisitors = new Set(pageViews?.map((pv: any) => pv.visitor_id)).size
    const registrationPageViews = pageViews?.filter((pv: any) => pv.page_type === "register").length || 0
    const checkoutPageViews = pageViews?.filter((pv: any) => pv.page_type === "checkout").length || 0

    // Device breakdown
    const deviceBreakdown = {
      desktop: pageViews?.filter((pv: any) => pv.device_type === "desktop").length || 0,
      mobile: pageViews?.filter((pv: any) => pv.device_type === "mobile").length || 0,
      tablet: pageViews?.filter((pv: any) => pv.device_type === "tablet").length || 0,
    }

    // Top referrers
    const referrerCounts: Record<string, number> = {}
    pageViews?.forEach((pv: any) => {
      if (pv.referrer) {
        try {
          const url = new URL(pv.referrer)
          const domain = url.hostname
          referrerCounts[domain] = (referrerCounts[domain] || 0) + 1
        } catch {
          referrerCounts[pv.referrer] = (referrerCounts[pv.referrer] || 0) + 1
        }
      }
    })
    const topReferrers = Object.entries(referrerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([source, count]) => ({ source, count }))

    // UTM sources
    const utmCounts: Record<string, number> = {}
    pageViews?.forEach((pv: any) => {
      if (pv.utm_source) {
        utmCounts[pv.utm_source] = (utmCounts[pv.utm_source] || 0) + 1
      }
    })
    const topUtmSources = Object.entries(utmCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([source, count]) => ({ source, count }))

    // Daily breakdown for chart
    const dailyData: Record<string, { views: number; visitors: Set<string> }> = {}
    pageViews?.forEach((pv: any) => {
      const date = pv.created_at.split("T")[0]
      if (!dailyData[date]) {
        dailyData[date] = { views: 0, visitors: new Set() }
      }
      dailyData[date].views++
      dailyData[date].visitors.add(pv.visitor_id)
    })

    const chartData = Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        views: data.views,
        visitors: data.visitors.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Conversion funnel
    const funnel = {
      eventPageViews: pageViews?.filter((pv: any) => pv.page_type === "event").length || 0,
      registrationPageViews,
      checkoutPageViews,
      registrations: registrationCount || 0,
    }

    // Conversion rates
    const conversionRate = uniqueVisitors > 0
      ? ((registrationCount || 0) / uniqueVisitors * 100).toFixed(2)
      : "0.00"

    const checkoutToRegRate = checkoutPageViews > 0
      ? ((registrationCount || 0) / checkoutPageViews * 100).toFixed(2)
      : "0.00"

    return NextResponse.json({
      summary: {
        totalPageViews,
        uniqueVisitors,
        registrations: registrationCount || 0,
        leads: leadsCount || 0,
        conversionRate: parseFloat(conversionRate),
        checkoutConversionRate: parseFloat(checkoutToRegRate),
      },
      deviceBreakdown,
      topReferrers,
      topUtmSources,
      chartData,
      funnel,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error("Error in GET /api/analytics/event:", error)
    return NextResponse.json({ error: "Failed to fetch event analytics" }, { status: 500 })
  }
}
