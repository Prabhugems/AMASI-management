"use client"

import { type ReactNode, useEffect, useRef, useState } from "react"
import Link from "next/link"

function useCountUp(target: number, duration = 1300) {
  const [value, setValue] = useState(0)
  const ref = useRef<HTMLParagraphElement>(null)
  const counted = useRef(false)

  useEffect(() => {
    if (counted.current || target === 0) { setValue(target); return }
    const el = ref.current
    if (!el) return

    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || counted.current) return
      counted.current = true
      obs.disconnect()

      const start = performance.now()
      const step = (now: number) => {
        const t = Math.min((now - start) / duration, 1)
        const ease = 1 - Math.pow(1 - t, 3)
        setValue(Math.round(ease * target))
        if (t < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, { threshold: 0.3 })

    obs.observe(el)
    return () => obs.disconnect()
  }, [target, duration])

  return { value, ref }
}

interface MetricCardProps {
  icon: ReactNode
  label: string
  value: number | string
  tone?: "mint" | "gold"
  href?: string
}

export function MetricCard({ icon, label, value, tone = "mint", href }: MetricCardProps) {
  const isNum = typeof value === "number"
  const { value: animated, ref: countRef } = useCountUp(isNum ? value : 0)
  const display = isNum ? animated.toLocaleString() : value

  const inner = (
    <div className="inner">
      <div className="stat-icon">{icon}</div>
      <p className="stat-label uppercase">{label}</p>
      <p className="stat-value" ref={countRef}>{display}</p>
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
