"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus, LucideIcon } from "lucide-react"
import { formatNumber, formatCompactNumber, formatPercentage } from "@/lib/formatters"

interface StatCardProps {
  title: string
  value: number | string
  icon?: LucideIcon
  description?: string
  trend?: {
    value: number
    label?: string
  }
  format?: "number" | "compact" | "percentage" | "currency" | "none"
  className?: string
}

/**
 * Stat Card Component
 *
 * Display statistics with optional trend indicator
 *
 * Usage:
 * ```
 * <StatCard
 *   title="Total Registrations"
 *   value={1234}
 *   icon={Users}
 *   trend={{ value: 12.5, label: "vs last month" }}
 *   format="number"
 * />
 * ```
 */
export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  format = "number",
  className,
}: StatCardProps) {
  const formattedValue = React.useMemo(() => {
    if (typeof value === "string") return value
    switch (format) {
      case "number":
        return formatNumber(value)
      case "compact":
        return formatCompactNumber(value)
      case "percentage":
        return formatPercentage(value)
      case "currency":
        return value.toLocaleString("en-IN", {
          style: "currency",
          currency: "INR",
          minimumFractionDigits: 0,
        })
      case "none":
      default:
        return String(value)
    }
  }, [value, format])

  const TrendIcon = trend
    ? trend.value > 0
      ? TrendingUp
      : trend.value < 0
        ? TrendingDown
        : Minus
    : null

  const trendColor = trend
    ? trend.value > 0
      ? "text-green-600"
      : trend.value < 0
        ? "text-red-600"
        : "text-muted-foreground"
    : ""

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formattedValue}</div>
        {(trend || description) && (
          <div className="flex items-center gap-2 mt-1">
            {trend && (
              <span className={cn("flex items-center text-xs", trendColor)}>
                {TrendIcon && <TrendIcon className="h-3 w-3 mr-0.5" />}
                {trend.value > 0 ? "+" : ""}
                {formatPercentage(trend.value, 1)}
              </span>
            )}
            {description && (
              <span className="text-xs text-muted-foreground">{description}</span>
            )}
            {trend?.label && (
              <span className="text-xs text-muted-foreground">{trend.label}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Stat card grid
 */
export function StatCardGrid({
  stats,
  columns = 4,
  className,
}: {
  stats: StatCardProps[]
  columns?: 2 | 3 | 4
  className?: string
}) {
  const gridCols = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
  }

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  )
}

/**
 * Compact stat (inline)
 */
export function StatInline({
  label,
  value,
  trend,
  className,
}: {
  label: string
  value: number | string
  trend?: number
  className?: string
}) {
  const TrendIcon = trend
    ? trend > 0
      ? TrendingUp
      : trend < 0
        ? TrendingDown
        : null
    : null

  const trendColor = trend
    ? trend > 0
      ? "text-green-600"
      : trend < 0
        ? "text-red-600"
        : ""
    : ""

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">
        {typeof value === "number" ? formatNumber(value) : value}
      </span>
      {trend !== undefined && trend !== 0 && TrendIcon && (
        <span className={cn("flex items-center text-xs", trendColor)}>
          <TrendIcon className="h-3 w-3 mr-0.5" />
          {trend > 0 ? "+" : ""}
          {formatPercentage(trend, 1)}
        </span>
      )}
    </div>
  )
}

/**
 * Stat with progress bar
 */
export function StatWithProgress({
  title,
  value,
  max,
  icon: Icon,
  format = "number",
  className,
}: {
  title: string
  value: number
  max: number
  icon?: LucideIcon
  format?: "number" | "compact" | "percentage"
  className?: string
}) {
  const percentage = Math.min((value / max) * 100, 100)

  const formattedValue =
    format === "compact"
      ? formatCompactNumber(value)
      : format === "percentage"
        ? formatPercentage(value)
        : formatNumber(value)

  const formattedMax =
    format === "compact"
      ? formatCompactNumber(max)
      : format === "percentage"
        ? formatPercentage(max)
        : formatNumber(max)

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formattedValue}</div>
        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{formatPercentage(percentage, 0)}</span>
            <span>of {formattedMax}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Comparison stat
 */
export function StatComparison({
  title,
  current,
  previous,
  format = "number",
  className,
}: {
  title: string
  current: number
  previous: number
  format?: "number" | "compact" | "currency"
  className?: string
}) {
  const change = previous !== 0 ? ((current - previous) / previous) * 100 : 0
  const isPositive = change > 0
  const isNegative = change < 0

  const formatValue = (v: number) => {
    switch (format) {
      case "compact":
        return formatCompactNumber(v)
      case "currency":
        return v.toLocaleString("en-IN", {
          style: "currency",
          currency: "INR",
          minimumFractionDigits: 0,
        })
      default:
        return formatNumber(v)
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatValue(current)}</div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={cn(
              "flex items-center text-xs",
              isPositive && "text-green-600",
              isNegative && "text-red-600",
              !isPositive && !isNegative && "text-muted-foreground"
            )}
          >
            {isPositive && <TrendingUp className="h-3 w-3 mr-0.5" />}
            {isNegative && <TrendingDown className="h-3 w-3 mr-0.5" />}
            {isPositive ? "+" : ""}
            {formatPercentage(change, 1)}
          </span>
          <span className="text-xs text-muted-foreground">
            from {formatValue(previous)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
