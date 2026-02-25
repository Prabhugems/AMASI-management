"use client"

import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Loader2, IndianRupee, TrendingUp, TrendingDown, Wallet } from "lucide-react"

const CATEGORY_LABELS: Record<string, string> = {
  venue: "Venue",
  catering: "Catering",
  printing: "Printing",
  travel: "Travel",
  marketing: "Marketing",
  av_equipment: "AV Equipment",
  gifts: "Gifts",
  miscellaneous: "Miscellaneous",
}

type BudgetSummary = {
  income: { registrations: number; sponsors: number; total: number }
  expenses: {
    byCategory: Record<string, { estimated: number; actual: number }>
    estimated: number
    actual: number
  }
  balance: number
  budgetCount: number
}

export default function BudgetOverviewPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const { data: summary, isLoading } = useQuery({
    queryKey: ["budget-summary", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/budgets/summary`)
      if (!res.ok) throw new Error("Failed to fetch budget summary")
      return res.json() as Promise<BudgetSummary>
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!summary) return null

  const categoryEntries = Object.entries(summary.expenses.byCategory)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Budget Overview</h1>
        <p className="text-muted-foreground">Financial summary for this event</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-sm text-muted-foreground">Total Income</p>
          </div>
          <p className="text-2xl font-bold text-green-600">
            <IndianRupee className="h-5 w-5 inline" />
            {summary.income.total.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="bg-card rounded-lg border p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-sm text-muted-foreground">Total Expenses</p>
          </div>
          <p className="text-2xl font-bold text-red-600">
            <IndianRupee className="h-5 w-5 inline" />
            {summary.expenses.actual.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Estimated: {summary.expenses.estimated.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="bg-card rounded-lg border p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Wallet className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-sm text-muted-foreground">Balance</p>
          </div>
          <p className={`text-2xl font-bold ${summary.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
            <IndianRupee className="h-5 w-5 inline" />
            {Math.abs(summary.balance).toLocaleString("en-IN")}
            {summary.balance < 0 && " (deficit)"}
          </p>
        </div>

        <div className="bg-card rounded-lg border p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <IndianRupee className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-sm text-muted-foreground">Budget Categories</p>
          </div>
          <p className="text-2xl font-bold">{summary.budgetCount}</p>
        </div>
      </div>

      {/* Income Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border p-5">
          <h3 className="font-semibold mb-4">Income Breakdown</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm">Registration Fees</span>
              <span className="font-mono font-medium">
                {summary.income.registrations.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm">Sponsorships</span>
              <span className="font-mono font-medium">
                {summary.income.sponsors.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 font-semibold">
              <span className="text-sm">Total</span>
              <span className="font-mono">
                {summary.income.total.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>

        {/* Expense by Category */}
        <div className="bg-card rounded-lg border p-5">
          <h3 className="font-semibold mb-4">Expenses by Category</h3>
          {categoryEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses recorded yet</p>
          ) : (
            <div className="space-y-3">
              {categoryEntries.map(([cat, amounts]) => (
                <div key={cat} className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm">{CATEGORY_LABELS[cat] || cat}</span>
                  <div className="text-right">
                    <span className="font-mono font-medium">
                      {amounts.actual.toLocaleString("en-IN")}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      / {amounts.estimated.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between py-2 font-semibold">
                <span className="text-sm">Total</span>
                <span className="font-mono">
                  {summary.expenses.actual.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
