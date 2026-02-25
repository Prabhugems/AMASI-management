import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { user: _user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Get all meal plans for this event
    const { data: mealPlans } = await db
      .from("meal_plans")
      .select("id, name, meal_type, date")
      .eq("event_id", eventId)

    if (!mealPlans || mealPlans.length === 0) {
      return NextResponse.json({ meals: [], totals: {} })
    }

    const mealPlanIds = mealPlans.map((m: { id: string }) => m.id)

    // Get all meal registrations with dietary info
    const { data: registrations } = await db
      .from("meal_registrations")
      .select("meal_plan_id, dietary_preference, status")
      .in("meal_plan_id", mealPlanIds)

    // Aggregate dietary preferences
    const totals: Record<string, number> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byMeal: Record<string, Record<string, number>> = {}

    for (const reg of (registrations || [])) {
      const pref = reg.dietary_preference || "regular"

      totals[pref] = (totals[pref] || 0) + 1

      if (!byMeal[reg.meal_plan_id]) {
        byMeal[reg.meal_plan_id] = {}
      }
      byMeal[reg.meal_plan_id][pref] = (byMeal[reg.meal_plan_id][pref] || 0) + 1
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meals = mealPlans.map((m: any) => ({
      ...m,
      dietary: byMeal[m.id] || {},
      totalRegistered: Object.values(byMeal[m.id] || {}).reduce((a: number, b) => a + (b as number), 0),
    }))

    return NextResponse.json({ meals, totals })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
