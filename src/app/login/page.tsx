"use client"

import * as React from "react"
import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertTriangle,
  Activity,
  Users,
  Send,
  QrCode,
  Calendar,
  BarChart3,
  Shield,
  KeyRound,
} from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@/lib/supabase/client"
import { COMPANY_CONFIG, FEATURES, DEFAULTS } from "@/lib/config"
import { cn } from "@/lib/utils"

// Four fixed dark/accent identities for this page -- deliberately not
// routed through the app-wide --primary token (which flips blue/gold per
// theme). Each `ring`/`brand` class is a literal string (not built with a
// template) so Tailwind's JIT scanner can find and compile it: arbitrary-
// value classes assembled from a runtime variable never get generated.
type LoginTheme = {
  id: string
  accent: string
  accentRgb: string
  base: string
  ctaText: string
  brandClass: string
  ringClass: string
}

const LOGIN_THEMES: LoginTheme[] = [
  {
    id: "cyan",
    // Sampled directly from the reference (amasi-eight.vercel.app)'s CTA
    // button via computed style -- rgb(17, 224, 216).
    accent: "#11E0D8",
    accentRgb: "17 224 216",
    base: "#04110F",
    ctaText: "#001218",
    brandClass: "bg-[#11E0D8]/15 ring-[#11E0D8]/30",
    ringClass: "focus-visible:ring-[#11E0D8] focus-visible:border-[#11E0D8]",
  },
  {
    id: "amber",
    accent: "#F5A623",
    accentRgb: "245 166 35",
    base: "#120D06",
    ctaText: "#1A0F02",
    brandClass: "bg-[#F5A623]/15 ring-[#F5A623]/30",
    ringClass: "focus-visible:ring-[#F5A623] focus-visible:border-[#F5A623]",
  },
  {
    id: "violet",
    accent: "#8B7CFF",
    accentRgb: "139 124 255",
    base: "#0B0A14",
    ctaText: "#0A0818",
    brandClass: "bg-[#8B7CFF]/15 ring-[#8B7CFF]/30",
    ringClass: "focus-visible:ring-[#8B7CFF] focus-visible:border-[#8B7CFF]",
  },
  {
    id: "blue",
    accent: "#3EA6FF",
    accentRgb: "62 166 255",
    base: "#050B14",
    ctaText: "#020610",
    brandClass: "bg-[#3EA6FF]/15 ring-[#3EA6FF]/30",
    ringClass: "focus-visible:ring-[#3EA6FF] focus-visible:border-[#3EA6FF]",
  },
]

const LOGIN_THEME_ROTATE_MS = 6 * 60 * 60 * 1000 // 6 hours
const LOGIN_THEME_STORAGE_KEY = "amasi-login-theme-last-seen"

// No cron, no backend: the theme is a pure function of wall-clock time, so
// every request (server or client) computes the same "which 6-hour slot are
// we in" answer with zero shared state. The only state that needs to persist
// anywhere is per-visitor -- "don't show ME the same one twice in a row" --
// and that lives in this browser's own localStorage, not a database.
function useLoginTheme(): LoginTheme {
  const bucketIndex = Math.floor(Date.now() / LOGIN_THEME_ROTATE_MS) % LOGIN_THEMES.length
  const [themeIndex, setThemeIndex] = useState(bucketIndex)

  // Guards against React Strict Mode's dev-only double-invoke: that runs
  // this effect twice back-to-back with the SAME bucketIndex, and since the
  // effect reads-then-writes localStorage it isn't naturally idempotent --
  // the second invoke would see the first invoke's own write and bump an
  // extra step. Comparing against the last bucket we actually processed
  // filters out that synthetic re-run while still processing a real one
  // (a long-lived tab crossing into the next 6-hour slot has a genuinely
  // different bucketIndex, so it still goes through).
  const lastProcessedBucket = useRef<number | null>(null)

  useEffect(() => {
    if (lastProcessedBucket.current === bucketIndex) return
    lastProcessedBucket.current = bucketIndex

    let idx = bucketIndex
    try {
      const lastId = window.localStorage.getItem(LOGIN_THEME_STORAGE_KEY)
      if (LOGIN_THEMES[idx].id === lastId) {
        idx = (idx + 1) % LOGIN_THEMES.length
      }
      window.localStorage.setItem(LOGIN_THEME_STORAGE_KEY, LOGIN_THEMES[idx].id)
    } catch {
      // Private browsing / storage disabled: fall back to the plain
      // time-bucket theme, just without the per-visitor de-dupe.
    }
    setThemeIndex(idx)
  }, [bucketIndex])

  return LOGIN_THEMES[themeIndex]
}

// Check if Supabase is properly configured
const isSupabaseConfigured = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return url && !url.includes('placeholder')
}

const MEMBERSHIP_ROWS = [
  { icon: Users, label: `${COMPANY_CONFIG.name} ${COMPANY_CONFIG.audienceLabel} & faculty registry`, meta: "2,480 records" },
  { icon: Send, label: "Faculty invitations & tracking", meta: "live" },
  { icon: QrCode, label: "QR-based delegate check-in", meta: "on-site" },
]

const EVENT_ROWS = [
  { icon: Calendar, label: "Event Management", meta: "Sessions, programs & schedules" },
  { icon: Users, label: "Registrations", meta: "Delegates, badges & check-in" },
  { icon: BarChart3, label: "Analytics", meta: "Real-time insights & reports" },
  { icon: Shield, label: "Certificates", meta: "Auto-generate & verify" },
]

const EASE = [0.16, 1, 0.3, 1] as const

const heroContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
}
const heroItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
}

// A repeating heartbeat waveform spanning the full canvas -- the signature
// element, load-bearing rather than decorative. Two travelling highlights
// trace the same path continuously (SVG native animateMotion, so it stays
// correct regardless of path length). Frozen to a static line under
// reduced motion.
const ECG_UNIT = "h58 l10 0 l7 -7 l7 15 l9 -60 l9 92 l9 -46 l7 6 h58"
const ECG_PATH = "M0 130" + ECG_UNIT.repeat(9)

function BackgroundFX({ theme }: { theme: LoginTheme }) {
  const prefersReducedMotion = useReducedMotion()
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -left-1/4 top-1/2 h-[70vh] w-[70vh] -translate-y-1/2 rounded-full opacity-60 blur-[120px] animate-pulse-slow"
        style={{ background: `radial-gradient(circle, ${theme.accent}, transparent 62%)` }}
      />
      <div
        className="absolute -right-32 -top-32 h-[46vh] w-[46vh] rounded-full opacity-20 blur-[110px] animate-pulse-slower"
        style={{ background: `radial-gradient(circle, ${theme.accent}, transparent 66%)` }}
      />

      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `linear-gradient(to right, ${theme.accent} 1px, transparent 1px), linear-gradient(to bottom, ${theme.accent} 1px, transparent 1px)`,
          backgroundSize: "52px 52px",
          maskImage: "radial-gradient(ellipse 100% 90% at 40% 50%, black, transparent 78%)",
        }}
      />

      <svg
        className="absolute inset-x-0 top-1/2 h-[38vh] w-full -translate-y-1/2"
        viewBox="0 0 1566 260"
        preserveAspectRatio="none"
        fill="none"
      >
        {/* One continuous path. Exactly one round dot travels it via
            animateMotion; the trail is a single dash-shaped streak on a
            second copy of the SAME path (pathLength="100" normalizes it so
            stroke-dasharray/-offset are plain percentages, no length math
            needed) -- never more than one dot on screen. */}
        <path d={ECG_PATH} stroke={theme.accent} strokeWidth="1.5" opacity="0.16" />
        {!prefersReducedMotion && (
          <>
            <path
              d={ECG_PATH}
              pathLength={100}
              stroke={theme.accent}
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.45"
              strokeDasharray="10 90"
              className="animate-ecg-trail"
              style={{ filter: "blur(3px)" }}
            />
            <circle r="4" fill={theme.accent} style={{ filter: `drop-shadow(0 0 8px ${theme.accent})` }}>
              <animateMotion dur="8s" repeatCount="indefinite" path={ECG_PATH} />
            </circle>
          </>
        )}
      </svg>

      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse 120% 80% at 50% 50%, transparent 40%, ${theme.base} 100%)` }}
      />
    </div>
  )
}

// A soft radial light that follows the cursor. Mutates the DOM directly
// (no React state) so it costs nothing per frame, and is opted out entirely
// on touch devices and under reduced motion.
function CursorGlow({ theme }: { theme: LoginTheme }) {
  const ref = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (prefersReducedMotion) return
    if (typeof window === "undefined" || !window.matchMedia("(pointer: fine)").matches) return
    const el = ref.current
    if (!el) return

    let raf = 0
    const handleMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--mx", `${e.clientX}px`)
        el.style.setProperty("--my", `${e.clientY}px`)
        el.style.opacity = "1"
      })
    }
    window.addEventListener("pointermove", handleMove)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      cancelAnimationFrame(raf)
    }
  }, [prefersReducedMotion])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 opacity-0 transition-opacity duration-700"
      style={{
        background: `radial-gradient(600px circle at var(--mx, 50%) var(--my, 50%), rgb(${theme.accentRgb} / 0.10), transparent 70%)`,
      }}
    />
  )
}

// A real clock, not a fabricated "live" claim -- ticks the tenant's own
// configured timezone. Slows to a crawl under reduced motion since a
// second-hand redraw is still visual churn even without a transform.
function LiveClock() {
  const prefersReducedMotion = useReducedMotion()
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const interval = setInterval(() => setNow(new Date()), prefersReducedMotion ? 15000 : 1000)
    return () => clearInterval(interval)
  }, [prefersReducedMotion])

  if (!now) return null

  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: DEFAULTS.timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: prefersReducedMotion ? undefined : "2-digit",
    hour12: false,
  }).format(now)

  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: DEFAULTS.timezone,
    day: "2-digit",
    month: "short",
  }).format(now)

  const zoneLabel = DEFAULTS.timezone.split("/").pop()?.replace(/_/g, " ") ?? DEFAULTS.timezone

  return (
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
      <span>
        {date} &middot; {time} &middot; {zoneLabel}
      </span>
    </div>
  )
}

// A gentle 3D tilt that follows the cursor over the card. Direct style
// mutation (like CursorGlow) so it doesn't cost a re-render per frame.
// No-ops under reduced motion.
function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) return
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    el.style.transform = `perspective(900px) rotateX(${py * -4}deg) rotateY(${px * 4}deg)`
  }

  const handleLeave = () => {
    const el = ref.current
    if (el) el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)"
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={cn("transition-transform duration-500 ease-out will-change-transform", className)}
    >
      {children}
    </div>
  )
}

// The primary-action button gets a light sweep on hover -- scoped to this
// page, not the shared Button component.
function ShineButton(props: ButtonProps) {
  return (
    <div className="group relative overflow-hidden rounded-lg">
      <Button {...props} />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full motion-reduce:hidden"
      />
    </div>
  )
}

function BrandMark({ theme }: { theme: LoginTheme }) {
  return (
    <div className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", theme.brandClass)}>
      <Activity className="h-5 w-5" style={{ color: theme.accent }} strokeWidth={2.4} />
    </div>
  )
}

const INPUT_BASE_CLASS = "bg-white/[0.03] border-white/10 text-white placeholder:text-white/30"

// Inline style, not a className override: guarantees the exact accent
// renders regardless of how twMerge resolves against Button's own
// `bg-primary` variant class. Hover is a filter (inline style can't do
// pseudo-classes), which doesn't conflict with anything Button sets.
const CTA_ACCENT_CLASS = "font-semibold hover:brightness-110 transition-[filter]"
function ctaAccentStyle(theme: LoginTheme) {
  return {
    backgroundColor: theme.accent,
    color: theme.ctaText,
    boxShadow: `0 0 24px rgb(${theme.accentRgb} / 0.35)`,
  }
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirectTo") || "/"
  const supabaseConfigured = isSupabaseConfigured()
  const prefersReducedMotion = useReducedMotion()
  const theme = useLoginTheme()

  const { signInWithMagicLink, signInWithPassword, isAuthenticated, loading: authLoading } = useAuth()

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [error, setError] = React.useState("")
  const [loginMode, setLoginMode] = React.useState<"password" | "magic-link">("magic-link")
  const [showPassword, setShowPassword] = React.useState(false)
  // Email-scanner-resistant fallback: 6-digit code the user can type in case
  // the magic link gets pre-fetched (and burned) by their email provider.
  const [code, setCode] = React.useState("")
  const [verifying, setVerifying] = React.useState(false)
  const [verifyError, setVerifyError] = React.useState("")
  const [shakeKey, setShakeKey] = React.useState(0)

  // If login page receives a code param, redirect to auth callback
  React.useEffect(() => {
    const code = searchParams.get("code")
    if (code) {
      const callbackUrl = `/auth/callback?code=${code}${redirectTo ? `&next=${redirectTo}` : ""}`
      router.replace(callbackUrl)
    }
  }, [searchParams, router, redirectTo])

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.push(redirectTo)
    }
  }, [isAuthenticated, authLoading, router, redirectTo])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      if (loginMode === "password") {
        await signInWithPassword(email, password)
        router.push(redirectTo)
      } else {
        await signInWithMagicLink(email, redirectTo !== "/" ? redirectTo : undefined)
        setSent(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = code.trim()
    // Supabase OTP length is configurable (MAILER_OTP_LENGTH); this project uses 8.
    if (token.length < 6) return
    setVerifying(true)
    setVerifyError("")

    try {
      const supabase = createClient()
      const { data, error: otpError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: "email",
      })
      if (otpError) throw otpError
      const accessToken = data.session?.access_token
      if (!accessToken) throw new Error("No session returned")

      // Mirror the auth/callback flow: validate + record login, get redirect target
      const res = await fetch("/api/auth/login-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      })
      const lc = await res.json().catch(() => ({}))
      if (!res.ok || lc.error) {
        await supabase.auth.signOut()
        throw new Error(lc.error || "Unauthorized")
      }

      router.push(lc.redirectTo || redirectTo)
    } catch (err) {
      setVerifyError(
        err instanceof Error && err.message
          ? err.message === "Token has expired or is invalid"
            ? "That code is invalid or has expired. Request a new one."
            : err.message
          : "Invalid or expired code"
      )
      setShakeKey((k) => k + 1)
    } finally {
      setVerifying(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.base }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: theme.accent }} />
      </div>
    )
  }

  return (
    <main
      className="amasi-auth relative isolate flex min-h-svh flex-col overflow-hidden font-sans text-white"
      style={{ background: theme.base }}
    >
      <BackgroundFX theme={theme} />
      <CursorGlow theme={theme} />

      {/* Top telemetry bar */}
      <header className="relative z-10 flex items-center justify-between gap-4 px-6 py-5 sm:px-10">
        <div className="flex items-center gap-3">
          <BrandMark theme={theme} />
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight">{COMPANY_CONFIG.name}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">Command Center</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50 backdrop-blur">
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse-slow"
              style={{ background: theme.accent, boxShadow: `0 0 8px ${theme.accent}` }}
            />
            Secure uplink &middot; online
          </div>
          <LiveClock />
        </div>
      </header>

      {/* Content */}
      <div className="relative z-10 flex flex-1 items-center">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 py-10 sm:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          {/* Hero */}
          <motion.div variants={heroContainer} initial="hidden" animate="show" className="max-w-xl">
            <motion.p
              variants={heroItem}
              className="font-mono text-[11px] uppercase tracking-[0.32em]"
              style={{ color: theme.accent }}
            >
              Faculty Operations Platform
            </motion.p>

            {FEATURES.membership ? (
              <motion.h1
                variants={heroItem}
                className="mt-5 text-balance font-sans text-4xl font-extrabold leading-[1.03] tracking-tight text-white sm:text-5xl lg:text-6xl"
              >
                Precision command for surgical faculty.
              </motion.h1>
            ) : (
              <motion.h1
                variants={heroItem}
                className="mt-5 text-balance font-sans text-4xl font-extrabold leading-[1.03] tracking-tight text-white sm:text-5xl lg:text-6xl"
              >
                Your complete event command center.
              </motion.h1>
            )}

            <motion.p variants={heroItem} className="mt-6 max-w-md text-pretty leading-relaxed text-white/60">
              {FEATURES.membership
                ? `Coordinate faculty, run delegate registration, and issue certificates from one secure control surface built for ${COMPANY_CONFIG.name} events.`
                : "Everything you need to plan, manage, and execute world-class conferences and events."}
            </motion.p>

            <motion.ul
              variants={heroItem}
              className="mt-10 flex flex-col divide-y divide-white/10 border-y border-white/10"
            >
              {(FEATURES.membership ? MEMBERSHIP_ROWS : EVENT_ROWS).map(({ icon: Icon, label, meta }) => (
                <motion.li key={label} variants={heroItem} className="flex items-center justify-between gap-4 py-3.5">
                  <span className="flex items-center gap-3.5">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1"
                      style={{ background: `rgb(${theme.accentRgb} / 0.10)`, color: theme.accent, boxShadow: "none" }}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2.2} />
                    </span>
                    <span className="text-sm font-medium text-white/90">{label}</span>
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">{meta}</span>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>

          {/* Auth card */}
          <div className="w-full max-w-md justify-self-center lg:justify-self-end">
            <AnimatePresence mode="wait">
              {!supabaseConfigured ? (
                <motion.div
                  key="dev"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:p-8"
                >
                  <div className="h-12 w-12 rounded-full bg-warning/15 flex items-center justify-center mb-6">
                    <AlertTriangle className="h-6 w-6 text-warning" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-white leading-9">Development Mode</h2>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    Supabase is not configured. To enable authentication, add your credentials to{" "}
                    <code className="bg-white/10 px-1 py-0.5 rounded text-xs">.env.local</code>.
                  </p>
                  <ShineButton
                    onClick={() => router.push("/")}
                    className={cn("w-full mt-10", CTA_ACCENT_CLASS)}
                    style={ctaAccentStyle(theme)}
                  >
                    Continue to Dashboard
                  </ShineButton>
                </motion.div>
              ) : sent ? (
                <motion.div
                  key="sent"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:p-8"
                >
                  <div className="relative mb-6 h-12 w-12">
                    {!prefersReducedMotion && (
                      <motion.span
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full"
                        style={{ background: `rgb(${theme.accentRgb} / 0.3)` }}
                        initial={{ scale: 1, opacity: 0.6 }}
                        animate={{ scale: 1.8, opacity: 0 }}
                        transition={{ duration: 1, ease: "easeOut" }}
                      />
                    )}
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 18 }}
                      className="relative flex h-12 w-12 items-center justify-center rounded-full"
                      style={{ background: `rgb(${theme.accentRgb} / 0.15)` }}
                    >
                      <Mail className="h-6 w-6" style={{ color: theme.accent }} />
                    </motion.div>
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-white leading-9">Check your email</h2>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    We sent a magic link and a verification code to{" "}
                    <strong className="text-white">{email}</strong>. Click the link, or enter the code below if your
                    email provider strips the link.
                  </p>

                  <form onSubmit={handleVerifyCode} className="mt-8 space-y-4">
                    <div>
                      <label htmlFor="otp-code" className="block text-sm font-medium leading-6 text-white/80">
                        Verification code
                      </label>
                      <motion.div
                        key={shakeKey}
                        className="mt-2"
                        animate={!prefersReducedMotion && shakeKey > 0 ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
                        transition={{ duration: 0.4 }}
                      >
                        <Input
                          id="otp-code"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={10}
                          autoComplete="one-time-code"
                          autoFocus
                          value={code}
                          onChange={(e) => {
                            setVerifyError("")
                            setCode(e.target.value.replace(/\D/g, "").slice(0, 10))
                          }}
                          placeholder="Enter code from email"
                          className={cn(
                            "text-center text-lg sm:text-xl tracking-[0.2em] sm:tracking-[0.4em] font-mono",
                            INPUT_BASE_CLASS,
                            theme.ringClass
                          )}
                          aria-invalid={!!verifyError}
                        />
                      </motion.div>
                    </div>

                    {verifyError && <p className="text-sm text-destructive">{verifyError}</p>}

                    <ShineButton
                      type="submit"
                      disabled={verifying || code.length < 6}
                      className={cn("w-full", CTA_ACCENT_CLASS)}
                      style={ctaAccentStyle(theme)}
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <KeyRound className="h-4 w-4 mr-2" />
                          Verify code & sign in
                        </>
                      )}
                    </ShineButton>
                  </form>

                  <Button
                    variant="outline"
                    className="w-full mt-4 border-white/15 bg-transparent text-white/70 hover:bg-white/5 hover:text-white"
                    onClick={() => {
                      setSent(false)
                      setEmail("")
                      setCode("")
                      setVerifyError("")
                    }}
                  >
                    Use a different email
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  <TiltCard className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:p-8">
                    <div className="mb-7 flex items-center justify-between">
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={loginMode}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50"
                        >
                          {loginMode === "password" ? "Access · Password" : "Access · Link"}
                        </motion.span>
                      </AnimatePresence>
                      <span
                        className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em]"
                        style={{ color: `${theme.accent}CC` }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full animate-pulse-slow" style={{ background: theme.accent }} />
                        Ready
                      </span>
                    </div>

                    <h2 className="text-2xl font-bold tracking-tight text-white">Authenticate</h2>
                    <div className="mt-2 relative">
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.p
                          key={loginMode}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="text-pretty text-sm leading-relaxed text-white/60"
                        >
                          {loginMode === "password"
                            ? "Enter your credentials to access the command center."
                            : "We'll email a single-use secure link — nothing to remember."}
                        </motion.p>
                      </AnimatePresence>
                    </div>

                    <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-5">
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium leading-6 text-white/80">
                          Email address
                        </label>
                        <div className="mt-2 relative">
                          <Mail
                            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
                            aria-hidden="true"
                          />
                          <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            autoComplete="email"
                            aria-invalid={!!error}
                            className={cn("pl-11", INPUT_BASE_CLASS, theme.ringClass)}
                          />
                        </div>
                      </div>

                      <AnimatePresence initial={false}>
                        {loginMode === "password" && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: EASE }}
                            className="overflow-hidden"
                          >
                            <label htmlFor="password" className="block text-sm font-medium leading-6 text-white/80">
                              Password
                            </label>
                            <div className="mt-2 relative">
                              <Lock
                                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
                                aria-hidden="true"
                              />
                              <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                autoComplete="current-password"
                                aria-invalid={!!error}
                                className={cn("pl-11 pr-11", INPUT_BASE_CLASS, theme.ringClass)}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword((s) => !s)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-white/40 transition hover:bg-white/10 hover:text-white"
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {error && <p className="text-sm text-destructive">{error}</p>}

                      <ShineButton
                        type="submit"
                        disabled={loading || !email || (loginMode === "password" && !password)}
                        className={cn("group h-12 w-full gap-2 text-sm", CTA_ACCENT_CLASS)}
                        style={ctaAccentStyle(theme)}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {loginMode === "password" ? "Signing in..." : "Sending secure link..."}
                          </>
                        ) : loginMode === "password" ? (
                          <>
                            <KeyRound className="h-4 w-4 mr-2" />
                            Sign in
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Send secure link
                          </>
                        )}
                      </ShineButton>
                    </form>

                    <div className="mt-5 flex items-center gap-3">
                      <span className="h-px flex-1 bg-white/10" />
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">Or</span>
                      <span className="h-px flex-1 bg-white/10" />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setError("")
                        setPassword("")
                        setLoginMode((m) => (m === "password" ? "magic-link" : "password"))
                      }}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 py-2.5 text-center text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      {loginMode === "password" ? (
                        <Send className="h-3.5 w-3.5" />
                      ) : (
                        <Lock className="h-3.5 w-3.5" />
                      )}
                      {loginMode === "password" ? "Use magic link instead" : "Use password instead"}
                    </button>

                    <p className="mt-6 flex items-center justify-center gap-1.5 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-white/25">
                      <Shield className="h-3 w-3" />
                      Restricted &middot; Faculty &amp; Administrators
                    </p>
                  </TiltCard>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Bottom telemetry bar */}
      <footer className="relative z-10 flex flex-col items-start justify-between gap-2 border-t border-white/10 px-6 py-4 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40 sm:flex-row sm:items-center sm:px-10">
        <span>{COMPANY_CONFIG.fullName}</span>
        <span className="flex items-center gap-4">
          <span>ISO-27001 &middot; AES-256</span>
          <span style={{ color: `${theme.accent}B3` }}>v3.1.0</span>
        </span>
      </footer>
    </main>
  )
}

function LoginLoading() {
  // Suspense fallback, rendered before any client theme logic can run --
  // always the first theme (cyan) rather than trying to rotate here.
  const theme = LOGIN_THEMES[0]
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: theme.base }}>
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: theme.accent }} />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  )
}
