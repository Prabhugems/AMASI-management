"use client"

import { useState, useEffect, useMemo, Suspense, useRef, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useTheme } from "next-themes"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import {
  Calendar,
  MapPin,
  ArrowLeft,
  ArrowRight,
  Share2,
  ChevronDown,
  Globe,
  Mail,
  Phone,
  AlertCircle,
  CheckCircle,
  Loader2,
  ExternalLink,
  Download,
  Ticket,
  ClipboardList,
  CreditCard,
} from "lucide-react"
import { TicketSelector } from "@/components/registration/ticket-selector"
import { RegistrationTypeSelector } from "@/components/registration/registration-type-selector"
import { AddonsSelector, Addon, SelectedAddon } from "@/components/registration/addons-selector"
import { TicketType } from "@/lib/types"
import { usePageTracking } from "@/hooks/usePageTracking"

interface EventSettings {
  allow_buyers: boolean
  allow_multiple_ticket_types: boolean
  allow_multiple_addons: boolean
  enable_waitlist?: boolean
}

/* ─── Colors ─── */
const C = {
  bg: '#FAFAF7',
  card: '#FFFFFF',
  border: 'rgba(28, 25, 23, 0.06)',
  borderHover: 'rgba(22, 101, 52, 0.2)',
  text: '#1C1917',
  textSecondary: '#57534E',
  textMuted: '#A8A29E',
  textFaint: '#C4C0BB',
  green: '#166534',
  greenLight: '#14532D',
  greenBg: 'rgba(22, 101, 52, 0.05)',
  greenBgStrong: 'rgba(22, 101, 52, 0.08)',
  gold: '#D97706',
  goldBg: 'rgba(217, 119, 6, 0.06)',
} as const

/* ─── Progress Step Indicator ─── */
function ProgressIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: "Select Ticket", icon: Ticket },
    { num: 2, label: "Your Details", icon: ClipboardList },
    { num: 3, label: "Payment", icon: CreditCard },
  ]

  return (
    <div className="w-full mb-10">
      <div className="flex items-center justify-between max-w-md mx-auto">
        {steps.map((step, idx) => {
          const StepIcon = step.icon
          const isActive = currentStep === step.num
          const isCompleted = currentStep > step.num
          return (
            <div key={step.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center relative">
                <div
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-500 min-w-[44px] min-h-[44px]"
                  style={{
                    background: isCompleted
                      ? C.green
                      : isActive
                        ? C.green
                        : 'rgba(28, 25, 23, 0.06)',
                    color: isCompleted || isActive ? '#FFFFFF' : C.textMuted,
                    boxShadow: isActive
                      ? '0 4px 14px rgba(22, 101, 52, 0.25)'
                      : isCompleted
                        ? '0 2px 8px rgba(22, 101, 52, 0.15)'
                        : 'none',
                    transform: isActive ? 'scale(1.08)' : 'scale(1)',
                  }}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <StepIcon className="w-5 h-5" />
                  )}
                </div>
                <span
                  className="text-xs mt-2.5 font-medium text-center whitespace-nowrap transition-colors duration-300"
                  style={{
                    color: isActive || isCompleted ? C.green : C.textMuted,
                  }}
                >
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className="flex-1 mx-2 sm:mx-3 mt-[-20px]">
                  <div
                    className="h-[2px] rounded-full overflow-hidden"
                    style={{ background: 'rgba(28, 25, 23, 0.06)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        background: C.green,
                        width: isCompleted ? '100%' : '0%',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Email Check Widget ─── */
function EmailCheckWidget({ eventId }: { eventId: string }) {
  const [email, setEmail] = useState("")
  const [isChecking, setIsChecking] = useState(false)
  const [result, setResult] = useState<{
    hasRegistrations: boolean
    registrations?: { registration_number: string; ticket_name: string; status: string }[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCheck = async () => {
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address")
      return
    }

    setIsChecking(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(
        `/api/registrations/check-email?email=${encodeURIComponent(email)}&event_id=${eventId}`
      )
      const data = await response.json()

      if (response.ok) {
        setResult({
          hasRegistrations: data.exists,
          registrations: data.registrations,
        })
      } else {
        setError(data.error || "Failed to check email")
      }
    } catch (_err) {
      setError("Failed to check email. Please try again.")
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div
      className="p-3.5 sm:p-4 rounded-xl"
      style={{ background: C.greenBg, border: `1px solid ${C.greenBgStrong}` }}
    >
      <p className="text-sm font-medium mb-3" style={{ color: C.greenLight }}>
        Already registered? Check your email
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setResult(null)
            setError(null)
          }}
          placeholder="Enter your email"
          className="flex-1 px-3.5 py-2.5 text-sm rounded-lg bg-white focus:outline-none focus:ring-2 min-h-[44px] transition-all duration-200"
          style={{
            border: `1px solid ${C.greenBgStrong}`,
            color: C.text,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = C.green
            e.currentTarget.style.boxShadow = `0 0 0 3px rgba(22, 101, 52, 0.08)`
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = C.greenBgStrong
            e.currentTarget.style.boxShadow = 'none'
          }}
          onKeyDown={(e) => e.key === "Enter" && handleCheck()}
        />
        <button
          onClick={handleCheck}
          disabled={isChecking || !email}
          className="px-4 py-2.5 text-sm font-semibold rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-h-[44px] min-w-[44px] transition-all duration-200 active:scale-[0.97]"
          style={{ background: C.green }}
        >
          {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check"}
        </button>
      </div>

      {error && (
        <div className="mt-2.5">
          <p className="text-sm text-red-600 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </p>
        </div>
      )}

      {result && (
        <div className="mt-3">
          {result.hasRegistrations ? (
            <div
              className="p-3 rounded-lg"
              style={{ background: C.goldBg, border: '1px solid rgba(217, 119, 6, 0.15)' }}
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: C.gold }} />
                <div className="text-sm">
                  <p className="font-medium" style={{ color: '#92400E' }}>
                    You&apos;re already registered!
                  </p>
                  <p className="mt-1" style={{ color: '#A16207' }}>
                    Registration: {result.registrations?.[0]?.registration_number}
                  </p>
                  <a
                    href={`/my?q=${encodeURIComponent(email)}`}
                    className="inline-flex items-center gap-1 mt-2 font-medium min-h-[44px] sm:min-h-0 transition-colors"
                    style={{ color: '#A16207' }}
                  >
                    View My Registrations <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="p-3 rounded-lg"
              style={{ background: C.greenBg, border: `1px solid ${C.greenBgStrong}` }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" style={{ color: C.green }} />
                <p className="text-sm" style={{ color: C.greenLight }}>
                  No existing registration found. You can proceed!
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Types ─── */
interface EventDetails {
  id: string
  name: string
  short_name: string
  slug: string
  tagline?: string
  description?: string
  welcome_message?: string
  event_type: string
  start_date: string
  end_date: string
  city: string
  state?: string
  country?: string
  venue_name?: string
  venue_address?: string
  banner_url?: string
  logo_url?: string
  website_url?: string
  contact_email?: string
  contact_phone?: string
  scientific_chairman?: string
  organizing_chairman?: string
  status: string
  registration_open?: boolean
  ticket_types: TicketType[]
}

/* ─── Shared card style ─── */
const cardStyle: React.CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: '16px',
}

export default function EventDetailsPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div
            className="h-8 w-8 rounded-full border-[3px] border-t-transparent animate-spin"
            style={{ borderColor: `${C.green} transparent ${C.green} ${C.green}` }}
          />
        </div>
      }
    >
      <EventDetailsPage />
    </Suspense>
  )
}

function EventDetailsPage() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [selectedTickets, setSelectedTickets] = useState<Map<string, number>>(new Map())
  const [selectedAddons, setSelectedAddons] = useState<Map<string, SelectedAddon>>(new Map())
  const [showFullDescription, setShowFullDescription] = useState(false)
  const [registrationType, setRegistrationType] = useState<"individual" | "group" | null>(null)
  const [shareTooltip, setShareTooltip] = useState(false)
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const eventSlug = params.eventSlug as string
  const ticketSectionRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const [priceAnimKey, setPriceAnimKey] = useState(0)

  // Parallax effect for hero banner
  useEffect(() => {
    if (!mounted) return
    const heroEl = heroRef.current
    if (!heroEl) return

    const handleScroll = () => {
      const rect = heroEl.getBoundingClientRect()
      const scrollProgress = Math.max(0, Math.min(1, -rect.top / (rect.height * 2)))
      const scale = 1 + scrollProgress * 0.08
      const img = heroEl.querySelector('.hero-parallax') as HTMLElement
      if (img) {
        img.style.transform = `scale(${scale})`
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [mounted])

  const directTicketId = searchParams.get("ticket")
  const urlRegType = searchParams.get("type") as "individual" | "group" | null

  useEffect(() => {
    setMounted(true)
    if (urlRegType === "individual" || urlRegType === "group") {
      setRegistrationType(urlRegType)
    }
  }, [urlRegType])

  const _isDark = mounted ? resolvedTheme === "dark" : false
  const supabase = createClient()

  // Fetch event details via public API
  const { data: event, isLoading, error } = useQuery({
    queryKey: ["public-event", eventSlug, directTicketId],
    queryFn: async () => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventSlug)
      const param = isUuid ? `id=${eventSlug}` : `slug=${eventSlug}`
      const res = await fetch(`/api/events/public?${param}`)

      if (!res.ok) {
        if (res.status === 404) return null
        throw new Error("Failed to fetch event")
      }

      const eventData = await res.json() as EventDetails | null

      if (eventData?.ticket_types) {
        eventData.ticket_types = eventData.ticket_types.filter(
          (t: TicketType) => !t.is_hidden || t.id === directTicketId
        )
      }

      return eventData
    },
    retry: false,
  })

  // Fetch event settings
  const { data: eventSettings } = useQuery({
    queryKey: ["event-settings-public", event?.id],
    queryFn: async () => {
      if (!event?.id) return null
      const response = await fetch(`/api/event-settings?event_id=${event.id}`)
      if (!response.ok) return null
      return response.json() as Promise<EventSettings>
    },
    enabled: !!event?.id,
  })

  // Fetch addons
  const { data: addons } = useQuery({
    queryKey: ["public-event-addons", event?.id],
    queryFn: async () => {
      if (!event?.id) return []

      const { data, error } = await (supabase as any)
        .from("addons")
        .select(`*, variants:addon_variants(*)`)
        .eq("event_id", event.id)
        .eq("is_active", true)
        .order("sort_order")

      if (error) {
        console.error("Failed to fetch addons:", error)
        return []
      }

      const addonsWithLinks = await Promise.all(
        (data || []).map(async (addon: Addon) => {
          const { data: links } = await (supabase as any)
            .from("addon_ticket_links")
            .select("ticket_type_id")
            .eq("addon_id", addon.id)
          addon.linked_ticket_ids = (links || []).map((l: any) => l.ticket_type_id)
          return addon
        })
      )

      return addonsWithLinks as Addon[]
    },
    enabled: !!event?.id,
  })

  const allowBuyers = eventSettings?.allow_buyers ?? false

  usePageTracking({ eventId: event?.id || "", pageType: "register" })

  // Calculate totals
  const totals = useMemo(() => {
    if (!event?.ticket_types) return { subtotal: 0, tax: 0, total: 0, count: 0, addonsTotal: 0, addonsTax: 0 }

    let subtotal = 0
    let tax = 0
    let count = 0
    let addonsTotal = 0
    let addonsTax = 0
    let taxPercentage = 18

    selectedTickets.forEach((quantity, ticketId) => {
      const ticket = event.ticket_types.find((t) => t.id === ticketId)
      if (ticket) {
        const ticketSubtotal = ticket.price * quantity
        const ticketTax = (ticketSubtotal * ticket.tax_percentage) / 100
        subtotal += ticketSubtotal
        tax += ticketTax
        count += quantity
        taxPercentage = ticket.tax_percentage
      }
    })

    selectedAddons.forEach((addon) => {
      addonsTotal += addon.totalPrice
    })
    addonsTax = (addonsTotal * taxPercentage) / 100

    return { subtotal, tax, total: subtotal + tax + addonsTotal + addonsTax, count, addonsTotal, addonsTax }
  }, [selectedTickets, selectedAddons, event?.ticket_types])

  useEffect(() => {
    if (totals.total > 0) setPriceAnimKey(prev => prev + 1)
  }, [totals.total])

  const currentStep = useMemo(() => {
    if (totals.count === 0) return 1
    return 1
  }, [totals.count])

  const scrollToTickets = useCallback(() => {
    setTimeout(() => {
      ticketSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 150)
  }, [])

  const handleProceedToCheckout = () => {
    const selection: { ticketId: string; quantity: number }[] = []
    selectedTickets.forEach((quantity, ticketId) => {
      selection.push({ ticketId, quantity })
    })

    const addonsSelection: SelectedAddon[] = []
    selectedAddons.forEach((addon, _key) => {
      addonsSelection.push(addon)
    })

    sessionStorage.setItem(
      `checkout_${eventSlug}`,
      JSON.stringify({
        selection,
        addonsSelection,
        totals,
        registrationType: registrationType || "individual",
      })
    )

    if (registrationType === "group") {
      router.push(`/register/${eventSlug}/group`)
    } else {
      router.push(`/register/${eventSlug}/checkout`)
    }
  }

  const handleRegistrationTypeSelect = (type: "individual" | "group") => {
    setRegistrationType(type)
    scrollToTickets()
  }

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: event?.name, url: window.location.href })
      } else {
        await navigator.clipboard.writeText(window.location.href)
        setShareTooltip(true)
        setTimeout(() => setShareTooltip(false), 2000)
      }
    } catch (_err) {
      // User cancelled
    }
  }

  /* ─── Loading ─── */
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12">
        <div className="max-w-4xl mx-auto animate-pulse space-y-6">
          <div className="h-72 rounded-2xl" style={{ background: 'rgba(28,25,23,0.04)' }} />
          <div className="h-8 w-1/2 rounded-lg" style={{ background: 'rgba(28,25,23,0.06)' }} />
          <div className="h-4 w-3/4 rounded-lg" style={{ background: 'rgba(28,25,23,0.04)' }} />
          <div className="h-4 w-1/2 rounded-lg" style={{ background: 'rgba(28,25,23,0.04)' }} />
        </div>
      </div>
    )
  }

  /* ─── Not Found ─── */
  if (error || !event) {
    return (
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12">
        <div
          className="max-w-xl mx-auto text-center py-16 px-6 rounded-2xl"
          style={cardStyle}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(28,25,23,0.04)' }}
          >
            <AlertCircle className="w-8 h-8" style={{ color: C.textMuted }} />
          </div>
          <h2 className="reg-serif text-2xl font-bold mb-3" style={{ color: C.text }}>
            Event Not Found
          </h2>
          <p className="mb-6 text-[15px]" style={{ color: C.textSecondary }}>
            The event you&apos;re looking for doesn&apos;t exist or registration is not open.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold transition-all duration-200 hover:shadow-lg min-h-[44px] active:scale-[0.97]"
            style={{ background: C.green }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Events
          </Link>
        </div>
      </div>
    )
  }

  /* ─── Registration Closed ─── */
  if (event.registration_open === false) {
    return (
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12">
        <div className="max-w-lg mx-auto text-center">
          <div className="rounded-2xl p-8" style={cardStyle}>
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: 'rgba(239, 68, 68, 0.06)' }}
            >
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="reg-serif text-2xl font-bold mb-2" style={{ color: C.text }}>
              Registration Closed
            </h1>
            <p className="mb-6 text-[15px]" style={{ color: C.textSecondary }}>
              Registration for <span className="font-semibold">{event.name}</span> is currently closed.
              Please check back later or contact the organizers.
            </p>
            {event.contact_email && (
              <p className="text-sm mb-4" style={{ color: C.textMuted }}>
                Contact:{" "}
                <a href={`mailto:${event.contact_email}`} className="underline" style={{ color: C.green }}>
                  {event.contact_email}
                </a>
              </p>
            )}
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors min-h-[44px]"
              style={{ background: 'rgba(28,25,23,0.04)', color: C.textSecondary }}
            >
              <ArrowLeft className="w-4 h-4" />
              Browse Other Events
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const eventTypeLabel = event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)

  /* ─── Main View ─── */
  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
      <ProgressIndicator currentStep={currentStep} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-8">
        {/* ─── Main Content ─── */}
        <div className="lg:col-span-2 space-y-5 sm:space-y-6">

          {/* Hero Banner */}
          <div ref={heroRef} className="relative overflow-hidden rounded-2xl" style={{ border: `1px solid ${C.border}` }}>
            {event.banner_url ? (
              <img
                src={event.banner_url}
                alt={event.name}
                className="w-full h-64 md:h-80 object-cover hero-parallax"
              />
            ) : (
              <div
                className="w-full h-64 md:h-80 flex items-center justify-center hero-parallax"
                style={{ background: 'linear-gradient(145deg, #14532D 0%, #166534 40%, #22C55E 100%)' }}
              >
                <span className="reg-serif text-8xl font-bold" style={{ color: 'rgba(255,255,255,0.12)' }}>
                  {event.short_name?.[0] || event.name[0]}
                </span>
              </div>
            )}
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, rgba(28,25,23,0.55) 0%, rgba(28,25,23,0.05) 50%, transparent 100%)' }}
            />

            {/* Event Type Badge */}
            <div className="absolute top-4 left-4">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wide uppercase"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(12px)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                {eventTypeLabel}
              </span>
            </div>

            {/* Share Button */}
            <div className="absolute top-4 right-4">
              <button
                className="p-2.5 rounded-full text-white transition-all min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-[0.95]"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
                onClick={handleShare}
              >
                <Share2 className="w-5 h-5" />
              </button>
              {shareTooltip && (
                <div
                  className="absolute top-full right-0 mt-2 px-3 py-1.5 text-white text-xs rounded-lg whitespace-nowrap"
                  style={{ background: C.text }}
                >
                  Link copied!
                </div>
              )}
            </div>

            {/* Event Logo */}
            {event.logo_url && (
              <div className="absolute bottom-4 left-4">
                <img
                  src={event.logo_url}
                  alt={event.name}
                  className="h-14 w-14 rounded-xl bg-white/95 object-contain shadow-lg"
                  style={{ border: '2px solid rgba(255,255,255,0.8)' }}
                />
              </div>
            )}
          </div>

          {/* Event Title & Info */}
          <div>
            <h1 className="reg-serif text-3xl md:text-4xl font-bold mb-3 tracking-tight" style={{ color: C.text, lineHeight: 1.15 }}>
              {event.name}
            </h1>

            {event.tagline && (
              <p className="text-base mb-6 leading-relaxed" style={{ color: C.textSecondary }}>
                {event.tagline}
              </p>
            )}

            {/* Quick Info Bar */}
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl"
              style={cardStyle}
            >
              <div className="flex items-center gap-3 min-h-[44px]">
                <div
                  className="p-2.5 rounded-xl"
                  style={{ background: C.greenBg }}
                >
                  <Calendar className="w-[18px] h-[18px]" style={{ color: C.green }} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: C.text }}>
                    {format(new Date(event.start_date), "d MMMM yyyy")}
                    {event.end_date && event.end_date !== event.start_date && (
                      <> – {format(new Date(event.end_date), "d MMMM yyyy")}</>
                    )}
                  </p>
                  <p className="text-[11px] font-medium" style={{ color: C.textMuted }}>
                    Event Date
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 min-h-[44px]">
                <div
                  className="p-2.5 rounded-xl"
                  style={{ background: C.greenBg }}
                >
                  <MapPin className="w-[18px] h-[18px]" style={{ color: C.green }} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: C.text }}>
                    {event.venue_name || event.city}
                  </p>
                  <p className="text-[11px] font-medium" style={{ color: C.textMuted }}>
                    {event.city}
                    {event.state && `, ${event.state}`}
                  </p>
                </div>
              </div>

              <a
                href={`/api/events/${event.id}/invitation-pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-sm font-semibold mt-1 min-h-[44px] transition-colors duration-200"
                style={{ color: C.green }}
              >
                <Download className="w-4 h-4" />
                Download Invitation
              </a>
            </div>
          </div>

          {/* Description */}
          {(event.description || event.welcome_message) && (
            <div className="p-5 sm:p-6 rounded-2xl" style={cardStyle}>
              <h2 className="reg-serif text-lg font-bold mb-4" style={{ color: C.text }}>
                About This Event
              </h2>
              <div
                className={`
                  prose prose-sm max-w-none transition-all duration-500
                  ${!showFullDescription && (event.description?.length || 0) > 500 ? "line-clamp-4" : ""}
                `}
              >
                <p className="text-[15px] leading-relaxed" style={{ color: C.textSecondary }}>
                  {event.description || event.welcome_message}
                </p>
              </div>
              {(event.description?.length || 0) > 500 && (
                <button
                  onClick={() => setShowFullDescription(!showFullDescription)}
                  className="mt-4 text-sm font-semibold flex items-center gap-1 min-h-[44px] transition-colors duration-200"
                  style={{ color: C.green }}
                >
                  {showFullDescription ? "Show less" : "Read more"}
                  <ChevronDown
                    className="w-4 h-4 transition-transform duration-300"
                    style={{ transform: showFullDescription ? 'rotate(180deg)' : 'rotate(0)' }}
                  />
                </button>
              )}
            </div>
          )}

          {/* Contact Info */}
          {(event.contact_email || event.contact_phone || event.website_url) && (
            <div className="p-5 sm:p-6 rounded-2xl" style={cardStyle}>
              <h2 className="reg-serif text-lg font-bold mb-4" style={{ color: C.text }}>
                Contact Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {event.contact_email && (
                  <a
                    href={`mailto:${event.contact_email}`}
                    className="flex items-center gap-3 p-3.5 rounded-xl transition-all duration-200 min-h-[44px]"
                    style={{ background: 'rgba(28,25,23,0.02)', border: `1px solid ${C.border}` }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = C.greenBg
                      e.currentTarget.style.borderColor = C.greenBgStrong
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(28,25,23,0.02)'
                      e.currentTarget.style.borderColor = C.border
                    }}
                  >
                    <Mail className="w-[18px] h-[18px]" style={{ color: C.green }} />
                    <span className="text-sm truncate" style={{ color: C.text }}>
                      {event.contact_email}
                    </span>
                  </a>
                )}
                {event.contact_phone && (
                  <a
                    href={`tel:${event.contact_phone}`}
                    className="flex items-center gap-3 p-3.5 rounded-xl transition-all duration-200 min-h-[44px]"
                    style={{ background: 'rgba(28,25,23,0.02)', border: `1px solid ${C.border}` }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = C.greenBg
                      e.currentTarget.style.borderColor = C.greenBgStrong
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(28,25,23,0.02)'
                      e.currentTarget.style.borderColor = C.border
                    }}
                  >
                    <Phone className="w-[18px] h-[18px]" style={{ color: C.green }} />
                    <span className="text-sm" style={{ color: C.text }}>
                      {event.contact_phone}
                    </span>
                  </a>
                )}
                {event.website_url && (
                  <a
                    href={event.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3.5 rounded-xl transition-all duration-200 min-h-[44px]"
                    style={{ background: 'rgba(28,25,23,0.02)', border: `1px solid ${C.border}` }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = C.greenBg
                      e.currentTarget.style.borderColor = C.greenBgStrong
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(28,25,23,0.02)'
                      e.currentTarget.style.borderColor = C.border
                    }}
                  >
                    <Globe className="w-[18px] h-[18px]" style={{ color: C.green }} />
                    <span className="text-sm" style={{ color: C.text }}>
                      Visit Website
                    </span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Registration Type Selector */}
          {allowBuyers && !registrationType && (
            <div className="p-5 sm:p-6 rounded-2xl" style={cardStyle}>
              <RegistrationTypeSelector
                allowBuyers={allowBuyers}
                onSelect={handleRegistrationTypeSelect}
                selectedType={registrationType}
              />
            </div>
          )}

          {/* Ticket Selection */}
          {event.ticket_types && event.ticket_types.length > 0 && (!allowBuyers || registrationType) && (
            <div ref={ticketSectionRef} className="p-5 sm:p-6 rounded-2xl" style={cardStyle}>
              {allowBuyers && registrationType && (
                <div className="mb-4 flex items-center justify-between">
                  <span
                    className="px-3 py-1.5 text-xs font-semibold rounded-full"
                    style={{
                      background: registrationType === "individual" ? C.greenBg : C.goldBg,
                      color: registrationType === "individual" ? C.green : C.gold,
                    }}
                  >
                    {registrationType === "individual" ? "Individual Registration" : "Group Booking"}
                  </span>
                  <button
                    onClick={() => setRegistrationType(null)}
                    className="text-sm min-h-[44px] px-2 transition-colors duration-200"
                    style={{ color: C.textMuted }}
                  >
                    Change
                  </button>
                </div>
              )}

              <TicketSelector
                tickets={event.ticket_types}
                selectedTickets={selectedTickets}
                onSelectionChange={setSelectedTickets}
                allowMultipleTicketTypes={eventSettings?.allow_multiple_ticket_types ?? false}
                eventId={event.id}
                waitlistEnabled={eventSettings?.enable_waitlist ?? true}
              />
            </div>
          )}

          {/* Addons Selection */}
          {addons && addons.length > 0 && totals.count > 0 && (
            <div className="p-5 sm:p-6 rounded-2xl" style={cardStyle}>
              <AddonsSelector
                addons={addons}
                selectedAddons={selectedAddons}
                onSelectionChange={setSelectedAddons}
                selectedTicketIds={Array.from(selectedTickets.keys())}
                taxPercentage={event.ticket_types?.find(t => selectedTickets.has(t.id))?.tax_percentage || 18}
              />
            </div>
          )}
        </div>

        {/* ─── Sticky Order Summary ─── */}
        <div className="lg:col-span-1">
          <div
            className="lg:sticky lg:top-24 overflow-hidden rounded-2xl transition-all duration-300"
            style={{
              ...cardStyle,
              boxShadow: '0 1px 3px rgba(28, 25, 23, 0.04)',
            }}
          >
            {/* Header */}
            <div className="p-5" style={{ borderBottom: `1px solid ${C.border}` }}>
              <h3 className="reg-serif text-lg font-bold" style={{ color: C.text }}>
                Order Summary
              </h3>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <EmailCheckWidget eventId={event.id} />

              {totals.count === 0 ? (
                <div className="text-center py-8">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                    style={{ background: 'rgba(28,25,23,0.04)' }}
                  >
                    <Ticket className="w-6 h-6" style={{ color: C.textMuted }} />
                  </div>
                  <p className="text-sm" style={{ color: C.textMuted }}>
                    Select tickets to continue
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Selected Tickets */}
                  {Array.from(selectedTickets.entries()).map(([ticketId, quantity]) => {
                    const ticket = event.ticket_types.find((t) => t.id === ticketId)
                    if (!ticket || quantity === 0) return null
                    return (
                      <div key={ticketId} className="flex justify-between text-sm">
                        <span style={{ color: C.textSecondary }}>
                          {ticket.name} x {quantity}
                        </span>
                        <span className="font-medium" style={{ color: C.text }}>
                          {"\u20B9"}{Math.round(ticket.price * (1 + ticket.tax_percentage / 100) * quantity).toLocaleString("en-IN")}
                        </span>
                      </div>
                    )
                  })}

                  {/* Selected Addons */}
                  {selectedAddons.size > 0 && (
                    <>
                      <div className="pt-2 mt-2" style={{ borderTop: `1px solid ${C.border}` }}>
                        <p className="text-xs font-medium mb-2" style={{ color: C.textMuted }}>Add-ons</p>
                      </div>
                      {Array.from(selectedAddons.entries()).map(([key, addon]) => {
                        const addonData = addons?.find(a => a.id === addon.addonId)
                        const variant = addonData?.variants?.find(v => v.id === addon.variantId)
                        return (
                          <div key={key} className="flex justify-between text-sm">
                            <span style={{ color: C.textSecondary }}>
                              {addonData?.name}
                              {variant && ` (${variant.name})`}
                              {addon.quantity > 1 && ` x ${addon.quantity}`}
                            </span>
                            <span className="font-medium" style={{ color: C.text }}>
                              {"\u20B9"}{addon.totalPrice.toLocaleString()}
                            </span>
                          </div>
                        )
                      })}
                    </>
                  )}

                  <div className="pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                    <div className="flex justify-between text-sm mb-2">
                      <span style={{ color: C.textSecondary }}>Tickets Subtotal</span>
                      <span style={{ color: C.text }}>
                        {"\u20B9"}{Math.round(totals.subtotal).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span style={{ color: C.textSecondary }}>Tickets GST</span>
                      <span style={{ color: C.text }}>
                        {"\u20B9"}{Math.round(totals.tax).toLocaleString("en-IN")}
                      </span>
                    </div>
                    {totals.addonsTotal > 0 && (
                      <>
                        <div className="flex justify-between text-sm mb-2">
                          <span style={{ color: C.textSecondary }}>Add-ons Subtotal</span>
                          <span style={{ color: C.text }}>
                            {"\u20B9"}{Math.round(totals.addonsTotal).toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                          <span style={{ color: C.textSecondary }}>Add-ons GST</span>
                          <span style={{ color: C.text }}>
                            {"\u20B9"}{Math.round(totals.addonsTax).toLocaleString("en-IN")}
                          </span>
                        </div>
                      </>
                    )}
                    <div
                      className="flex justify-between text-lg font-bold pt-4"
                      style={{ borderTop: `1px solid ${C.border}` }}
                    >
                      <span style={{ color: C.text }}>Total</span>
                      <span key={priceAnimKey} style={{ color: C.green }}>
                        {"\u20B9"}{Math.round(totals.total).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* CTA Button */}
            <div className="p-5 pt-0">
              <button
                onClick={handleProceedToCheckout}
                disabled={totals.count === 0}
                className="w-full py-4 rounded-xl font-bold text-white min-h-[52px] flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.97]"
                style={{
                  background: totals.count === 0
                    ? 'rgba(28,25,23,0.08)'
                    : `linear-gradient(145deg, ${C.greenLight} 0%, ${C.green} 50%, #15803D 100%)`,
                  color: totals.count === 0 ? C.textMuted : '#FFFFFF',
                  cursor: totals.count === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: totals.count === 0 ? 'none' : '0 4px 14px rgba(22, 101, 52, 0.25)',
                  transform: 'translateY(0)',
                }}
                onMouseEnter={(e) => {
                  if (totals.count > 0) {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(22, 101, 52, 0.3)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = totals.count === 0 ? 'none' : '0 4px 14px rgba(22, 101, 52, 0.25)'
                }}
              >
                Proceed to Checkout
                <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-center text-xs mt-3" style={{ color: C.textMuted }}>
                Secure payment powered by Razorpay
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Fixed Bottom Checkout Bar */}
      {totals.count > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 p-4 z-40 lg:hidden"
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: `1px solid ${C.border}`,
            boxShadow: '0 -4px 20px rgba(28,25,23,0.08)',
          }}
        >
          <div className="flex items-center justify-between gap-4 max-w-lg mx-auto">
            <div>
              <p className="text-sm" style={{ color: C.textMuted }}>
                {totals.count} ticket{totals.count > 1 ? "s" : ""}
              </p>
              <p className="text-lg font-bold" style={{ color: C.text }}>
                {"\u20B9"}{totals.total.toLocaleString()}
              </p>
            </div>
            <button
              onClick={handleProceedToCheckout}
              className="flex-1 max-w-[200px] py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 active:scale-[0.95] transition-all min-h-[48px]"
              style={{
                background: `linear-gradient(145deg, ${C.greenLight} 0%, ${C.green} 100%)`,
                boxShadow: '0 4px 14px rgba(22, 101, 52, 0.25)',
              }}
            >
              Checkout
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {totals.count > 0 && <div className="h-24 lg:hidden" />}
    </div>
  )
}
