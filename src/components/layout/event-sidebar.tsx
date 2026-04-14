"use client"

import { useEffect, useState, useRef } from "react"
import { usePathname, useParams, useRouter } from "next/navigation"
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
  BarChart3,
  TrendingUp,
  UserPlus,
  ListOrdered,
  UtensilsCrossed,
  Stamp,
  IndianRupee,
  ClipboardList,
  GraduationCap,
  ScrollText,
  HelpCircle,
  LogOut,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { usePermissions } from "@/hooks/use-permissions"
import { toast } from "sonner"

const COLLAPSED_WIDTH = 64
const EXPANDED_WIDTH = 260

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  statusKey?: string // Key to check in setupStatus
  moduleKey?: string // Key to check in moduleSettings for conditional display
  sectionStart?: string // If set, renders a section separator/header before this item
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
  enable_examination: boolean
  enable_speakers: boolean
  enable_program: boolean
  enable_checkin: boolean
  enable_badges: boolean
  enable_certificates: boolean
  enable_travel: boolean
  enable_accommodation: boolean
  enable_meals: boolean
  enable_sponsors: boolean
  enable_budget: boolean
  enable_visa: boolean
  enable_surveys: boolean
  enable_delegate_portal: boolean
  enable_print_station: boolean
  enable_leads: boolean
  enable_waitlist: boolean
  enable_addons: boolean
  enable_forms: boolean
  enable_convocation: boolean
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "", icon: LayoutDashboard },
  { label: "Tickets", href: "/tickets", icon: Ticket, statusKey: "tickets", sectionStart: "Registration" },
  { label: "Addons", href: "/addons", icon: Package, moduleKey: "enable_addons" },
  { label: "Orders", href: "/orders", icon: ShoppingCart },
  { label: "Attendees", href: "/registrations", icon: UserCheck },
  { label: "Waitlist", href: "/waitlist", icon: ListOrdered, moduleKey: "enable_waitlist" },
  { label: "Forms", href: "/forms", icon: FileText, moduleKey: "enable_forms" },
  { label: "Abstracts", href: "/abstracts", icon: BookOpen, statusKey: "abstracts", moduleKey: "enable_abstracts", sectionStart: "Content" },
  { label: "Examination", href: "/examination", icon: GraduationCap, moduleKey: "enable_examination" },
  { label: "Convocation", href: "/convocation-process", icon: ScrollText, moduleKey: "enable_convocation" },
  { label: "Speakers", href: "/speakers", icon: Mic, moduleKey: "enable_speakers" },
  { label: "Program", href: "/program", icon: Calendar, moduleKey: "enable_program" },
  { label: "Checkin Hub", href: "/checkin", icon: QrCode, moduleKey: "enable_checkin", sectionStart: "On-site" },
  { label: "Print Station", href: "/print-stations", icon: Printer, moduleKey: "enable_print_station" },
  { label: "Badges", href: "/badges", icon: BadgeCheck, statusKey: "badges", moduleKey: "enable_badges" },
  { label: "Certificates", href: "/certificates", icon: Award, statusKey: "certificates", moduleKey: "enable_certificates" },
  { label: "Delegate Portal", href: "/delegate-portal", icon: BarChart3, moduleKey: "enable_delegate_portal" },
  { label: "Surveys", href: "/surveys", icon: ClipboardList, moduleKey: "enable_surveys" },
  { label: "Travel", href: "/travel", icon: Plane, moduleKey: "enable_travel", sectionStart: "Logistics" },
  { label: "Accommodation", href: "/accommodation", icon: Hotel, moduleKey: "enable_accommodation" },
  { label: "Meals", href: "/meals", icon: UtensilsCrossed, moduleKey: "enable_meals" },
  { label: "Visa Letters", href: "/visa", icon: Stamp, moduleKey: "enable_visa" },
  { label: "Sponsors", href: "/sponsors", icon: Building2, moduleKey: "enable_sponsors" },
  { label: "Budget", href: "/budget", icon: IndianRupee, moduleKey: "enable_budget" },
  { label: "Team", href: "/team", icon: Users, sectionStart: "Admin" },
  { label: "Communications", href: "/communications", icon: MessageSquare, statusKey: "communications" },
  { label: "Email Templates", href: "/emails", icon: Mail },
  { label: "Analytics", href: "/analytics", icon: TrendingUp },
  { label: "Leads", href: "/leads", icon: UserPlus, moduleKey: "enable_leads" },
  { label: "Activity Log", href: "/activity", icon: Activity },
  { label: "Payment Settings", href: "/payment-settings", icon: Wallet },
  { label: "Settings", href: "/settings", icon: Settings },
]

export function EventSidebar({ onNavigate, mobileOpen, onMobileClose }: { onNavigate?: () => void; mobileOpen?: boolean; onMobileClose?: () => void } = {}) {
  const pathname = usePathname()
  const params = useParams()
  const eventId = params.eventId as string
  const sidebarRef = useRef<HTMLElement>(null)

  const supabase = createClient()

  const router = useRouter()

  // User profile
  const { userName, userEmail, isAdmin, hasFullAccess, isEventScoped, role, isLoading: isUserLoading } = usePermissions()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getRoleLabel = () => {
    if (isAdmin && !isEventScoped) return "Super Admin"
    if (hasFullAccess && !isEventScoped) return "Full Access"
    if (isEventScoped) return "Event Team"
    if (role === "travel") return "Travel Coord."
    if (role === "coordinator") return "Coordinator"
    return role || "User"
  }

  // Hover and pinned state
  const [isHovered, setIsHovered] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [activePopItem, setActivePopItem] = useState<string | null>(null)

  // Track pathname changes for pop animation
  const prevPathname = useRef(pathname)
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      setActivePopItem(pathname)
      prevPathname.current = pathname
      const timer = setTimeout(() => setActivePopItem(null), 300)
      return () => clearTimeout(timer)
    }
  }, [pathname])

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
        .maybeSingle()
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
  const MODULE_FIELDS = "enable_abstracts, enable_examination, enable_speakers, enable_program, enable_checkin, enable_badges, enable_certificates, enable_travel, enable_accommodation, enable_meals, enable_sponsors, enable_budget, enable_visa, enable_surveys, enable_delegate_portal, enable_print_station, enable_leads, enable_waitlist, enable_addons, enable_forms"

  const { data: moduleSettings, refetch: refetchModules } = useQuery({
    queryKey: ["event-module-settings", eventId],
    queryFn: async (): Promise<ModuleSettings> => {
      const { data } = await supabase
        .from("event_settings")
        .select(MODULE_FIELDS)
        .eq("event_id", eventId)
        .maybeSingle()

      const s = data as Partial<ModuleSettings> | null
      return {
        // These default to false (opt-in)
        enable_abstracts: s?.enable_abstracts ?? false,
        enable_examination: s?.enable_examination ?? false,
        // These default to true (opt-out) so existing events keep their sidebar
        enable_speakers: s?.enable_speakers ?? true,
        enable_program: s?.enable_program ?? true,
        enable_checkin: s?.enable_checkin ?? true,
        enable_badges: s?.enable_badges ?? true,
        enable_certificates: s?.enable_certificates ?? true,
        enable_travel: s?.enable_travel ?? true,
        enable_accommodation: s?.enable_accommodation ?? true,
        enable_meals: s?.enable_meals ?? true,
        enable_sponsors: s?.enable_sponsors ?? true,
        enable_budget: s?.enable_budget ?? true,
        enable_visa: s?.enable_visa ?? true,
        enable_surveys: s?.enable_surveys ?? true,
        enable_delegate_portal: s?.enable_delegate_portal ?? true,
        enable_print_station: s?.enable_print_station ?? true,
        enable_leads: s?.enable_leads ?? true,
        enable_waitlist: s?.enable_waitlist ?? true,
        enable_addons: s?.enable_addons ?? true,
        enable_forms: s?.enable_forms ?? true,
        enable_convocation: s?.enable_convocation ?? false,
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
  const isExpanded = isHovered || isPinned || !!mobileOpen

  const isItemActive = (item: NavItem) => {
    const href = `${basePath}${item.href}`
    if (item.href === "") {
      return pathname === basePath
    }
    return pathname === href || pathname.startsWith(href + "/")
  }

  const handleNavigate = () => {
    onNavigate?.()
    onMobileClose?.()
  }

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={onMobileClose}
        />
      )}
    <aside
      ref={sidebarRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
      className={cn(
        "fixed left-0 top-0 z-50 h-screen bg-sidebar flex flex-col event-sidebar print:hidden",
        "sidebar-glass sidebar-border-gradient sidebar-inner-shadow",
        "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        isExpanded && "shadow-2xl shadow-black/20",
        // Mobile: hidden by default, slide in when open
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
    >
      {/* Back Button & Pin Toggle */}
      <div className={cn(
        "flex items-center brand-accent-line",
        isExpanded ? "px-4 py-3 justify-between" : "px-2 py-3 justify-center"
      )}>
        <Link
          href="/events"
          className={cn(
            "flex items-center gap-2 text-sm text-sidebar-muted hover:text-sidebar-foreground transition-all duration-200 rounded-lg px-2 py-1.5 -mx-2 hover:bg-white/5",
            !isExpanded && "justify-center mx-0 px-1.5"
          )}
          title="Back to Events"
        >
          <ArrowLeft className="h-4 w-4 flex-shrink-0 sidebar-icon-hover" />
          {isExpanded && <span>Back to Events</span>}
        </Link>
        {isExpanded && (
          <button
            onClick={togglePin}
            className={cn(
              "p-1.5 rounded-lg transition-all duration-200",
              isPinned
                ? "bg-primary/20 text-primary hover:bg-primary/30 shadow-sm shadow-primary/10"
                : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-white/5"
            )}
            title={isPinned ? "Unpin sidebar" : "Pin sidebar"}
          >
            {isPinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Event Info */}
      <div className={cn(
        "border-b border-sidebar-border/50 transition-all duration-300",
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
                "rounded-xl object-contain bg-white flex-shrink-0 transition-all duration-300",
                "ring-2 ring-white/10 hover:ring-white/20",
                isExpanded ? "h-10 w-10" : "h-9 w-9"
              )}
              title={event.name}
            />
          ) : (
            <div
              className={cn(
                "rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0 transition-all duration-300",
                "ring-2 ring-white/10 shadow-lg shadow-primary/20",
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
                  event?.status === "ongoing" ? "bg-green-500 notification-pulse" :
                  event?.status === "planning" ? "bg-yellow-500" :
                  event?.status === "completed" ? "bg-blue-500" :
                  "bg-gray-400"
                )}
              />
              <h2 className="font-semibold text-sidebar-foreground truncate text-sm">
                {event?.short_name || event?.name || "Loading..."}
              </h2>
            </div>
            <p className="text-xs text-sidebar-muted/70 mt-0.5 capitalize truncate">
              {event?.event_type || "Event"} {event?.city ? `\u2022 ${event.city}` : ""}
            </p>
            {event?.start_date && (
              <p className="text-xs text-sidebar-muted/50 mt-0.5">
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
        {visibleNavItems.map((item, index) => {
          const isActive = isItemActive(item)
          const href = `${basePath}${item.href}`
          // Check if this item needs attention (has statusKey and status is false)
          const needsAttention = item.statusKey && setupStatus && !setupStatus[item.statusKey as keyof SetupStatus]
          const shouldPop = activePopItem === href

          return (
            <div key={item.href || "dashboard"}>
              {/* Section separator with label */}
              {item.sectionStart && index > 0 && (
                <div className={cn(
                  "sidebar-section-separator",
                  isExpanded ? "px-3" : "px-1"
                )}>
                  {isExpanded && (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-sidebar-muted/40">
                      {item.sectionStart}
                    </span>
                  )}
                </div>
              )}
            <Link
              href={href}
              onClick={handleNavigate}
              title={!isExpanded ? (needsAttention ? `${item.label} - Needs setup` : item.label) : undefined}
              className={cn(
                "flex items-center rounded-xl transition-all duration-200 group relative",
                isExpanded ? "gap-3 px-3 py-2" : "justify-center p-2.5",
                isActive
                  ? "bg-primary text-white shadow-md shadow-primary/25 font-medium"
                  : "text-sidebar-muted hover:text-sidebar-foreground nav-item-hover",
                shouldPop && "nav-pop"
              )}
            >
              <div className={cn(
                "relative flex-shrink-0",
                !isActive && "icon-glow-hover"
              )}>
                <item.icon className={cn(
                  "h-[18px] w-[18px] transition-all duration-200",
                  !isActive && "sidebar-icon-hover"
                )} />
                {/* Warning indicator dot */}
                {needsAttention && !isActive && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-sidebar notification-pulse" />
                )}
              </div>

              {/* Label with smooth transition */}
              <span className={cn(
                "text-sm whitespace-nowrap overflow-hidden transition-all duration-300 flex-1",
                isExpanded ? "opacity-100 max-w-full" : "opacity-0 max-w-0 absolute"
              )}>
                {item.label}
              </span>

              {/* Needs setup indicator when expanded */}
              {needsAttention && isExpanded && !isActive && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 font-medium border border-amber-500/20">
                  Setup
                </span>
              )}

              {/* Active indicator line for collapsed state */}
              {isActive && !isExpanded && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white rounded-r" />
              )}
            </Link>
            </div>
          )
        })}
      </nav>

      {/* User Profile Footer */}
      <div className="sidebar-gradient-separator">
        <div className={cn(
          "relative",
          isExpanded ? "px-3 pt-3" : "px-2 pt-2"
        )}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl p-2 transition-all duration-200",
              "hover:bg-white/[0.08]",
              userMenuOpen && "bg-white/[0.08]",
              !isExpanded && "justify-center p-2"
            )}
          >
            <Avatar className={cn(
              "h-9 w-9 border-2 border-white/10 flex-shrink-0",
              !isExpanded && "h-8 w-8"
            )}>
              <AvatarFallback className="bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 text-white text-xs font-medium">
                {isUserLoading ? "..." : getInitials(userName || userEmail || "U")}
              </AvatarFallback>
            </Avatar>
            {isExpanded && (
              <div className="flex-1 min-w-0 text-left">
                {isUserLoading ? (
                  <div className="space-y-1">
                    <div className="h-3.5 w-20 bg-white/10 rounded animate-pulse" />
                    <div className="h-3 w-14 bg-white/10 rounded animate-pulse" />
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-sidebar-foreground truncate leading-tight">
                      {userName || userEmail?.split("@")[0] || "User"}
                    </p>
                    <p className="text-[11px] text-sidebar-muted/60 truncate leading-tight mt-0.5">{getRoleLabel()}</p>
                  </>
                )}
              </div>
            )}
            {isExpanded && (
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-sidebar-muted/60 flex-shrink-0 transition-transform duration-200",
                  userMenuOpen && "rotate-180"
                )}
              />
            )}
          </button>

          {/* User Popover Menu */}
          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className={cn(
                "absolute z-50 w-56 rounded-xl border border-white/10 bg-sidebar shadow-2xl shadow-black/40 overflow-hidden",
                !isExpanded
                  ? "left-full bottom-0 ml-2"
                  : "left-3 right-3 bottom-full mb-2 w-auto"
              )}>
                {/* Email */}
                <div className="px-3 py-2.5 border-b border-white/[0.06]">
                  <p className="text-xs text-sidebar-muted/50 truncate">{userEmail}</p>
                </div>
                {/* Menu Items */}
                <div className="p-1.5">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false)
                      router.push("/help")
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-sidebar-muted hover:text-sidebar-foreground hover:bg-white/[0.06] transition-colors"
                  >
                    <HelpCircle className="h-4 w-4 flex-shrink-0" />
                    <span>Help & Support</span>
                  </button>
                </div>
                {/* Sign Out */}
                <div className="p-1.5 border-t border-white/[0.06]">
                  <button
                    onClick={async () => {
                      setUserMenuOpen(false)
                      try {
                        await fetch("/api/track-logout", { method: "POST" }).catch(() => {})
                        const authClient = createClient()
                        await authClient.auth.signOut()
                        toast.success("Signed out successfully")
                        router.push("/login")
                      } catch {
                        toast.error("Failed to sign out")
                      }
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="h-4 w-4 flex-shrink-0" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Event Status */}
        <div className={cn(
          "transition-all duration-300",
          isExpanded ? "px-4 py-2 pb-3" : "px-2 py-2 pb-3"
        )}>
          {isExpanded ? (
            <div className="flex items-center justify-between text-xs">
              <span className="text-sidebar-muted/60 text-[11px] font-medium">Status</span>
              <span
                className={cn(
                  "px-2.5 py-1 rounded-full text-[10px] font-semibold capitalize tracking-wide",
                  event?.status === "ongoing" ? "bg-green-500/15 text-green-400 ring-1 ring-green-500/20" :
                  event?.status === "planning" ? "bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/20" :
                  event?.status === "completed" ? "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/20" :
                  "bg-gray-500/15 text-gray-400 ring-1 ring-gray-500/20"
                )}
              >
                {event?.status || "Draft"}
              </span>
            </div>
          ) : (
            <div className="flex justify-center">
              <div
                className={cn(
                  "w-2.5 h-2.5 rounded-full transition-all duration-300",
                  event?.status === "ongoing" ? "bg-green-500 notification-pulse" :
                  event?.status === "planning" ? "bg-yellow-500" :
                  event?.status === "completed" ? "bg-blue-500" :
                  "bg-gray-400"
                )}
                title={event?.status || "Draft"}
              />
            </div>
          )}
        </div>
      </div>
    </aside>
    </>
  )
}
