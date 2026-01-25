'use client'

import { useState, useEffect } from 'react'
import { Ticket, Award, Plane, Clock, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// Smooth Counter Hook
function useCounter(end: number, duration = 1500) {
  const [count, setCount] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  const animate = () => {
    setCount(0)
    setIsComplete(false)
    const start = Date.now()
    const timer = setInterval(() => {
      const progress = Math.min((Date.now() - start) / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 4)
      setCount(Math.floor(end * easeOut))
      if (progress === 1) {
        clearInterval(timer)
        setIsComplete(true)
      }
    }, 16)
  }

  useEffect(() => {
    const timeout = setTimeout(animate, 100)
    return () => clearTimeout(timeout)
  }, [end])

  return { count, isComplete, replay: animate }
}

interface GlassCardProps {
  icon: React.ElementType
  value: number
  label: string
  color: 'cyan' | 'purple' | 'orange' | 'emerald'
  delay: number
  href: string
}

const colorConfig = {
  cyan: {
    gradient: 'from-cyan-500 to-blue-500',
    shadow: 'shadow-cyan-500/40',
    text: 'text-cyan-300',
    border: 'border-cyan-500/30',
    glow: 'rgba(6, 182, 212, 0.4)',
    // Light theme
    lightGradient: 'from-cyan-50 to-blue-50',
    lightText: 'text-cyan-600',
    lightBorder: 'border-cyan-200',
  },
  purple: {
    gradient: 'from-purple-500 to-pink-500',
    shadow: 'shadow-purple-500/40',
    text: 'text-purple-300',
    border: 'border-purple-500/30',
    glow: 'rgba(168, 85, 247, 0.4)',
    // Light theme
    lightGradient: 'from-purple-50 to-pink-50',
    lightText: 'text-purple-600',
    lightBorder: 'border-purple-200',
  },
  orange: {
    gradient: 'from-orange-500 to-red-500',
    shadow: 'shadow-orange-500/40',
    text: 'text-orange-300',
    border: 'border-orange-500/30',
    glow: 'rgba(249, 115, 22, 0.4)',
    // Light theme
    lightGradient: 'from-orange-50 to-red-50',
    lightText: 'text-orange-600',
    lightBorder: 'border-orange-200',
  },
  emerald: {
    gradient: 'from-emerald-500 to-teal-500',
    shadow: 'shadow-emerald-500/40',
    text: 'text-emerald-300',
    border: 'border-emerald-500/30',
    glow: 'rgba(16, 185, 129, 0.4)',
    // Light theme
    lightGradient: 'from-emerald-50 to-teal-50',
    lightText: 'text-emerald-600',
    lightBorder: 'border-emerald-200',
  },
}

function GlassCard({ icon: Icon, value, label, color, delay, href }: GlassCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 })
  const { count, isComplete, replay } = useCounter(value)
  const colors = colorConfig[color]

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  // Track mouse for spotlight effect
  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    })
  }

  return (
    <Link
      href={href}
      className={cn(
        'relative overflow-hidden rounded-2xl cursor-pointer block',
        'transition-all duration-700 ease-out',
        isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95',
        isHovered && `scale-[1.03] -translate-y-1 shadow-2xl dark:${colors.shadow}`
      )}
      style={{ transitionDelay: `${delay}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
      onClick={(e) => {
        e.preventDefault()
        replay()
      }}
    >
      {/* Light Theme Background */}
      <div className={cn(
        'absolute inset-0 rounded-2xl transition-all duration-500 dark:hidden',
        'bg-white border',
        isHovered ? colors.lightBorder : 'border-gray-200'
      )} />

      {/* Light Theme Gradient on Hover */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br transition-opacity duration-500 dark:hidden',
        colors.lightGradient,
        isHovered ? 'opacity-60' : 'opacity-0'
      )} />

      {/* Dark Theme Glass Background */}
      <div className={cn(
        'absolute inset-0 hidden dark:block',
        'bg-white/[0.08] backdrop-blur-xl',
        'border rounded-2xl transition-all duration-500',
        isHovered ? colors.border : 'border-white/10'
      )} />

      {/* Mouse Spotlight Effect (Dark theme only) */}
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-300 rounded-2xl hidden dark:block"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(circle 150px at ${mousePos.x}% ${mousePos.y}%, ${colors.glow}, transparent)`,
        }}
      />

      {/* Animated Gradient Orb */}
      <div className={cn(
        'absolute -bottom-10 -right-10 w-32 h-32 rounded-full',
        `bg-gradient-to-br ${colors.gradient} blur-3xl`,
        'transition-all duration-700 ease-out',
        isHovered
          ? 'opacity-30 dark:opacity-60 scale-[1.8] -bottom-5 -right-5'
          : 'opacity-0 dark:opacity-20 scale-100'
      )} />

      {/* Secondary Orb - Top Left */}
      <div className={cn(
        'absolute -top-8 -left-8 w-24 h-24 rounded-full',
        `bg-gradient-to-br ${colors.gradient} blur-2xl`,
        'transition-all duration-700 ease-out delay-100',
        isHovered ? 'opacity-20 dark:opacity-40 scale-150' : 'opacity-0 scale-100'
      )} />

      {/* Floating Particles (Dark theme) */}
      {isHovered && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none hidden dark:block">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-white/60 animate-float-particle"
              style={{
                left: `${20 + i * 15}%`,
                top: `${30 + (i % 3) * 20}%`,
                animationDelay: `${i * 0.2}s`,
                animationDuration: `${2 + i * 0.3}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 p-5">
        <div className="flex items-center gap-4">
          {/* Icon Container */}
          <div className="relative">
            {/* Icon Glow Ring */}
            <div className={cn(
              'absolute inset-0 rounded-xl',
              `bg-gradient-to-br ${colors.gradient}`,
              'transition-all duration-500 blur-md',
              isHovered ? 'opacity-40 dark:opacity-70 scale-125' : 'opacity-0 scale-100'
            )} />

            {/* Icon Box */}
            <div className={cn(
              'relative p-3 rounded-xl',
              `bg-gradient-to-br ${colors.gradient}`,
              'transition-all duration-500 ease-out',
              isHovered ? 'scale-110 rotate-6 shadow-lg' : 'scale-100 rotate-0'
            )}>
              <Icon className="w-5 h-5 text-white" strokeWidth={2.5} />

              {/* Icon Shine */}
              <div className="absolute inset-0 rounded-xl overflow-hidden">
                <div className={cn(
                  'absolute inset-0 bg-gradient-to-tr from-white/0 via-white/40 to-white/0',
                  '-translate-x-full transition-transform duration-700',
                  isHovered && 'translate-x-full'
                )} />
              </div>
            </div>

            {/* Sparkle on hover */}
            <div className={cn(
              'absolute -top-1 -right-1 transition-all duration-300',
              isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
            )}>
              <Sparkles className="w-3 h-3 text-yellow-400 animate-pulse" />
            </div>
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0">
            {/* Value */}
            <div className="flex items-baseline gap-1">
              <p className={cn(
                'text-3xl font-black tabular-nums tracking-tight',
                'text-gray-900 dark:text-white',
                'transition-all duration-300',
                isComplete && isHovered && 'scale-110'
              )}>
                {count}
              </p>
              {isHovered && (
                <span className={cn(
                  'text-xs font-bold animate-fade-in',
                  colors.lightText,
                  `dark:${colors.text}`
                )}>

                </span>
              )}
            </div>

            {/* Label */}
            <p className={cn(
              'text-sm transition-colors duration-300 truncate',
              isHovered
                ? 'text-gray-700 dark:text-white/80'
                : 'text-gray-500 dark:text-white/50'
            )}>
              {label}
            </p>
          </div>

          {/* Arrow indicator */}
          <div className={cn(
            'transition-all duration-300',
            isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
          )}>
            <svg
              className={cn('w-5 h-5', colors.lightText, `dark:${colors.text}`)}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Bottom Glow Line */}
      <div className={cn(
        'absolute bottom-0 left-0 h-[2px] rounded-full',
        `bg-gradient-to-r ${colors.gradient}`,
        'transition-all duration-500 ease-out',
        isHovered ? 'w-full opacity-100' : 'w-0 opacity-0'
      )} />

      {/* Card Shine Sweep */}
      <div className={cn(
        'absolute inset-0 -translate-x-full',
        'bg-gradient-to-r from-transparent via-white/40 dark:via-white/20 to-transparent',
        'transition-transform duration-1000 ease-out skew-x-12',
        isHovered && 'translate-x-full'
      )} />

      {/* Top Edge Highlight */}
      <div className={cn(
        'absolute top-0 left-4 right-4 h-[1px]',
        'bg-gradient-to-r from-transparent via-gray-300 dark:via-white/30 to-transparent',
        'transition-opacity duration-500',
        isHovered ? 'opacity-100' : 'opacity-30'
      )} />
    </Link>
  )
}

const stats = [
  { icon: Ticket, value: 8, label: 'Open Tickets', color: 'cyan' as const, href: '/support?status=open' },
  { icon: Award, value: 156, label: 'Certificates Pending', color: 'purple' as const, href: '/certificates?status=pending' },
  { icon: Plane, value: 12, label: "Today's Arrivals", color: 'orange' as const, href: '/travel?date=today' },
  { icon: Clock, value: 34, label: 'Pending Responses', color: 'emerald' as const, href: '/faculty?status=pending' },
]

export function QuickStats() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <GlassCard
          key={stat.label}
          {...stat}
          delay={index * 120}
        />
      ))}
    </div>
  )
}
