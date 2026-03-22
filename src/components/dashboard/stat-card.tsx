'use client'

import { useState, useEffect } from 'react'
import { ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

// Animated Counter Hook
function useCountUp(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let startTime: number
    let animationFrame: number

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)

      // Ease out exponential
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

// Lightweight SVG sparkline for 7-day trends
function Sparkline({ data, color = "currentColor", height = 24, width = 80 }: { data: number[]; color?: string; height?: number; width?: number }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 2) - 1}`)
    .join(" ")
  return (
    <svg width={width} height={height} className="mt-1 opacity-70 group-hover:opacity-100 transition-opacity duration-300">
      <polyline
        points={points}
        fill="none"
        stroke={color}
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

const colorConfig = {
  rose: {
    gradient: 'from-rose-500 to-orange-500',
    lightBg: 'from-rose-50 to-orange-50',
    cardBg: 'bg-gradient-to-br from-white to-rose-50/30 dark:from-slate-800/50 dark:to-rose-950/10',
    iconBg: 'bg-gradient-to-br from-rose-500 to-orange-500',
    shadow: 'hover:shadow-rose-200/50 dark:hover:shadow-rose-500/20',
    borderAccent: 'border-l-rose-500',
    glow: 'bg-rose-500',
    ring: 'ring-rose-500/30',
  },
  amber: {
    gradient: 'from-amber-500 to-yellow-500',
    lightBg: 'from-amber-50 to-yellow-50',
    cardBg: 'bg-gradient-to-br from-white to-amber-50/30 dark:from-slate-800/50 dark:to-amber-950/10',
    iconBg: 'bg-gradient-to-br from-amber-500 to-yellow-500',
    shadow: 'hover:shadow-amber-200/50 dark:hover:shadow-amber-500/20',
    borderAccent: 'border-l-amber-500',
    glow: 'bg-amber-500',
    ring: 'ring-amber-500/30',
  },
  teal: {
    gradient: 'from-teal-500 to-cyan-500',
    lightBg: 'from-teal-50 to-cyan-50',
    cardBg: 'bg-gradient-to-br from-white to-teal-50/30 dark:from-slate-800/50 dark:to-teal-950/10',
    iconBg: 'bg-gradient-to-br from-teal-500 to-cyan-500',
    shadow: 'hover:shadow-teal-200/50 dark:hover:shadow-teal-500/20',
    borderAccent: 'border-l-teal-500',
    glow: 'bg-teal-500',
    ring: 'ring-teal-500/30',
  },
  violet: {
    gradient: 'from-violet-500 to-purple-500',
    lightBg: 'from-violet-50 to-purple-50',
    cardBg: 'bg-gradient-to-br from-white to-violet-50/30 dark:from-slate-800/50 dark:to-violet-950/10',
    iconBg: 'bg-gradient-to-br from-violet-500 to-purple-500',
    shadow: 'hover:shadow-violet-200/50 dark:hover:shadow-violet-500/20',
    borderAccent: 'border-l-violet-500',
    glow: 'bg-violet-500',
    ring: 'ring-violet-500/30',
  },
  indigo: {
    gradient: 'from-indigo-500 to-blue-500',
    lightBg: 'from-indigo-50 to-blue-50',
    cardBg: 'bg-gradient-to-br from-white to-indigo-50/30 dark:from-slate-800/50 dark:to-indigo-950/10',
    iconBg: 'bg-gradient-to-br from-indigo-500 to-blue-500',
    shadow: 'hover:shadow-indigo-200/50 dark:hover:shadow-indigo-500/20',
    borderAccent: 'border-l-indigo-500',
    glow: 'bg-indigo-500',
    ring: 'ring-indigo-500/30',
  },
  emerald: {
    gradient: 'from-emerald-500 to-green-500',
    lightBg: 'from-emerald-50 to-green-50',
    cardBg: 'bg-gradient-to-br from-white to-emerald-50/30 dark:from-slate-800/50 dark:to-emerald-950/10',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-green-500',
    shadow: 'hover:shadow-emerald-200/50 dark:hover:shadow-emerald-500/20',
    borderAccent: 'border-l-emerald-500',
    glow: 'bg-emerald-500',
    ring: 'ring-emerald-500/30',
  },
}

const sparklineColors: Record<string, string> = {
  rose: '#f43f5e',
  amber: '#f59e0b',
  teal: '#14b8a6',
  violet: '#8b5cf6',
  indigo: '#6366f1',
  emerald: '#10b981',
}

export function StatCard({
  icon: Icon,
  value,
  label,
  subtext,
  trend = null,
  color,
  delay = 0,
  sparklineData,
}: StatCardProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const count = useCountUp(isVisible ? value : 0, 2000)
  const colors = colorConfig[color]

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  return (
    <div
      className={cn(
        // Base styles
        'group relative overflow-hidden rounded-2xl p-6 cursor-pointer',
        // Gradient background
        colors.cardBg,
        // Left border accent
        'border border-gray-200/80 border-l-[3px]',
        colors.borderAccent,
        // Dark theme border
        'dark:border-slate-700/50 dark:border-l-[3px]',
        // Transitions
        'transition-all duration-500 ease-out',
        // Entry animation
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8',
        // Hover effects
        'hover:-translate-y-2 hover:shadow-2xl',
        'hover:border-gray-300 dark:hover:border-slate-600',
        colors.shadow
      )}
      style={{ transitionDelay: isVisible ? '0ms' : `${delay}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glowing Orb Background */}
      <div
        className={cn(
          'absolute -right-12 -top-12 w-32 h-32 rounded-full blur-3xl',
          'transition-all duration-700 ease-out',
          `bg-gradient-to-br ${colors.gradient}`,
          isHovered ? 'opacity-20 dark:opacity-30 scale-150' : 'opacity-0 scale-100'
        )}
      />

      {/* Light theme: Gradient background on hover */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br transition-opacity duration-500 dark:hidden',
          colors.lightBg,
          isHovered ? 'opacity-50' : 'opacity-0'
        )}
      />

      {/* Dark theme: Subtle grid pattern on hover */}
      <div
        className={cn(
          'absolute inset-0 opacity-0 transition-opacity duration-500 hidden dark:block',
          "bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]",
          'bg-[size:20px_20px]',
          isHovered && 'opacity-100'
        )}
      />

      {/* Content */}
      <div className="relative z-10">
        {/* Header: Icon + Trend */}
        <div className="flex items-start justify-between mb-6">
          {/* Icon with glow */}
          <div className="relative">
            {/* Glow behind icon */}
            <div
              className={cn(
                'absolute inset-0 rounded-xl blur-xl transition-all duration-500',
                `bg-gradient-to-br ${colors.gradient}`,
                isHovered ? 'opacity-40 dark:opacity-60 scale-150' : 'opacity-0 scale-100'
              )}
            />
            {/* Icon container */}
            <div
              className={cn(
                'relative p-3.5 rounded-xl text-white',
                colors.iconBg,
                'transition-all duration-500 ease-out',
                isHovered && 'scale-110 rotate-6 shadow-lg animate-pulse'
              )}
            >
              <Icon className="w-6 h-6" strokeWidth={2} />
            </div>
          </div>

          {/* Trend Badge */}
          {trend !== null && (
            <div
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold',
                'transition-all duration-300',
                trend >= 0
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                  : 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
                isHovered && 'scale-110'
              )}
            >
              {trend >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>

        {/* Label */}
        <p className="text-sm text-gray-500 dark:text-slate-400 font-medium mb-1">
          {label}
        </p>

        {/* Value with counter animation */}
        <div className="flex items-end justify-between mb-4">
          <p
            className={cn(
              'text-4xl font-black text-gray-900 dark:text-white tabular-nums tracking-tight',
              'transition-transform duration-300',
              isHovered && 'scale-105'
            )}
          >
            {count.toLocaleString()}
          </p>

          {/* Sparkline mini-chart */}
          {sparklineData && sparklineData.length >= 2 && (
            <Sparkline data={sparklineData} color={sparklineColors[color]} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200/80 dark:border-slate-700/50">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'w-2 h-2 rounded-full transition-all duration-300',
                colors.glow,
                isHovered && 'scale-150 animate-pulse'
              )}
            />
            <span className="text-sm text-gray-500 dark:text-slate-500">{subtext}</span>
          </div>

          <ArrowUpRight
            className={cn(
              'w-4 h-4 transition-all duration-300',
              isHovered
                ? 'text-gray-700 dark:text-white translate-x-0.5 -translate-y-0.5'
                : 'text-gray-400 dark:text-slate-600'
            )}
          />
        </div>
      </div>

      {/* Shine sweep effect */}
      <div
        className={cn(
          'absolute inset-0 -translate-x-full',
          'bg-gradient-to-r from-transparent via-white/60 dark:via-white/10 to-transparent',
          'transition-transform duration-1000 ease-out skew-x-12',
          isHovered && 'translate-x-full'
        )}
      />

      {/* Bottom accent line */}
      <div
        className={cn(
          'absolute bottom-0 left-0 h-0.5 rounded-full',
          `bg-gradient-to-r ${colors.gradient}`,
          'transition-all duration-500 ease-out',
          isHovered ? 'w-full' : 'w-0'
        )}
      />
    </div>
  )
}
