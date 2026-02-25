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

    // Fetch registration income (completed payments)
    const { data: payments } = await db
      .from("payments")
      .select("amount")
      .eq("event_id", eventId)
      .eq("status", "completed")

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registrationIncome = (payments || []).reduce(
      (sum: number, p: any) => sum + (Number(p.amount) || 0),
      0
    )

    // Fetch sponsor income
    const { data: sponsors } = await db
      .from("sponsors")
      .select("amount_paid")
      .eq("event_id", eventId)

    const sponsorIncome = (sponsors || []).reduce(
      (sum: number, s: { amount_paid: number }) => sum + (Number(s.amount_paid) || 0),
      0
    )

    // Fetch budgets with items for expense breakdown
    const { data: budgets } = await db
      .from("budgets")
      .select("*, budget_items(*)")
      .eq("event_id", eventId)

    // Calculate expenses by category
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byCategory: Record<string, { estimated: number; actual: number }> = {}
    let totalEstimated = 0
    let totalActual = 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const budget of (budgets || []) as any[]) {
      const cat = budget.category || "miscellaneous"
      if (!byCategory[cat]) {
        byCategory[cat] = { estimated: 0, actual: 0 }
      }
      byCategory[cat].estimated += Number(budget.estimated_amount) || 0
      totalEstimated += Number(budget.estimated_amount) || 0

      // Sum actual from budget items where status is paid
      const itemsTotal = (budget.budget_items || []).reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sum: number, item: any) => {
          const itemAmount = (Number(item.amount) || 0) * (Number(item.quantity) || 1)
          return sum + (item.status === "paid" ? itemAmount : 0)
        },
        0
      )
      byCategory[cat].actual += itemsTotal
      totalActual += itemsTotal
    }

    const totalIncome = registrationIncome + sponsorIncome

    return NextResponse.json({
      income: {
        registrations: registrationIncome,
        sponsors: sponsorIncome,
        total: totalIncome,
      },
      expenses: {
        byCategory,
        estimated: totalEstimated,
        actual: totalActual,
      },
      balance: totalIncome - totalActual,
      budgetCount: (budgets || []).length,
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
