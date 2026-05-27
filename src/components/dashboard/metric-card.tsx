import type { ReactNode } from "react"
import Link from "next/link"

interface MetricCardProps {
  icon: ReactNode
  label: string
  value: number | string
  tone?: "mint" | "gold"
  href?: string
}

export function MetricCard({ icon, label, value, tone = "mint", href }: MetricCardProps) {
  const display = typeof value === "number" ? value.toLocaleString() : value
  const inner = (
    <div className="inner">
      <div className="stat-icon">{icon}</div>
      <p className="stat-label uppercase">{label}</p>
      <p className="stat-value">{display}</p>
    </div>
  )
  if (href) {
    return (
      <Link href={href} className={`metal-card ${tone} min-w-0 cursor-pointer`}>
        {inner}
      </Link>
    )
  }
  return (
    <div className={`metal-card ${tone} min-w-0`}>
      {inner}
    </div>
  )
}

interface MetricPanelProps {
  children: ReactNode
  columns?: number
  className?: string
}

export function MetricPanel({ children, columns, className = "" }: MetricPanelProps) {
  const colClass =
    columns === 6
      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
      : columns === 5
        ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        : columns === 3
          ? "grid-cols-1 sm:grid-cols-3"
          : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
  return (
    <div className={`metal-panel ${className}`}>
      <div className={`grid ${colClass} gap-5 w-full`}>{children}</div>
    </div>
  )
}
