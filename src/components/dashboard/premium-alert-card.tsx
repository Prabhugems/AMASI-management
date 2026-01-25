"use client"

import { useState, useEffect, useRef } from "react"
import { LucideIcon, Sparkles, ArrowRight, X, ExternalLink } from "lucide-react"
import { useTheme } from "next-themes"

interface PremiumAlertCardProps {
  icon: LucideIcon
  title: string
  description: string
  action: string
  actionHref?: string
  type: "critical" | "warning" | "info" | "success"
  delay?: number
  onDismiss?: () => void
  count?: number
  time?: string
  dismissible?: boolean
}

export function PremiumAlertCard({
  icon: Icon,
  title,
  description,
  action,
  actionHref,
  type,
  delay = 0,
  onDismiss,
  count,
  time = "2h ago",
  dismissible = true,
}: PremiumAlertCardProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 })
  const cardRef = useRef<HTMLDivElement>(null)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === "dark" : false

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    })
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsDismissing(true)
    setTimeout(() => onDismiss?.(), 600)
  }

  const typeConfig = {
    critical: {
      darkBg: "bg-gradient-to-br from-rose-900/90 via-red-900/80 to-rose-950/90",
      darkBorder: "border-rose-500/50",
      darkHoverBorder: "border-rose-400/70",
      darkShadow: "shadow-rose-500/30",
      lightBg: "bg-gradient-to-br from-rose-50 via-red-50 to-white",
      lightBorder: "border-rose-200",
      lightHoverBorder: "border-rose-300",
      lightShadow: "shadow-rose-200/50",
      gradient: "from-rose-500 via-red-500 to-pink-500",
      glow: isDark ? "rgba(244, 63, 94, 0.5)" : "rgba(244, 63, 94, 0.25)",
      text: isDark ? "text-rose-300" : "text-rose-600",
      textHover: isDark ? "text-rose-200" : "text-rose-700",
      bg: "bg-rose-500",
      bgLight: isDark ? "bg-rose-500/30" : "bg-rose-100",
      pulse: true,
    },
    warning: {
      darkBg: "bg-gradient-to-br from-amber-900/90 via-orange-900/80 to-amber-950/90",
      darkBorder: "border-amber-500/50",
      darkHoverBorder: "border-amber-400/70",
      darkShadow: "shadow-amber-500/30",
      lightBg: "bg-gradient-to-br from-amber-100 via-orange-100 to-amber-50",
      lightBorder: "border-amber-300",
      lightHoverBorder: "border-amber-400",
      lightShadow: "shadow-amber-300/50",
      gradient: "from-amber-500 via-orange-500 to-yellow-500",
      glow: isDark ? "rgba(245, 158, 11, 0.5)" : "rgba(245, 158, 11, 0.35)",
      text: isDark ? "text-amber-300" : "text-amber-700",
      textHover: isDark ? "text-amber-200" : "text-amber-800",
      bg: "bg-amber-500",
      bgLight: isDark ? "bg-amber-500/30" : "bg-amber-200",
      pulse: false,
    },
    info: {
      darkBg: "bg-gradient-to-br from-blue-900/90 via-cyan-900/80 to-blue-950/90",
      darkBorder: "border-blue-500/50",
      darkHoverBorder: "border-blue-400/70",
      darkShadow: "shadow-blue-500/30",
      lightBg: "bg-gradient-to-br from-blue-50 via-cyan-50 to-white",
      lightBorder: "border-blue-200",
      lightHoverBorder: "border-blue-300",
      lightShadow: "shadow-blue-200/50",
      gradient: "from-blue-500 via-cyan-500 to-teal-500",
      glow: isDark ? "rgba(59, 130, 246, 0.5)" : "rgba(59, 130, 246, 0.25)",
      text: isDark ? "text-blue-300" : "text-blue-600",
      textHover: isDark ? "text-blue-200" : "text-blue-700",
      bg: "bg-blue-500",
      bgLight: isDark ? "bg-blue-500/30" : "bg-blue-100",
      pulse: false,
    },
    success: {
      darkBg: "bg-gradient-to-br from-emerald-900/90 via-green-900/80 to-emerald-950/90",
      darkBorder: "border-emerald-500/50",
      darkHoverBorder: "border-emerald-400/70",
      darkShadow: "shadow-emerald-500/30",
      lightBg: "bg-gradient-to-br from-emerald-100 via-green-100 to-emerald-50",
      lightBorder: "border-emerald-300",
      lightHoverBorder: "border-emerald-400",
      lightShadow: "shadow-emerald-300/50",
      gradient: "from-emerald-500 via-green-500 to-teal-500",
      glow: isDark ? "rgba(16, 185, 129, 0.5)" : "rgba(16, 185, 129, 0.35)",
      text: isDark ? "text-emerald-300" : "text-emerald-700",
      textHover: isDark ? "text-emerald-200" : "text-emerald-800",
      bg: "bg-emerald-500",
      bgLight: isDark ? "bg-emerald-500/30" : "bg-emerald-200",
      pulse: false,
    },
  }[type]

  const cardBg = isDark ? typeConfig.darkBg : typeConfig.lightBg
  const cardBorder = isDark
    ? isHovered
      ? typeConfig.darkHoverBorder
      : typeConfig.darkBorder
    : isHovered
    ? typeConfig.lightHoverBorder
    : typeConfig.lightBorder
  const cardShadow = isDark ? typeConfig.darkShadow : typeConfig.lightShadow

  return (
    <div
      ref={cardRef}
      className={`
        group relative overflow-hidden rounded-2xl cursor-pointer
        transition-all duration-700 ease-out
        ${isVisible && !isDismissing ? "opacity-100 translate-y-0 scale-100" : ""}
        ${!isVisible ? "opacity-0 translate-y-12 scale-95" : ""}
        ${isDismissing ? "opacity-0 scale-90 translate-x-24 rotate-3" : ""}
        ${isHovered ? "scale-[1.02] -translate-y-2" : ""}
      `}
      style={{ transitionDelay: `${delay}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
    >
      {/* Main Card Background */}
      <div
        className={`
        absolute inset-0 rounded-2xl
        ${cardBg}
        border ${cardBorder}
        transition-all duration-500
        ${isHovered ? `shadow-2xl ${cardShadow}` : isDark ? "shadow-xl shadow-black/30" : "shadow-lg shadow-gray-200"}
      `}
      />

      {/* Glassmorphism Overlay for Dark Theme */}
      {isDark && <div className="absolute inset-0 rounded-2xl bg-black/10 backdrop-blur-sm" />}

      {/* Mouse Spotlight */}
      <div
        className="absolute inset-0 rounded-2xl transition-opacity duration-500 pointer-events-none"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(circle 300px at ${mousePos.x}% ${mousePos.y}%, ${typeConfig.glow}, transparent)`,
        }}
      />

      {/* Animated Gradient Orb - Bottom Left */}
      <div
        className={`
        absolute -bottom-24 -left-24 w-64 h-64 rounded-full blur-3xl
        bg-gradient-to-br ${typeConfig.gradient}
        transition-all duration-1000 ease-out pointer-events-none
        ${isHovered ? "opacity-60 scale-125 -bottom-12 -left-12" : "opacity-30 scale-100"}
      `}
      />

      {/* Animated Gradient Orb - Top Right */}
      <div
        className={`
        absolute -top-24 -right-24 w-56 h-56 rounded-full blur-3xl
        bg-gradient-to-br ${typeConfig.gradient}
        transition-all duration-1000 ease-out delay-100 pointer-events-none
        ${isHovered ? "opacity-50 scale-150 -top-12 -right-12" : "opacity-10 scale-100"}
      `}
      />

      {/* Floating Particles */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
          isHovered ? "opacity-100" : "opacity-0"
        }`}
      >
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className={`absolute w-1.5 h-1.5 rounded-full ${
              isDark ? "bg-white/50" : "bg-gray-500/30"
            } animate-float-particle`}
            style={{
              left: `${10 + i * 11}%`,
              top: `${20 + (i % 4) * 18}%`,
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 p-6">
        <div className="flex items-start gap-5">
          {/* Icon Section */}
          <div className="relative flex-shrink-0">
            {/* Critical Pulse Rings */}
            {typeConfig.pulse && (
              <>
                <div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${typeConfig.gradient} animate-ping-slow opacity-50`}
                />
                <div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${typeConfig.gradient} animate-ping-slower opacity-30`}
                />
              </>
            )}

            {/* Icon Glow */}
            <div
              className={`
              absolute inset-0 rounded-2xl blur-xl
              bg-gradient-to-br ${typeConfig.gradient}
              transition-all duration-500
              ${isHovered ? "opacity-100 scale-150" : "opacity-40 scale-100"}
            `}
            />

            {/* Icon Container */}
            <div
              className={`
              relative p-4 rounded-2xl
              bg-gradient-to-br ${typeConfig.gradient}
              transition-all duration-500 ease-out
              shadow-lg
              ${isHovered ? "scale-110 rotate-6 shadow-2xl" : "scale-100 rotate-0"}
            `}
            >
              <Icon className="w-6 h-6 text-white" strokeWidth={2} />

              {/* Icon Shine Sweep */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden">
                <div
                  className={`
                  absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent
                  -translate-x-full transition-transform duration-700
                  ${isHovered ? "translate-x-full" : ""}
                `}
                />
              </div>
            </div>

            {/* Count Badge */}
            {count && (
              <div
                className={`
                absolute -top-2 -right-2 min-w-[28px] h-[28px] px-2
                flex items-center justify-center
                rounded-full bg-white text-slate-900
                text-xs font-black shadow-lg
                transition-all duration-500 ease-out
                border-2 border-white/50
                ${isHovered ? "scale-125 -top-3 -right-3 rotate-12" : ""}
              `}
              >
                {count}
              </div>
            )}

            {/* Sparkle */}
            <Sparkles
              className={`
              absolute -top-2 -right-2 w-5 h-5 text-yellow-300 drop-shadow-lg
              transition-all duration-500
              ${isHovered && !count ? "opacity-100 scale-100 animate-pulse" : "opacity-0 scale-0"}
            `}
            />
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0 pt-1">
            {/* Title */}
            <div className="flex items-center gap-3 mb-2">
              <h3
                className={`
                font-bold text-lg leading-tight
                transition-all duration-300
                ${isDark ? "text-white" : "text-gray-900"}
                ${isHovered ? "translate-x-1" : ""}
              `}
              >
                {title}
              </h3>
              {typeConfig.pulse && (
                <span className="relative flex h-3 w-3">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full ${typeConfig.bg} opacity-75`}
                  />
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${typeConfig.bg}`} />
                </span>
              )}
            </div>

            {/* Description */}
            <p
              className={`
              text-sm mb-5 leading-relaxed transition-colors duration-300
              ${isDark ? (isHovered ? "text-white/80" : "text-white/60") : isHovered ? "text-gray-700" : "text-gray-500"}
            `}
            >
              {description}
            </p>

            {/* Action Button */}
            <a
              href={actionHref || "#"}
              className={`
              inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
              text-sm font-bold
              transition-all duration-300
              ${typeConfig.bgLight} ${typeConfig.text}
              ${isHovered ? `gap-3 shadow-lg translate-x-1 ${typeConfig.textHover}` : ""}
              hover:shadow-xl active:scale-95
              border ${isDark ? "border-white/10" : "border-gray-200"}
            `}
            >
              <span>{action}</span>
              <ArrowRight className={`w-4 h-4 transition-all duration-300 ${isHovered ? "translate-x-1" : ""}`} />
            </a>
          </div>

          {/* Right Side */}
          <div className="flex flex-col items-end gap-4 pt-1">
            {/* Time Badge */}
            <span
              className={`
              text-xs font-bold px-3 py-2 rounded-xl
              transition-all duration-300
              ${
                isDark
                  ? isHovered
                    ? "bg-white/20 text-white"
                    : "bg-white/10 text-white/70"
                  : isHovered
                  ? "bg-gray-200 text-gray-800"
                  : "bg-gray-100 text-gray-500"
              }
            `}
            >
              {time}
            </span>

            {/* Dismiss Button */}
            {dismissible && (
              <button
                onClick={handleDismiss}
                className={`
                p-2.5 rounded-xl transition-all duration-500
                ${
                  isHovered
                    ? `${isDark ? "bg-white/15 text-white" : "bg-gray-200 text-gray-600"} rotate-0 scale-100 hover:bg-rose-500/30 hover:text-rose-400`
                    : `${isDark ? "text-white/30" : "text-gray-300"} -rotate-90 scale-75`
                }
              `}
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {/* External Link */}
            <ExternalLink
              className={`
              w-4 h-4 transition-all duration-500
              ${typeConfig.text}
              ${isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
            `}
            />
          </div>
        </div>
      </div>

      {/* Left Accent Bar */}
      <div
        className={`
        absolute left-0 top-6 bottom-6 w-1.5 rounded-r-full
        bg-gradient-to-b ${typeConfig.gradient}
        transition-all duration-500
        ${isHovered ? "opacity-100 w-2 shadow-lg" : "opacity-70"}
      `}
      />

      {/* Top Edge Glow */}
      <div
        className={`
        absolute top-0 left-12 right-12 h-px
        bg-gradient-to-r from-transparent via-white/40 to-transparent
        transition-opacity duration-500
        ${isHovered ? "opacity-100" : "opacity-30"}
      `}
      />

      {/* Bottom Progress Line */}
      <div
        className={`
        absolute bottom-0 left-0 h-1 rounded-b-2xl
        bg-gradient-to-r ${typeConfig.gradient}
        transition-all duration-700 ease-out
        ${isHovered ? "w-full" : "w-0"}
      `}
      />

      {/* Corner Glow */}
      <div
        className={`
        absolute bottom-0 right-0 w-40 h-40
        bg-gradient-to-tl ${typeConfig.gradient}
        opacity-0 blur-3xl rounded-2xl pointer-events-none
        transition-opacity duration-500
        ${isHovered ? "opacity-30" : ""}
      `}
      />

      {/* Full Shine Sweep */}
      <div
        className={`
        absolute inset-0 -translate-x-full rounded-2xl pointer-events-none
        bg-gradient-to-r from-transparent via-white/25 to-transparent
        transition-transform duration-1000 ease-out skew-x-12
        ${isHovered ? "translate-x-full" : ""}
      `}
      />
    </div>
  )
}
