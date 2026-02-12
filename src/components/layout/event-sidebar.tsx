"use client"

import { useEffect, useState, useRef } from "react"
import { usePathname, useParams } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import {
  LayoutDashboard,
  UserCheck,
  Ticket,
  ShoppingCart,
  Calendar,
  Plane,
  Hotel,
  QrCode,
  Award,
  Wallet,
  Building2,
  Users,
  MessageSquare,
  Settings,
  ArrowLeft,
  BadgeCheck,
  FileText,
  Printer,
  LucideIcon,
  Mic,
  Package,
  Mail,
  Activity,
  Pin,
  PinOff,
  BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"

const COLLAPSED_WIDTH = 64
const EXPANDED_WIDTH = 260

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  statusKey?: string // Key to check in setupStatus
  moduleKey?: string // Key to check in moduleSettings for conditional display
}

type EventData = {
  id: string
  name: string
  short_name: string | null
  status: string
  city: string | null
  event_type: string
  start_date: string
  end_date: string
  logo_url: string | null
}

type SetupStatus = {
  tickets: boolean // true = has active tickets
  badges: boolean // true = has default badge template
  certificates: boolean // true = has certificate template
  communications: boolean // true = has message templates
  abstracts: boolean // true = has abstract categories configured
}

type ModuleSettings = {
  enable_abstracts: boolean
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "", icon: LayoutDashboard },
  { label: "Tickets", href: "/tickets", icon: Ticket, statusKey: "tickets" },
  { label: "Addons", href: "/addons", icon: Package },
  { label: "Orders", href: "/orders", icon: ShoppingCart },
  { label: "Attendees", href: "/registrations", icon: UserCheck },
  { label: "Forms", href: "/forms", icon: FileText },
  { label: "Abstracts", href: "/abstracts", icon: BookOpen, statusKey: "abstracts", moduleKey: "enable_abstracts" },
  { label: "Speakers", href: "/speakers", icon: Mic },
  { label: "Program", href: "/program", icon: Calendar },
  { label: "Checkin Hub", href: "/checkin", icon: QrCode },
  { label: "Print Station", href: "/print-stations", icon: Printer },
  { label: "Badges", href: "/badges", icon: BadgeCheck, statusKey: "badges" },
  { label: "Certificates", href: "/certificates", icon: Award, statusKey: "certificates" },
  { label: "Travel", href: "/travel", icon: Plane },
  { label: "Accommodation", href: "/accommodation", icon: Hotel },
  { label: "Sponsors", href: "/sponsors", icon: Building2 },
  { label: "Team", href: "/team", icon: Users },
  { label: "Communications", href: "/communications", icon: MessageSquare, statusKey: "communications" },
  { label: "Email Templates", href: "/emails", icon: Mail },
  { label: "Activity Log", href: "/activity", icon: Activity },
  { label: "Payment Settings", href: "/payment-settings", icon: Wallet },
  { label: "Settings", href: "/settings", icon: Settings },
]

export function EventSidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname()
  const params = useParams()
  const eventId = params.eventId as string
  const sidebarRef = useRef<HTMLElement>(null)

  const supabase = createClient()

  // Hover and pinned state
  const [isHovered, setIsHovered] = useState(false)
  const [isPinned, setIsPinned] = useState(false)

  // Load pinned state from localStorage
  useEffect(() => {
    const savedPinned = localStorage.getItem("event-sidebar-pinned")
    if (savedPinned === "true") {
      setIsPinned(true)
    }
  }, [])

  const togglePin = () => {
    const newPinned = !isPinned
    setIsPinned(newPinned)
    localStorage.setItem("event-sidebar-pinned", newPinned.toString())
  }

  // Listen for settings save to refetch
  const { data: event, refetch } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, short_name, status, city, event_type, start_date, end_date, logo_url")
        .eq("id", eventId)
        .single()
      return data as EventData | null
    },
    enabled: !!eventId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    gcTime: 0,
  })

  // Fetch setup status for sidebar indicators
  const { data: setupStatus } = useQuery({
    queryKey: ["event-setup-status", eventId],
    queryFn: async (): Promise<SetupStatus> => {
      const [
        activeTicketsResult,
        badgeTemplatesResult,
        certificateTemplatesResult,
        messageTemplatesResult,
        abstractCategoriesResult,
      ] = await Promise.all([
        // Check for active (on sale) tickets
        supabase
          .from("ticket_types")
          .select("*", { count: "exact", head: true })
          .eq("event_id", eventId)
          .eq("status", "active"),
        // Check for default badge template
        supabase
          .from("badge_templates")
          .select("*", { count: "exact", head: true })
          .eq("event_id", eventId)
          .eq("is_default", true),
        // Check for certificate templates
        supabase
          .from("certificate_templates")
          .select("*", { count: "exact", head: true })
          .eq("event_id", eventId),
        // Check for message templates
        supabase
          .from("message_templates")
          .select("*", { count: "exact", head: true })
          .eq("event_id", eventId),
        // Check for abstract categories
        supabase
          .from("abstract_categories")
          .select("*", { count: "exact", head: true })
          .eq("event_id", eventId)
          .eq("is_active", true),
      ])

      return {
        tickets: (activeTicketsResult.count || 0) > 0,
        badges: (badgeTemplatesResult.count || 0) > 0,
        certificates: (certificateTemplatesResult.count || 0) > 0,
        communications: (messageTemplatesResult.count || 0) > 0,
        abstracts: (abstractCategoriesResult.count || 0) > 0,
      }
    },
    enabled: !!eventId,
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: true,
  })

  // Fetch module settings for conditional nav display
  const { data: moduleSettings, refetch: refetchModules } = useQuery({
    queryKey: ["event-module-settings", eventId],
    queryFn: async (): Promise<ModuleSettings> => {
      const { data } = await supabase
        .from("event_settings")
        .select("enable_abstracts")
        .eq("event_id", eventId)
        .maybeSingle()

      const settings = data as { enable_abstracts?: boolean } | null
      return {
        enable_abstracts: settings?.enable_abstracts ?? false,
      }
    },
    enabled: !!eventId,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    const handleEventUpdate = () => {
      refetch()
      refetchModules()
    }
    window.addEventListener("event-settings-saved", handleEventUpdate)
    return () => window.removeEventListener("event-settings-saved", handleEventUpdate)
  }, [refetch, refetchModules])

  // Filter nav items based on module settings
  const visibleNavItems = navItems.filter((item) => {
    if (!item.moduleKey) return true
    if (!moduleSettings) return false
    return moduleSettings[item.moduleKey as keyof ModuleSettings] === true
  })

  const basePath = `/events/${eventId}`
  const isExpanded = isHovered || isPinned

  const isItemActive = (item: NavItem) => {
    const href = `${basePath}${item.href}`
    if (item.href === "") {
      return pathname === basePath
    }
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <aside
      ref={sidebarRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar flex flex-col event-sidebar print:hidden",
        "transition-all duration-300 ease-in-out",
        isExpanded && "shadow-2xl"
      )}
    >
      {/* Back Button & Pin Toggle */}
      <div className={cn(
        "flex items-center border-b border-sidebar-border",
        isExpanded ? "px-4 py-3 justify-between" : "px-2 py-3 justify-center"
      )}>
        <Link
          href="/events"
          className={cn(
            "flex items-center gap-2 text-sm text-sidebar-muted hover:text-sidebar-foreground transition-colors",
            !isExpanded && "justify-center"
          )}
          title="Back to Events"
        >
          <ArrowLeft className="h-4 w-4 flex-shrink-0" />
          {isExpanded && <span>Back to Events</span>}
        </Link>
        {isExpanded && (
          <button
            onClick={togglePin}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              isPinned
                ? "bg-primary/20 text-primary hover:bg-primary/30"
                : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
            )}
            title={isPinned ? "Unpin sidebar" : "Pin sidebar"}
          >
            {isPinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Event Info */}
      <div className={cn(
        "border-b border-sidebar-border transition-all duration-300",
        isExpanded ? "px-4 py-4" : "px-2 py-3"
      )}>
        <div className={cn(
          "flex items-center",
          isExpanded ? "gap-3" : "justify-center"
        )}>
          {/* Logo or Initial */}
          {event?.logo_url ? (
            <img
              src={event.logo_url}
              alt={event.name || "Event logo"}
              className={cn(
                "rounded-lg object-contain bg-white flex-shrink-0 transition-all duration-300",
                isExpanded ? "h-10 w-10" : "h-9 w-9"
              )}
              title={event.name}
            />
          ) : (
            <div
              className={cn(
                "rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0 transition-all duration-300",
                isExpanded ? "h-10 w-10" : "h-9 w-9"
              )}
              title={event?.name}
            >
              <span className={cn(
                "font-bold text-white",
                isExpanded ? "text-lg" : "text-base"
              )}>
                {(event?.short_name || event?.name || "E")[0].toUpperCase()}
              </span>
            </div>
          )}

          {/* Event Details - Only when expanded */}
          <div className={cn(
            "min-w-0 flex-1 overflow-hidden transition-all duration-300",
            isExpanded ? "opacity-100 max-w-full" : "opacity-0 max-w-0"
          )}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-2 w-2 rounded-full flex-shrink-0",
                  event?.status === "ongoing" ? "bg-green-500" :
                  event?.status === "planning" ? "bg-yellow-500" :
                  event?.status === "completed" ? "bg-blue-500" :
                  "bg-gray-400"
                )}
              />
              <h2 className="font-semibold text-sidebar-foreground truncate text-sm">
                {event?.short_name || event?.name || "Loading..."}
              </h2>
            </div>
            <p className="text-xs text-sidebar-muted mt-0.5 capitalize truncate">
              {event?.event_type || "Event"} {event?.city ? `• ${event.city}` : ""}
            </p>
            {event?.start_date && (
              <p className="text-xs text-sidebar-muted">
                {new Date(event.start_date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className={cn(
        "flex-1 py-3 space-y-0.5 overflow-y-auto scrollbar-thin transition-all duration-300",
        isExpanded ? "px-3" : "px-2"
      )}>
        {visibleNavItems.map((item) => {
          const isActive = isItemActive(item)
          const href = `${basePath}${item.href}`
          // Check if this item needs attention (has statusKey and status is false)
          const needsAttention = item.statusKey && setupStatus && !setupStatus[item.statusKey as keyof SetupStatus]

          return (
            <Link
              key={item.href || "dashboard"}
              href={href}
              onClick={onNavigate}
              title={!isExpanded ? (needsAttention ? `${item.label} - Needs setup` : item.label) : undefined}
              className={cn(
                "flex items-center rounded-lg transition-all duration-200 group relative",
                isExpanded ? "gap-3 px-3 py-2.5" : "justify-center p-2.5",
                isActive
                  ? "bg-primary text-white"
                  : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <div className="relative flex-shrink-0">
                <item.icon className={cn(
                  "transition-transform duration-200",
                  isExpanded ? "h-5 w-5" : "h-5 w-5",
                  !isActive && "group-hover:scale-110"
                )} />
                {/* Warning indicator dot */}
                {needsAttention && !isActive && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-sidebar" />
                )}
              </div>

              {/* Label with smooth transition */}
              <span className={cn(
                "text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 flex-1",
                isExpanded ? "opacity-100 max-w-full" : "opacity-0 max-w-0 absolute"
              )}>
                {item.label}
              </span>

              {/* Needs setup indicator when expanded */}
              {needsAttention && isExpanded && !isActive && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">
                  Setup
                </span>
              )}

              {/* Active indicator line */}
              {isActive && !isExpanded && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-white rounded-r" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Status Footer */}
      <div className={cn(
        "border-t border-sidebar-border transition-all duration-300",
        isExpanded ? "p-4" : "p-2"
      )}>
        {isExpanded ? (
          <div className="flex items-center justify-between text-xs">
            <span className="text-sidebar-muted">Status</span>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-medium capitalize",
                event?.status === "ongoing" ? "bg-green-500/20 text-green-400" :
                event?.status === "planning" ? "bg-yellow-500/20 text-yellow-400" :
                event?.status === "completed" ? "bg-blue-500/20 text-blue-400" :
                "bg-gray-500/20 text-gray-400"
              )}
            >
              {event?.status || "Draft"}
            </span>
          </div>
        ) : (
          <div className="flex justify-center">
            <div
              className={cn(
                "w-2.5 h-2.5 rounded-full",
                event?.status === "ongoing" ? "bg-green-500" :
                event?.status === "planning" ? "bg-yellow-500" :
                event?.status === "completed" ? "bg-blue-500" :
                "bg-gray-400"
              )}
              title={event?.status || "Draft"}
            />
          </div>
        )}
      </div>
    </aside>
  )
}
