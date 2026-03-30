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
  Sparkles,
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

// Progress Step Indicator
function ProgressIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: "Select Ticket", icon: Ticket },
    { num: 2, label: "Your Details", icon: ClipboardList },
    { num: 3, label: "Payment", icon: CreditCard },
  ]

  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between max-w-md mx-auto">
        {steps.map((step, idx) => {
          const StepIcon = step.icon
          const isActive = currentStep === step.num
          const isCompleted = currentStep > step.num
          return (
            <div key={step.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center relative">
                <div
                  className={`
                    w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center
                    transition-all duration-500 min-w-[44px] min-h-[44px]
                    ${isCompleted
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                      : isActive
                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 scale-110"
                        : "bg-gray-200 text-gray-400"
                    }
                  `}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <StepIcon className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={`
                    text-xs mt-2 font-medium text-center whitespace-nowrap
                    transition-colors duration-300
                    ${isActive ? "text-emerald-600" : isCompleted ? "text-emerald-500" : "text-gray-400"}
                  `}
                >
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className="flex-1 mx-2 sm:mx-3 mt-[-20px]">
                  <div className="h-0.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`
                        h-full bg-emerald-500 rounded-full transition-all duration-700 ease-out
                        ${isCompleted ? "w-full" : "w-0"}
                      `}
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

// Early Email Check Component
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
    <div className="p-3 sm:p-4 bg-blue-50 rounded-xl border border-blue-100">
      <p className="text-sm font-medium text-blue-900 mb-3">
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
          className="flex-1 px-3 py-2.5 text-sm rounded-lg border border-blue-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 min-h-[44px] transition-all duration-200"
          onKeyDown={(e) => e.key === "Enter" && handleCheck()}
        />
        <button
          onClick={handleCheck}
          disabled={isChecking || !email}
          className="px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-h-[44px] min-w-[44px] transition-colors active:scale-95"
        >
          {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check"}
        </button>
      </div>

      {error && (
        <div className="mt-2 animate-slide-up-fade">
          <p className="text-sm text-red-600 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </p>
        </div>
      )}

      {result && (
        <div className="mt-3 animate-slide-up-fade">
          {result.hasRegistrations ? (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800">You&apos;re already registered!</p>
                  <p className="text-amber-700 mt-1">
                    Registration: {result.registrations?.[0]?.registration_number}
                  </p>
                  <a
                    href={`/my?q=${encodeURIComponent(email)}`}
                    className="inline-flex items-center gap-1 mt-2 text-amber-700 hover:text-amber-900 font-medium min-h-[44px] sm:min-h-0"
                  >
                    View My Registrations <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <p className="text-sm text-green-800">
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

export default function EventDetailsPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
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

  // Get ticket ID from URL for hidden ticket direct access
  const directTicketId = searchParams.get("ticket")
  // Get registration type from URL if pre-selected
  const urlRegType = searchParams.get("type") as "individual" | "group" | null

  useEffect(() => {
    setMounted(true)
    // If type is specified in URL, pre-select it
    if (urlRegType === "individual" || urlRegType === "group") {
      setRegistrationType(urlRegType)
    }
  }, [urlRegType])

  const _isDark = mounted ? resolvedTheme === "dark" : false
  const supabase = createClient()

  // Fetch event details via public API (bypasses RLS on ticket_types)
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

      // Filter out hidden tickets EXCEPT the one accessed via direct link
      if (eventData?.ticket_types) {
        eventData.ticket_types = eventData.ticket_types.filter(
          (t: TicketType) => !t.is_hidden || t.id === directTicketId
        )
      }

      return eventData
    },
    retry: false,
  })

  // Fetch event settings to check if buyers are allowed
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

  // Fetch addons for the event with ticket links
  const { data: addons } = useQuery({
    queryKey: ["public-event-addons", event?.id],
    queryFn: async () => {
      if (!event?.id) return []

      const { data, error } = await (supabase as any)
        .from("addons")
        .select(`
          *,
          variants:addon_variants(*)
        `)
        .eq("event_id", event.id)
        .eq("is_active", true)
        .order("sort_order")

      if (error) {
        console.error("Failed to fetch addons:", error)
        return []
      }

      // Fetch ticket links for each addon
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

  // Check if buyers are allowed for this event
  const allowBuyers = eventSettings?.allow_buyers ?? false

  // Track page view for analytics
  usePageTracking({ eventId: event?.id || "", pageType: "register" })

  // Calculate totals including addons with GST
  const totals = useMemo(() => {
    if (!event?.ticket_types) return { subtotal: 0, tax: 0, total: 0, count: 0, addonsTotal: 0, addonsTax: 0 }

    let subtotal = 0
    let tax = 0
    let count = 0
    let addonsTotal = 0
    let addonsTax = 0

    // Get the tax percentage from the first selected ticket (or default to 18%)
    let taxPercentage = 18
    selectedTickets.forEach((quantity, ticketId) => {
      const ticket = event.ticket_types.find((t) => t.id === ticketId)
      if (ticket) {
        const ticketSubtotal = ticket.price * quantity
        const ticketTax = (ticketSubtotal * ticket.tax_percentage) / 100
        subtotal += ticketSubtotal
        tax += ticketTax
        count += quantity
        taxPercentage = ticket.tax_percentage // Use ticket's tax rate
      }
    })

    // Add addon prices with GST
    selectedAddons.forEach((addon) => {
      addonsTotal += addon.totalPrice
    })
    addonsTax = (addonsTotal * taxPercentage) / 100

    return {
      subtotal,
      tax,
      total: subtotal + tax + addonsTotal + addonsTax,
      count,
      addonsTotal,
      addonsTax
    }
  }, [selectedTickets, selectedAddons, event?.ticket_types])

  // Trigger price animation when total changes
  useEffect(() => {
    if (totals.total > 0) {
      setPriceAnimKey(prev => prev + 1)
    }
  }, [totals.total])

  // Determine current step for progress indicator
  const currentStep = useMemo(() => {
    if (totals.count === 0) return 1
    return 1 // Still on step 1 (ticket selection page); step 2 and 3 are on checkout page
  }, [totals.count])

  // Smooth scroll to tickets when registration type is selected
  const scrollToTickets = useCallback(() => {
    setTimeout(() => {
      ticketSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 150)
  }, [])

  const handleProceedToCheckout = () => {
    // Store selection in sessionStorage (use eventSlug to match checkout page)
    const selection: { ticketId: string; quantity: number }[] = []
    selectedTickets.forEach((quantity, ticketId) => {
      selection.push({ ticketId, quantity })
    })

    // Convert addons map to array for storage
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

    // Route to group checkout if group registration selected
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
        await navigator.share({
          title: event?.name,
          url: window.location.href,
        })
      } else {
        await navigator.clipboard.writeText(window.location.href)
        setShareTooltip(true)
        setTimeout(() => setShareTooltip(false), 2000)
      }
    } catch (_err) {
      // User cancelled share dialog -- ignore
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-64 rounded-2xl bg-gray-200" />
            <div className="h-8 w-1/2 rounded bg-gray-200" />
            <div className="h-4 w-3/4 rounded bg-gray-200" />
            <div className="h-4 w-1/2 rounded bg-gray-200" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="bg-white rounded-xl shadow-sm max-w-xl mx-auto text-center py-16 px-6 animate-fade-in-up">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold mb-4 text-gray-900">
            Event Not Found
          </h2>
          <p className="mb-6 text-gray-600">
            The event you&apos;re looking for doesn&apos;t exist or registration is not open. Please check the URL and try again.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Events
          </Link>
        </div>
      </div>
    )
  }

  // Check if registration is closed
  if (event.registration_open === false) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-lg mx-auto text-center">
          <div className="bg-white rounded-2xl shadow-lg p-8 animate-fade-in-up">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Registration Closed</h1>
            <p className="text-gray-600 mb-6">
              Registration for <span className="font-semibold">{event.name}</span> is currently closed.
              Please check back later or contact the organizers for more information.
            </p>
            {event.contact_email && (
              <p className="text-sm text-gray-500 mb-4">
                Contact: <a href={`mailto:${event.contact_email}`} className="text-emerald-600 hover:underline">{event.contact_email}</a>
              </p>
            )}
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" />
              Browse Other Events
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Progress Indicator */}
      <ProgressIndicator currentStep={currentStep} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-8">
          {/* Hero Banner */}
          <div ref={heroRef} className="relative overflow-hidden rounded-2xl animate-fade-in">
            {event.banner_url ? (
              <img
                src={event.banner_url}
                alt={event.name}
                className="w-full h-64 md:h-80 object-cover hero-parallax"
              />
            ) : (
              <div className="w-full h-64 md:h-80 bg-gradient-primary animate-gradient-shift flex items-center justify-center hero-parallax">
                <span className="text-8xl font-black text-white/20">
                  {event.short_name?.[0] || event.name[0]}
                </span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

            {/* Event Type Badge */}
            <div className="absolute top-4 left-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm bg-white/20 text-white">
                <Sparkles className="w-3 h-3" />
                {event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)}
              </span>
            </div>

            {/* Share Button */}
            <div className="absolute top-4 right-4 relative">
              <button
                className="p-2.5 rounded-full backdrop-blur-sm bg-white/20 text-white hover:bg-white/30 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-95"
                onClick={handleShare}
              >
                <Share2 className="w-5 h-5" />
              </button>
              {shareTooltip && (
                <div className="absolute top-full right-0 mt-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap animate-fade-in">
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
                  className="h-16 w-16 rounded-xl bg-white object-contain shadow-lg border-2 border-white"
                />
              </div>
            )}
          </div>

          {/* Event Title & Info */}
          <div className="animate-fade-in-up">
            <h1 className="text-3xl md:text-4xl font-black mb-4 text-gray-900">
              {event.name}
            </h1>

            {event.tagline && (
              <p className="text-lg mb-6 text-gray-600">
                {event.tagline}
              </p>
            )}

            {/* Quick Info */}
            <div className="bg-white rounded-xl shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-4">
              <div className="flex items-center gap-3 min-h-[44px]">
                <div className="p-2 rounded-lg bg-emerald-50">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {format(new Date(event.start_date), "d MMMM yyyy")}
                    {event.end_date && event.end_date !== event.start_date && (
                      <> - {format(new Date(event.end_date), "d MMMM yyyy")}</>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    Event Date
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 min-h-[44px]">
                <div className="p-2 rounded-lg bg-emerald-50">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {event.venue_name || event.city}
                  </p>
                  <p className="text-xs text-gray-500">
                    {event.city}
                    {event.state && `, ${event.state}`}
                  </p>
                </div>
              </div>

              <a
                href={`/api/events/${event.id}/invitation-pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium mt-1 min-h-[44px]"
              >
                <Download className="w-4 h-4" />
                Download Invitation
              </a>
            </div>
          </div>

          {/* Description */}
          {(event.description || event.welcome_message) && (
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 animate-fade-in-up">
              <h2 className="text-lg font-bold mb-4 text-gray-900">
                About This Event
              </h2>
              <div
                className={`
                  prose prose-sm max-w-none transition-all duration-500
                  ${!showFullDescription && (event.description?.length || 0) > 500 ? "line-clamp-4" : ""}
                `}
              >
                <p className="text-gray-600">
                  {event.description || event.welcome_message}
                </p>
              </div>
              {(event.description?.length || 0) > 500 && (
                <button
                  onClick={() => setShowFullDescription(!showFullDescription)}
                  className="mt-4 text-emerald-600 text-sm font-medium flex items-center gap-1 min-h-[44px]"
                >
                  {showFullDescription ? "Show less" : "Read more"}
                  <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showFullDescription ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          )}

          {/* Contact Info */}
          {(event.contact_email || event.contact_phone || event.website_url) && (
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 animate-fade-in-up">
              <h2 className="text-lg font-bold mb-4 text-gray-900">
                Contact Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                {event.contact_email && (
                  <a
                    href={`mailto:${event.contact_email}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors min-h-[44px]"
                  >
                    <Mail className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm text-gray-900 truncate">
                      {event.contact_email}
                    </span>
                  </a>
                )}
                {event.contact_phone && (
                  <a
                    href={`tel:${event.contact_phone}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors min-h-[44px]"
                  >
                    <Phone className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm text-gray-900">
                      {event.contact_phone}
                    </span>
                  </a>
                )}
                {event.website_url && (
                  <a
                    href={event.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors min-h-[44px]"
                  >
                    <Globe className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm text-gray-900">
                      Visit Website
                    </span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Registration Type Selector (only shown when buyers are allowed) */}
          {allowBuyers && !registrationType && (
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 animate-fade-in-up">
              <RegistrationTypeSelector
                allowBuyers={allowBuyers}
                onSelect={handleRegistrationTypeSelect}
                selectedType={registrationType}
              />
            </div>
          )}

          {/* Ticket Selection - shown after registration type is selected (or immediately if buyers not allowed) */}
          {event.ticket_types && event.ticket_types.length > 0 && (!allowBuyers || registrationType) && (
            <div ref={ticketSectionRef} className="bg-white rounded-xl shadow-sm p-4 sm:p-6 animate-fade-in-up">
              {/* Show selected registration type badge */}
              {allowBuyers && registrationType && (
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                      registrationType === "individual"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {registrationType === "individual" ? "Individual Registration" : "Group Booking"}
                    </span>
                  </div>
                  <button
                    onClick={() => setRegistrationType(null)}
                    className="text-sm text-gray-500 hover:text-gray-700 min-h-[44px] px-2"
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

          {/* Addons Selection - shown after tickets are selected */}
          {addons && addons.length > 0 && totals.count > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 animate-fade-in-up">
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

        {/* Sticky Order Summary */}
        <div className="lg:col-span-1 animate-slide-in-right">
          <div className="bg-white rounded-xl shadow-sm lg:sticky lg:top-24 overflow-hidden transition-shadow duration-300 hover:shadow-md">
            {/* Header */}
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">
                Order Summary
              </h3>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              {/* Early Email Check */}
              <EmailCheckWidget eventId={event.id} />

              {totals.count === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Ticket className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm">
                    Select tickets to continue
                  </p>
                </div>
              ) : (
                <div className="space-y-4 animate-slide-up-fade">
                  {/* Selected Tickets */}
                  {Array.from(selectedTickets.entries()).map(([ticketId, quantity]) => {
                    const ticket = event.ticket_types.find((t) => t.id === ticketId)
                    if (!ticket || quantity === 0) return null
                    return (
                      <div key={ticketId} className="flex justify-between text-sm">
                        <span className="text-gray-500">
                          {ticket.name} x {quantity}
                        </span>
                        <span className="font-medium text-gray-900">
                          {"\u20B9"}{Math.round(ticket.price * (1 + ticket.tax_percentage / 100) * quantity).toLocaleString("en-IN")}
                        </span>
                      </div>
                    )
                  })}

                  {/* Selected Addons */}
                  {selectedAddons.size > 0 && (
                    <>
                      <div className="border-t border-gray-200 pt-2 mt-2">
                        <p className="text-xs font-medium text-gray-500 mb-2">Add-ons</p>
                      </div>
                      {Array.from(selectedAddons.entries()).map(([key, addon]) => {
                        const addonData = addons?.find(a => a.id === addon.addonId)
                        const variant = addonData?.variants?.find(v => v.id === addon.variantId)
                        return (
                          <div key={key} className="flex justify-between text-sm">
                            <span className="text-gray-500">
                              {addonData?.name}
                              {variant && ` (${variant.name})`}
                              {addon.quantity > 1 && ` x ${addon.quantity}`}
                            </span>
                            <span className="font-medium text-gray-900">
                              {"\u20B9"}{addon.totalPrice.toLocaleString()}
                            </span>
                          </div>
                        )
                      })}
                    </>
                  )}

                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-500">Tickets Subtotal</span>
                      <span className="text-gray-900">
                        {"\u20B9"}{Math.round(totals.subtotal).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-500">Tickets GST</span>
                      <span className="text-gray-900">
                        {"\u20B9"}{Math.round(totals.tax).toLocaleString("en-IN")}
                      </span>
                    </div>
                    {totals.addonsTotal > 0 && (
                      <>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-500">Add-ons Subtotal</span>
                          <span className="text-gray-900">
                            {"\u20B9"}{Math.round(totals.addonsTotal).toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-500">Add-ons GST</span>
                          <span className="text-gray-900">
                            {"\u20B9"}{Math.round(totals.addonsTax).toLocaleString("en-IN")}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-4 border-t border-gray-200">
                      <span className="text-gray-900">Total</span>
                      <span key={priceAnimKey} className="text-emerald-600 price-transition changing">{"\u20B9"}{Math.round(totals.total).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="p-5 pt-0">
              <button
                onClick={handleProceedToCheckout}
                disabled={totals.count === 0}
                className={`
                  w-full py-4 rounded-xl font-bold text-white min-h-[52px]
                  flex items-center justify-center gap-2
                  transition-all duration-300
                  ${totals.count === 0
                    ? "bg-gray-300 cursor-not-allowed text-gray-500"
                    : "btn-gradient-animate btn-pulse-glow hover:-translate-y-0.5 active:translate-y-0 active:shadow-md"
                  }
                `}
              >
                Proceed to Checkout
                <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-center text-xs mt-3 text-gray-500">
                Secure payment powered by Razorpay
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Fixed Bottom Checkout Bar */}
      {totals.count > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.1)] p-4 z-40 lg:hidden">
          <div className="flex items-center justify-between gap-4 max-w-lg mx-auto">
            <div>
              <p className="text-sm text-gray-500">{totals.count} ticket{totals.count > 1 ? "s" : ""}</p>
              <p className="text-lg font-bold text-gray-900">{"\u20B9"}{totals.total.toLocaleString()}</p>
            </div>
            <button
              onClick={handleProceedToCheckout}
              className="flex-1 max-w-[200px] py-3.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-2 active:scale-95 transition-all min-h-[48px]"
            >
              Checkout
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom padding to prevent mobile checkout bar from overlapping content */}
      {totals.count > 0 && <div className="h-24 lg:hidden" />}
    </div>
  )
}
