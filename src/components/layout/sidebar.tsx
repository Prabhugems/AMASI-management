"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Calendar,
  GraduationCap,
  UserCheck,
  ChevronDown,
  IdCard,
  FileText,
  Plane,
  Users,
  HelpCircle,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { COMPANY_CONFIG, FEATURES } from "@/lib/config"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { usePermissions } from "@/hooks/use-permissions"

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

interface NavItem {
  name: string
  icon: React.ComponentType<{ className?: string }>
  superAdminOnly?: boolean
  requiresPermission?: string
  children?: { name: string; href: string }[]
}

// Navigation items with access control
// superAdminOnly: true = only visible to super admins (not event-scoped users)
const mainNavItems: NavItem[] = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
    superAdminOnly: true,
    children: [
      { name: "Overview", href: "/" },
    ],
  },
  {
    name: "Events",
    icon: Calendar,
    superAdminOnly: false, // All users can see Events
    children: [
      { name: "All Events", href: "/events" },
      ...(FEATURES.multipleEvents ? [{ name: "Create Event", href: "/events/new" }] : []),
    ],
  },
  ...(FEATURES.membership ? [{
    name: "Members",
    icon: IdCard,
    superAdminOnly: true,
    children: [
      { name: "All Members", href: "/members" },
      { name: "Applications", href: "/members/applications" },
      { name: "Add Member", href: "/members/new" },
      { name: "Import", href: "/members/import" },
    ],
  }] : []) as NavItem[],
  ...(FEATURES.faculty ? [{
    name: "Faculty",
    icon: GraduationCap,
    superAdminOnly: true,
    children: [
      { name: "Directory", href: "/faculty" },
      { name: "Add Faculty", href: "/faculty/new" },
      { name: "Import", href: "/faculty/import" },
      { name: "Reviewers Pool", href: "/reviewers" },
    ],
  }] : []) as NavItem[],
  ...(FEATURES.attendees ? [{
    name: "Attendees",
    icon: UserCheck,
    superAdminOnly: true,
    children: [
      { name: "All Attendees", href: "/delegates" },
      { name: "By Event", href: "/delegates?view=by-event" },
    ],
  }] : []) as NavItem[],
  ...(FEATURES.forms ? [{
    name: "Forms",
    icon: FileText,
    superAdminOnly: true,
    children: [
      { name: "All Forms", href: "/forms" },
    ],
  }] : []) as NavItem[],
  ...(FEATURES.travel ? [{
    name: "Travel",
    icon: Plane,
    superAdminOnly: false,
    requiresPermission: "flights",
    children: [
      { name: "Dashboard", href: "/travel-dashboard" },
    ],
  }] : []) as NavItem[],
  ...(FEATURES.team ? [{
    name: "Team",
    icon: Users,
    superAdminOnly: true,
    children: [
      { name: "All Members", href: "/team" },
      { name: "Audit Log", href: "/audit" },
    ],
  }] : []) as NavItem[],
]

const quickNavItems = [
  { name: "Help", href: "/help", icon: HelpCircle },
]

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const [openMenus, setOpenMenus] = React.useState<string[]>(["Dashboard"])
  const [userMenuOpen, setUserMenuOpen] = React.useState(false)
  const [activePopItem, setActivePopItem] = React.useState<string | null>(null)

  // Get user permissions and info
  const { userName, userEmail, role, isAdmin, isEventScoped, hasFullAccess, isLoading, permissions } = usePermissions()

  // Track pathname changes for pop animation
  const prevPathname = React.useRef(pathname)
  React.useEffect(() => {
    if (prevPathname.current !== pathname) {
      setActivePopItem(pathname)
      prevPathname.current = pathname
      const timer = setTimeout(() => setActivePopItem(null), 300)
      return () => clearTimeout(timer)
    }
  }, [pathname])

  // Filter nav items based on user access
  const filteredNavItems = React.useMemo((): NavItem[] => {
    // Super admins see everything
    if (!isEventScoped && (isAdmin || hasFullAccess)) {
      return mainNavItems
    }

    // Event-scoped users only see allowed items
    return mainNavItems.filter(item => {
      // Hide super admin only items from event-scoped users
      if (item.superAdminOnly && isEventScoped) {
        return false
      }

      // Check permission requirement
      if (item.requiresPermission) {
        // Travel role or specific permission needed
        if (role === "travel" || permissions.includes(item.requiresPermission as "flights" | "hotels" | "transfers" | "trains" | "speakers" | "program" | "checkin" | "badges" | "certificates" | "registrations" | "abstracts")) {
          return true
        }
        return false
      }

      return true
    })
  }, [isEventScoped, isAdmin, hasFullAccess, role, permissions])

  // Get initials from name
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  // Get role label
  const getRoleLabel = () => {
    if (isAdmin && !isEventScoped) return "Super Admin"
    if (hasFullAccess && !isEventScoped) return "Full Access"
    if (isEventScoped) return "Event Team"
    if (role === "travel") return "Travel Coord."
    if (role === "coordinator") return "Coordinator"
    return role || "User"
  }

  const toggleMenu = (name: string) => {
    setOpenMenus((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]
    )
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
        className={cn(
          "fixed left-0 top-0 z-50 h-screen bg-sidebar flex flex-col sidebar-glass sidebar-border-gradient sidebar-inner-shadow",
          "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          collapsed ? "lg:w-[72px]" : "lg:w-64",
          // Mobile: hidden by default, slide in when open
          mobileOpen ? "w-64 translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
      {/* Logo / Brand Area */}
      <div className="flex h-16 items-center px-4 brand-accent-line">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-3 group transition-all duration-200",
            collapsed && "justify-center w-full"
          )}
        >
          <div className={cn(
            "flex items-center justify-center rounded-xl bg-gradient-to-br from-white/15 to-white/5 transition-all duration-300",
            "group-hover:from-white/20 group-hover:to-white/10 group-hover:shadow-lg group-hover:shadow-white/5",
            collapsed ? "h-10 w-10" : "h-10 w-10"
          )}>
            <span className="text-lg font-bold text-white">{COMPANY_CONFIG.name.charAt(0)}</span>
          </div>
          <span className={cn(
            "text-lg font-semibold text-sidebar-foreground transition-all duration-300 whitespace-nowrap overflow-hidden",
            collapsed ? "opacity-0 max-w-0" : "opacity-100 max-w-[180px]"
          )}>
            {COMPANY_CONFIG.name}
          </span>
        </Link>
      </div>

      {/* User Profile */}
      <div className={cn(
        "p-4 border-b border-sidebar-border/50 transition-all duration-300",
        collapsed && "px-3 py-3"
      )}>
        <div
          className={cn(
            "flex items-center gap-3 cursor-pointer rounded-xl p-2 -m-2 transition-all duration-200",
            "hover:bg-white/5",
            collapsed && "justify-center p-1 -m-1"
          )}
          onClick={() => !collapsed && setUserMenuOpen(!userMenuOpen)}
        >
          <Avatar className={cn(
            "h-10 w-10 border-2 border-white/10 avatar-hover-ring flex-shrink-0",
            collapsed && "h-9 w-9"
          )}>
            <AvatarFallback className="bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 text-white text-sm font-medium">
              {isLoading ? "..." : getInitials(userName || userEmail || "U")}
            </AvatarFallback>
          </Avatar>
          <div className={cn(
            "flex-1 min-w-0 transition-all duration-300 overflow-hidden",
            collapsed ? "opacity-0 max-w-0" : "opacity-100 max-w-full"
          )}>
            {isLoading ? (
              <div className="space-y-1.5">
                <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
                <div className="h-3 w-16 bg-white/10 rounded animate-pulse" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-sidebar-foreground truncate">
                    {userName || userEmail?.split("@")[0] || "User"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 text-sidebar-muted chevron-rotate flex-shrink-0",
                      userMenuOpen && "open"
                    )}
                  />
                </div>
                <span className="text-xs text-sidebar-muted/70 truncate block mt-0.5">{getRoleLabel()}</span>
              </>
            )}
          </div>
        </div>
        {/* User submenu */}
        {!collapsed && userMenuOpen && (
          <div className="mt-3 space-y-1 pl-14 submenu-enter">
            <p className="text-xs text-sidebar-muted/50 truncate mb-2">{userEmail}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-thin">
        <div className="space-y-1">
          {filteredNavItems.map((item) => {
            const isOpen = openMenus.includes(item.name)
            const isActive = item.children?.some((child) => pathname === child.href)

            return (
              <div key={item.name}>
                {/* Section parent button */}
                <button
                  onClick={() => !collapsed && toggleMenu(item.name)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 nav-item-hover",
                    isActive
                      ? "bg-sidebar-primary/15 text-sidebar-foreground font-semibold"
                      : "text-sidebar-muted hover:text-sidebar-foreground",
                    collapsed && "sidebar-tooltip justify-center px-2"
                  )}
                >
                  <div className="icon-glow-hover flex-shrink-0">
                    <item.icon className={cn(
                      "h-[18px] w-[18px] sidebar-icon-hover",
                      isActive && "text-sidebar-primary"
                    )} />
                  </div>
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.name}</span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 text-sidebar-muted/60 chevron-rotate",
                          isOpen && "open"
                        )}
                      />
                    </>
                  )}
                  {collapsed && (
                    <span className="sidebar-tooltip-text">{item.name}</span>
                  )}
                </button>
                {/* Submenu */}
                {!collapsed && isOpen && item.children && (
                  <div className="mt-1 ml-3 submenu-enter submenu-connector">
                    <div className="space-y-0.5 pl-4">
                      {item.children.map((child) => {
                        const childActive = pathname === child.href
                        const shouldPop = activePopItem === child.href
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onMobileClose}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200",
                              childActive
                                ? "bg-sidebar-primary text-white font-medium shadow-md shadow-sidebar-primary/20"
                                : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-white/5",
                              shouldPop && "nav-pop"
                            )}
                          >
                            <span className={cn(
                              "flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold transition-all duration-200",
                              childActive
                                ? "bg-white/20 text-white"
                                : "bg-sidebar-accent/50 text-sidebar-muted"
                            )}>
                              {child.name.charAt(0)}
                            </span>
                            <span>{child.name}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Quick Links */}
        <div className="mt-6 pt-4 sidebar-gradient-separator">
          <p className={cn(
            "text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted/40 mb-2 transition-all duration-300",
            collapsed ? "text-center" : "px-3"
          )}>
            {collapsed ? "..." : "Quick Links"}
          </p>
          <div className="space-y-0.5">
            {quickNavItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onMobileClose}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 nav-item-hover",
                    isActive
                      ? "bg-sidebar-primary text-white font-medium shadow-md shadow-sidebar-primary/20"
                      : "text-sidebar-muted hover:text-sidebar-foreground",
                    collapsed && "sidebar-tooltip justify-center px-2"
                  )}
                >
                  <div className="icon-glow-hover flex-shrink-0">
                    <item.icon className="h-[18px] w-[18px] sidebar-icon-hover" />
                  </div>
                  {!collapsed && <span>{item.name}</span>}
                  {collapsed && (
                    <span className="sidebar-tooltip-text">{item.name}</span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Collapse Toggle Footer */}
      <div className="p-3 sidebar-gradient-separator">
        <button
          onClick={onToggle}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm collapse-btn",
            "text-sidebar-muted hover:text-sidebar-foreground",
            "bg-white/[0.03] hover:bg-white/[0.06]",
            "border border-white/[0.04]"
          )}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" />
              <span className="text-xs font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
    </>
  )
}
