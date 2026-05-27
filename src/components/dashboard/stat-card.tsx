'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'

function useCountUp(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let startTime: number
    let animationFrame: number

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(end * easeOut))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [end, duration])

  return count
}

function Sparkline({ data, height = 28, width = 72 }: { data: number[]; height?: number; width?: number }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`)
    .join(' ')
  return (
    <svg width={width} height={height} className="opacity-50 group-hover:opacity-100 transition-opacity duration-300">
      <polyline
        points={points}
        fill="none"
        stroke="#22d3ee"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface StatCardProps {
  icon: React.ElementType
  value: number
  label: string
  subtext: string
  trend?: number | null
  color: 'rose' | 'amber' | 'teal' | 'violet' | 'indigo' | 'emerald'
  delay?: number
  sparklineData?: number[]
}

export function StatCard({
  icon: Icon,
  value,
  label,
  subtext,
  trend = null,
  color: _color,
  delay = 0,
  sparklineData,
}: StatCardProps) {
  const [isVisible, setIsVisible] = useState(false)
  const count = useCountUp(isVisible ? value : 0, 2000)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  return (
    <div
      className={cn(
        'group relative rounded-2xl p-4 sm:p-5 overflow-hidden',
        'bg-card border border-border',
        'transition-all duration-500 ease-out',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        'hover:shadow-lg hover:shadow-black/5',
      )}
      style={{ transitionDelay: isVisible ? '0ms' : `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-4 sm:mb-5">
        <div className="rounded-lg bg-muted p-2 sm:p-2.5">
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600" strokeWidth={2} />
        </div>

        {trend !== null && (
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold',
              trend >= 0
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-rose-50 text-rose-600'
            )}
          >
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>

      <p className="text-[11px] sm:text-xs font-medium uppercase tracking-wider text-gray-400 mb-1">
        {label}
      </p>

      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums tracking-tight">
          {count.toLocaleString()}
        </p>

        {sparklineData && sparklineData.length >= 2 && (
          <Sparkline data={sparklineData} />
        )}
      </div>

      <p className="mt-2 sm:mt-3 text-[11px] sm:text-xs text-muted-foreground">
        {subtext}
      </p>
    </div>
  )
}
