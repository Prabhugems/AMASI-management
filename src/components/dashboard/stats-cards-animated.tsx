"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Users, GraduationCap, Calendar, Award, TrendingUp, ArrowUpRight, ArrowDownRight, LucideIcon } from 'lucide-react'

// Smooth Counter Hook
const useCountUp = (end: number, duration = 2000) => {
  const [count, setCount] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  const animate = useCallback(() => {
    setCount(0)
    setIsComplete(false)
    const startTime = Date.now()

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easeOutExpo = 1 - Math.pow(2, -10 * progress)
      setCount(Math.floor(end * easeOutExpo))

      if (progress === 1) {
        clearInterval(timer)
        setIsComplete(true)
      }
    }, 16)

    return () => clearInterval(timer)
  }, [end, duration])

  useEffect(() => {
    const timeout = setTimeout(animate, 100)
    return () => clearTimeout(timeout)
  }, [animate])

  return { count, isComplete, replay: animate }
}

type ColorType = 'rose' | 'amber' | 'emerald' | 'violet'

interface StatCardProps {
  icon: LucideIcon
  value: number
  label: string
  subtext: string
  trend: number | null
  color: ColorType
  delay?: number
  suffix?: string
}

// Light Theme Card
const LightStatCard = ({ icon: Icon, value, label, subtext, trend, color, delay = 0, suffix }: StatCardProps) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const { count, isComplete, replay } = useCountUp(value, 2000)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  const colorStyles = {
    rose: {
      gradient: 'from-rose-500 to-orange-500',
      light: 'from-rose-500/10 to-orange-500/10',
      text: 'text-rose-500',
      glow: 'bg-rose-500',
    },
    amber: {
      gradient: 'from-amber-500 to-yellow-500',
      light: 'from-amber-500/10 to-yellow-500/10',
      text: 'text-amber-500',
      glow: 'bg-amber-500',
    },
    emerald: {
      gradient: 'from-emerald-500 to-teal-500',
      light: 'from-emerald-500/10 to-teal-500/10',
      text: 'text-emerald-500',
      glow: 'bg-emerald-500',
    },
    violet: {
      gradient: 'from-violet-500 to-purple-500',
      light: 'from-violet-500/10 to-purple-500/10',
      text: 'text-violet-500',
      glow: 'bg-violet-500',
    },
  }[color]

  return (
    <div
      className={`
        group relative overflow-hidden rounded-3xl bg-white p-6 cursor-pointer
        transition-all duration-700 ease-out
        ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-16 scale-90'}
        ${isHovered ? 'shadow-2xl shadow-gray-300/50 -translate-y-3 scale-[1.02]' : 'shadow-lg shadow-gray-200/60'}
      `}
      style={{ transitionDelay: isVisible ? '0ms' : `${delay}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={replay}
    >
      {/* Animated Background Gradient */}
      <div
        className={`
          absolute inset-0 bg-gradient-to-br ${colorStyles.light}
          transition-opacity duration-500
          ${isHovered ? 'opacity-100' : 'opacity-0'}
        `}
      />

      {/* Floating Glow Orb */}
      <div
        className={`
          absolute -right-20 -top-20 w-40 h-40 rounded-full blur-3xl
          bg-gradient-to-br ${colorStyles.gradient}
          transition-all duration-700 ease-out
          ${isHovered ? 'opacity-30 scale-150 -right-10 -top-10' : 'opacity-0 scale-100'}
        `}
      />

      {/* Bottom Glow Line */}
      <div
        className={`
          absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${colorStyles.gradient}
          transform origin-left transition-transform duration-500 ease-out
          ${isHovered ? 'scale-x-100' : 'scale-x-0'}
        `}
      />

      {/* Content */}
      <div className="relative z-10">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-8">
          {/* Icon with Glow */}
          <div className="relative">
            <div
              className={`
                absolute inset-0 rounded-2xl bg-gradient-to-br ${colorStyles.gradient} blur-xl
                transition-all duration-500
                ${isHovered ? 'opacity-50 scale-150' : 'opacity-0 scale-100'}
              `}
            />
            <div
              className={`
                relative p-4 rounded-2xl bg-gradient-to-br ${colorStyles.gradient} text-white
                transition-all duration-500 ease-out
                ${isHovered ? 'scale-110 rotate-6 shadow-xl' : 'scale-100 rotate-0'}
              `}
            >
              <Icon className="w-7 h-7" strokeWidth={2} />
            </div>
          </div>

          {/* Trend Badge */}
          {trend !== null && (
            <div
              className={`
                flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold
                transition-all duration-500
                ${trend >= 0
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-rose-100 text-rose-600'
                }
                ${isHovered ? 'scale-110 shadow-lg' : 'scale-100'}
              `}
            >
              {trend >= 0
                ? <TrendingUp className="w-4 h-4" />
                : <ArrowDownRight className="w-4 h-4" />
              }
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>

        {/* Value Section */}
        <div className="mb-6">
          <p className="text-sm text-gray-400 font-medium mb-2 tracking-wide">
            {label}
          </p>
          <div className="flex items-baseline gap-2">
            <span
              className={`
                text-5xl font-black text-gray-900 tabular-nums tracking-tight
                transition-all duration-300
                ${isComplete && isHovered ? 'scale-105' : 'scale-100'}
              `}
            >
              {count.toLocaleString()}
            </span>
            {suffix && (
              <span className="text-xl font-bold text-gray-400">{suffix}</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`
                w-2 h-2 rounded-full ${colorStyles.glow}
                transition-all duration-300
                ${isHovered ? 'scale-150 animate-pulse' : 'scale-100'}
              `}
            />
            <span className="text-sm text-gray-500">{subtext}</span>
          </div>

          <div
            className={`
              p-2 rounded-xl transition-all duration-300
              ${isHovered ? `bg-gradient-to-br ${colorStyles.light} ${colorStyles.text}` : 'text-gray-300'}
            `}
          >
            <ArrowUpRight
              className={`
                w-5 h-5 transition-transform duration-300
                ${isHovered ? 'translate-x-1 -translate-y-1 scale-110' : ''}
              `}
            />
          </div>
        </div>
      </div>

      {/* Shine Effect */}
      <div
        className={`
          absolute inset-0 -translate-x-full
          bg-gradient-to-r from-transparent via-white/80 to-transparent
          transition-transform duration-1000 ease-out skew-x-12
          ${isHovered ? 'translate-x-full' : ''}
        `}
      />
    </div>
  )
}

// Dark Theme Card
const DarkStatCard = ({ icon: Icon, value, label, subtext, trend, color, delay = 0, suffix }: StatCardProps) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const { count, isComplete, replay } = useCountUp(value, 2000)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  const colorStyles = {
    rose: {
      gradient: 'from-rose-500 to-orange-500',
      glow: 'shadow-rose-500/40',
      text: 'text-rose-400',
      bg: 'bg-rose-500',
    },
    amber: {
      gradient: 'from-amber-500 to-yellow-500',
      glow: 'shadow-amber-500/40',
      text: 'text-amber-400',
      bg: 'bg-amber-500',
    },
    emerald: {
      gradient: 'from-emerald-500 to-teal-500',
      glow: 'shadow-emerald-500/40',
      text: 'text-emerald-400',
      bg: 'bg-emerald-500',
    },
    violet: {
      gradient: 'from-violet-500 to-purple-500',
      glow: 'shadow-violet-500/40',
      text: 'text-violet-400',
      bg: 'bg-violet-500',
    },
  }[color]

  return (
    <div
      className={`
        group relative overflow-hidden rounded-3xl
        bg-gradient-to-br from-slate-800 to-slate-900 p-6 cursor-pointer
        transition-all duration-700 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'}
        ${isHovered ? `shadow-2xl ${colorStyles.glow} -translate-y-3 scale-[1.02]` : 'shadow-xl shadow-black/20'}
      `}
      style={{ transitionDelay: isVisible ? '0ms' : `${delay}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={replay}
    >
      {/* Glow Orb */}
      <div
        className={`
          absolute -right-16 -top-16 w-48 h-48 rounded-full blur-3xl
          bg-gradient-to-br ${colorStyles.gradient}
          transition-all duration-700
          ${isHovered ? 'opacity-40 scale-125' : 'opacity-10 scale-100'}
        `}
      />

      {/* Grid Pattern */}
      <div
        className={`
          absolute inset-0 opacity-0 transition-opacity duration-500
          bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]
          bg-[size:24px_24px]
          ${isHovered ? 'opacity-100' : ''}
        `}
      />

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-8">
          <div className="relative">
            <div
              className={`
                absolute inset-0 rounded-2xl bg-gradient-to-br ${colorStyles.gradient} blur-xl
                transition-all duration-500
                ${isHovered ? 'opacity-70 scale-150' : 'opacity-0'}
              `}
            />
            <div
              className={`
                relative p-4 rounded-2xl bg-gradient-to-br ${colorStyles.gradient} text-white
                transition-all duration-500
                ${isHovered ? 'scale-110 rotate-6' : ''}
              `}
            >
              <Icon className="w-7 h-7" strokeWidth={2} />
            </div>
          </div>

          {trend !== null && (
            <div
              className={`
                flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold
                ${trend >= 0
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/20 text-rose-400'
                }
              `}
            >
              {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>

        <div className="mb-6">
          <p className="text-sm text-slate-500 font-medium mb-2 tracking-wide">{label}</p>
          <div className="flex items-baseline gap-2">
            <span
              className={`
                text-5xl font-black text-white tabular-nums tracking-tight
                transition-all duration-300
                ${isComplete && isHovered ? 'scale-105' : 'scale-100'}
              `}
            >
              {count.toLocaleString()}
            </span>
            {suffix && <span className="text-xl font-bold text-slate-500">{suffix}</span>}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${colorStyles.bg} ${isHovered ? 'animate-pulse' : ''}`} />
            <span className="text-sm text-slate-500">{subtext}</span>
          </div>
          <ArrowUpRight className={`w-5 h-5 transition-colors duration-300 ${isHovered ? colorStyles.text : 'text-slate-600'}`} />
        </div>
      </div>

      {/* Shine */}
      <div
        className={`
          absolute inset-0 -translate-x-full
          bg-gradient-to-r from-transparent via-white/10 to-transparent
          transition-transform duration-1000 skew-x-12
          ${isHovered ? 'translate-x-full' : ''}
        `}
      />
    </div>
  )
}

// Props for the main component
interface StatsCardsAnimatedProps {
  stats: {
    members: number
    faculty: number
    events: number
    delegates: number
  } | undefined
  isDark?: boolean
}

// Main Component
export function StatsCardsAnimated({ stats, isDark = false }: StatsCardsAnimatedProps) {
  const cardData: StatCardProps[] = [
    {
      icon: Users,
      value: stats?.members || 0,
      label: 'Total Members',
      subtext: 'Live from database',
      trend: 12,
      color: 'rose',
      delay: 0
    },
    {
      icon: GraduationCap,
      value: stats?.faculty || 0,
      label: 'Faculty Database',
      subtext: 'Master database',
      trend: 8,
      color: 'amber',
      delay: 100
    },
    {
      icon: Calendar,
      value: stats?.events || 0,
      label: 'Active Events',
      subtext: 'Planning/Ongoing',
      trend: null,
      color: 'emerald',
      delay: 200
    },
    {
      icon: Award,
      value: stats?.delegates || 0,
      label: 'Total Attendees',
      subtext: 'All events',
      trend: 5,
      color: 'violet',
      delay: 300
    },
  ]

  const StatCard = isDark ? DarkStatCard : LightStatCard

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {cardData.map((stat, i) => (
        <StatCard key={i} {...stat} />
      ))}
    </div>
  )
}
