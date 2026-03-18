"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Calendar,
  GraduationCap,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  IdCard,
  FileText,
  Plane,
  Users,
  HelpCircle,
  Shield,
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

  // Get user permissions and info
  const { userName, userEmail, role, isAdmin, isEventScoped, hasFullAccess, isLoading, permissions } = usePermissions()

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
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen bg-sidebar transition-all duration-300 ease-in-out flex flex-col",
          collapsed ? "lg:w-20" : "lg:w-64",
          // Mobile: hidden by default, slide in when open
          mobileOpen ? "w-64 translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
      {/* Logo */}
      <div className="flex h-16 items-center px-4 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
            <span className="text-lg font-bold text-white">{COMPANY_CONFIG.name.charAt(0)}</span>
          </div>
          {!collapsed && (
            <span className="text-lg font-semibold text-sidebar-foreground">
              {COMPANY_CONFIG.name}
            </span>
          )}
        </Link>
      </div>

      {/* User Profile */}
      <div className={cn("p-4 border-b border-sidebar-border", collapsed && "px-2")}>
        <div
          className={cn(
            "flex items-center gap-3 cursor-pointer",
            collapsed && "justify-center"
          )}
          onClick={() => !collapsed && setUserMenuOpen(!userMenuOpen)}
        >
          <Avatar className="h-11 w-11 border-2 border-white/20">
            <AvatarFallback className="bg-sidebar-primary text-white text-sm">
              {isLoading ? "..." : getInitials(userName || userEmail || "U")}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
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
                        "h-4 w-4 text-sidebar-muted transition-transform flex-shrink-0",
                        userMenuOpen && "rotate-180"
                      )}
                    />
                  </div>
                  <span className="text-xs text-sidebar-muted truncate block">{getRoleLabel()}</span>
                </>
              )}
            </div>
          )}
        </div>
        {/* User submenu */}
        {!collapsed && userMenuOpen && (
          <div className="mt-3 space-y-1 pl-14">
            <p className="text-xs text-sidebar-muted/60 truncate mb-2">{userEmail}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-thin">
        <ul className="space-y-1">
          {filteredNavItems.map((item) => {
            const isOpen = openMenus.includes(item.name)
            const isActive = item.children?.some((child) => pathname === child.href)

            return (
              <li key={item.name}>
                <button
                  onClick={() => !collapsed && toggleMenu(item.name)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.name}</span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          isOpen && "rotate-180"
                        )}
                      />
                    </>
                  )}
                </button>
                {/* Submenu */}
                {!collapsed && isOpen && item.children && (
                  <ul className="mt-1 space-y-1 pl-4">
                    {item.children.map((child) => {
                      const childActive = pathname === child.href
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            onClick={onMobileClose}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200",
                              childActive
                                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                : "text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                            )}
                          >
                            <span className="w-5 text-center text-xs font-medium">
                              {child.name.charAt(0)}
                            </span>
                            <span>{child.name}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>

        {/* Quick Links */}
        <div className="mt-6 pt-4 border-t border-sidebar-border">
          <ul className="space-y-1">
            {quickNavItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onMobileClose}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>

      {/* Toggle Button */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-sidebar-accent/50 px-3 py-2 text-sm text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
    </>
  )
}
