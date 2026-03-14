"use client"

import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  TrendingUp,
  Star,
  BarChart3,
  Loader2,
  AlertTriangle,
  Eye,
} from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts"

const STATUS_COLORS: Record<string, string> = {
  submitted: "#3b82f6",
  under_review: "#eab308",
  accepted: "#22c55e",
  rejected: "#ef4444",
  revision_requested: "#f97316",
  withdrawn: "#6b7280",
}

const CHART_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
]

interface AnalyticsData {
  summary: {
    total: number
    submitted: number
    under_review: number
    accepted: number
    rejected: number
    revision_requested: number
    withdrawn: number
    acceptance_rate: number
    review_progress: number
    avg_score: string
    total_reviews: number
    abstracts_with_reviews: number
  }
  charts: {
    status: { name: string; value: number; status: string }[]
    categories: { name: string; value: number }[]
    accepted_as: { name: string; value: number }[]
    submissions_trend: { date: string; submissions: number; decisions: number }[]
    recommendations: { name: string; value: number }[]
  }
}

export default function AnalyticsPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const { data, isLoading } = useQuery({
    queryKey: ["abstract-analytics", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/abstracts/analytics?event_id=${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch")
      return res.json() as Promise<AnalyticsData>
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No data available
      </div>
    )
  }

  const { summary, charts } = data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Analytics Dashboard</h1>
        <p className="text-muted-foreground">
          Visual insights into abstract submissions and reviews
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total</span>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{summary.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-blue-600">New</span>
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-600">{summary.submitted}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-yellow-600">In Review</span>
              <Eye className="h-4 w-4 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold text-yellow-600">{summary.under_review}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-green-600">Accepted</span>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">{summary.accepted}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-red-600">Rejected</span>
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600">{summary.rejected}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-orange-600">Revision</span>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-orange-600">{summary.revision_requested}</p>
          </CardContent>
        </Card>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80">Acceptance Rate</span>
              <TrendingUp className="h-5 w-5 text-white/60" />
            </div>
            <p className="text-4xl font-bold">{summary.acceptance_rate}%</p>
            <p className="text-sm text-white/60 mt-1">
              {summary.accepted} of {summary.accepted + summary.rejected + summary.revision_requested} decided
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80">Review Progress</span>
              <Users className="h-5 w-5 text-white/60" />
            </div>
            <p className="text-4xl font-bold">{summary.review_progress}%</p>
            <p className="text-sm text-white/60 mt-1">
              {summary.abstracts_with_reviews} of {summary.total} reviewed
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500 to-orange-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80">Average Score</span>
              <Star className="h-5 w-5 text-white/60" />
            </div>
            <p className="text-4xl font-bold">{summary.avg_score}<span className="text-xl">/10</span></p>
            <p className="text-sm text-white/60 mt-1">
              {summary.total_reviews} reviews total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submissions Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Submission Trend (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.submissions_trend}>
                  <defs>
                    <linearGradient id="colorSubmissions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDecisions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="submissions"
                    name="Submissions"
                    stroke="#3b82f6"
                    fill="url(#colorSubmissions)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="decisions"
                    name="Decisions"
                    stroke="#22c55e"
                    fill="url(#colorDecisions)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.status}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name || ""} ${((percent || 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {charts.status.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={STATUS_COLORS[entry.status] || CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number | undefined) => [value ?? 0, "Abstracts"]}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Category */}
        <Card>
          <CardHeader>
            <CardTitle>Submissions by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.categories.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    width={120}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                    {charts.categories.slice(0, 8).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Presentation Types */}
        <Card>
          <CardHeader>
            <CardTitle>Accepted Presentation Types</CardTitle>
          </CardHeader>
          <CardContent>
            {charts.accepted_as.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={charts.accepted_as}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {charts.accepted_as.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No accepted abstracts yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reviewer Recommendations */}
      {charts.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reviewer Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.recommendations}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                    {charts.recommendations.map((entry, index) => {
                      const color = entry.name.toLowerCase().includes("accept")
                        ? "#22c55e"
                        : entry.name.toLowerCase().includes("reject")
                        ? "#ef4444"
                        : "#eab308"
                      return <Cell key={`cell-${index}`} fill={color} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
