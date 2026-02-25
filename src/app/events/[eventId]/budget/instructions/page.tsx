"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import {
  BookOpen,
  DollarSign,
  Plus,
  Settings,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  Receipt,
  TrendingUp,
  PieChart,
  FolderOpen,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function BudgetInstructionsPage() {
  const params = useParams()
  const eventId = params.eventId as string

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Budget Instructions
        </h1>
        <p className="text-muted-foreground mt-1">Learn how to manage your event budget and track expenses</p>
      </div>

      <div className="space-y-6">
        {/* Quick Start */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Quick Start Guide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</div>
                <div>
                  <p className="font-medium">Create Budget Categories</p>
                  <p className="text-sm text-muted-foreground">Set up categories like venue, catering, printing, travel, marketing, etc.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
                <div>
                  <p className="font-medium">Add Expense Items</p>
                  <p className="text-sm text-muted-foreground">Add individual expenses under each category with estimated and actual amounts</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</div>
                <div>
                  <p className="font-medium">Track Payments</p>
                  <p className="text-sm text-muted-foreground">Update payment statuses as expenses are approved and paid</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">4</div>
                <div>
                  <p className="font-medium">Review Summary</p>
                  <p className="text-sm text-muted-foreground">Monitor the budget overview to track spending against planned amounts</p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <Link href={`/events/${eventId}/budget`}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Go to Budget Overview
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Budget Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Budget Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">venue</Badge>
                  <span className="text-sm">Venue hire, setup, and related costs</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">catering</Badge>
                  <span className="text-sm">Food, beverages, and catering services</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">printing</Badge>
                  <span className="text-sm">Badges, banners, brochures, and print materials</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20">travel</Badge>
                  <span className="text-sm">Travel and accommodation for speakers/faculty</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-pink-500/10 text-pink-600 border-pink-500/20">marketing</Badge>
                  <span className="text-sm">Advertising, social media, and promotional expenses</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-cyan-500/10 text-cyan-600 border-cyan-500/20">av_equipment</Badge>
                  <span className="text-sm">Audio-visual equipment and technical setup</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">gifts</Badge>
                  <span className="text-sm">Speaker gifts, mementos, and giveaways</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/20">misc</Badge>
                  <span className="text-sm">Miscellaneous and uncategorized expenses</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statuses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Understanding Statuses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Budget Status</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Planned</Badge>
                      <span className="text-sm">Budget is drafted but not yet finalized</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Approved</Badge>
                      <span className="text-sm">Budget has been approved and is active</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Spent</Badge>
                      <span className="text-sm">Funds have been spent from this budget</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/20">Closed</Badge>
                      <span className="text-sm">Budget period has ended, no further changes</span>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Expense Item Status</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Pending</Badge>
                      <span className="text-sm">Expense submitted, awaiting approval</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Approved</Badge>
                      <span className="text-sm">Expense approved, ready to be paid</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Paid</Badge>
                      <span className="text-sm">Payment has been completed</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20">Rejected</Badge>
                      <span className="text-sm">Expense was rejected and will not be paid</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Budget Features Explained
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Income Tracking</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Track income from registrations and sponsor contributions alongside expenses for a complete financial picture.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Monitor how registration revenue offsets event costs
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <PieChart className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Expense Breakdown</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  View expenses grouped by category to understand where money is being spent.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Identify which categories are over or under budget
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Balance Overview</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  See at a glance total planned vs actual spend, remaining budget, and overall balance.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Quick financial health check before making new commitments
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Best Practices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              Best Practices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Create <strong>all budget categories upfront</strong> before adding individual expenses</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Add <strong>estimated amounts first</strong>, then update with actuals as expenses are paid</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Keep a <strong>contingency buffer</strong> of 10-15% in miscellaneous for unexpected costs</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Review the <strong>budget summary regularly</strong> to catch overruns early</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Use <strong>descriptive expense names</strong> so others can understand each line item</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Troubleshooting */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Troubleshooting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-medium text-sm text-amber-800">Budget totals not matching?</p>
                <p className="text-xs text-amber-700 mt-1">
                  Check that all expense items have the correct amounts. The overview sums all items across categories.
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-medium text-sm text-amber-800">Expense not appearing in the overview?</p>
                <p className="text-xs text-amber-700 mt-1">
                  Ensure the expense is assigned to a valid category. Unassigned items may not show in category breakdowns.
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-medium text-sm text-amber-800">Income from registrations not reflected?</p>
                <p className="text-xs text-amber-700 mt-1">
                  Registration income is pulled from confirmed payments. Pending orders are not included in the income total.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Link href={`/events/${eventId}/budget`}>
                <Button variant="outline" size="sm">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Budget Overview
                </Button>
              </Link>
              <Link href={`/events/${eventId}/budget/expenses`}>
                <Button variant="outline" size="sm">
                  <Receipt className="h-4 w-4 mr-2" />
                  Manage Expenses
                </Button>
              </Link>
              <Link href={`/events/${eventId}/sponsors`}>
                <Button variant="outline" size="sm">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Sponsor Income
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
