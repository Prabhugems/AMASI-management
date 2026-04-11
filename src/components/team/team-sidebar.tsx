"use client"

import {
  LayoutDashboard,
  Users,
  Shield,
  UserCog,
  Plane,
  Clock,
  CheckCircle,
  Activity,
  Eye,
  Settings,
  Sparkles,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

type TeamSidebarProps = {
  activeView: string
  onViewChange: (view: string) => void
  memberCounts: {
    total: number
    admin: number
    coordinator: number
    travel: number
    inactive: number
  }
  pendingInviteCount: number
  sidebarOpen: boolean
  onSidebarClose: () => void
}

type NavItem = {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: { count: number; color: string } | null
}

type NavGroup = {
  label: string
  items: NavItem[]
}

export function TeamSidebar({
  activeView,
  onViewChange,
  memberCounts,
  pendingInviteCount,
  sidebarOpen,
  onSidebarClose,
}: TeamSidebarProps) {
  const navGroups: NavGroup[] = [
    {
      label: "OVERVIEW",
      items: [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        {
          id: "all-members",
          label: "All Members",
          icon: Users,
          badge: { count: memberCounts.total, color: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300" },
        },
      ],
    },
    {
      label: "ROLES",
      items: [
        {
          id: "admins",
          label: "Admins",
          icon: Shield,
          badge: { count: memberCounts.admin, color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
        },
        {
          id: "coordinators",
          label: "Coordinators",
          icon: UserCog,
          badge: { count: memberCounts.coordinator, color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
        },
        {
          id: "travel-desk",
          label: "Travel Desk",
          icon: Plane,
          badge: { count: memberCounts.travel, color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
        },
      ],
    },
    {
      label: "INVITATIONS",
      items: [
        {
          id: "pending",
          label: "Pending",
          icon: Clock,
          badge: { count: pendingInviteCount, color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
        },
        { id: "accepted", label: "Accepted", icon: CheckCircle },
      ],
    },
    {
      label: "AUDIT",
      items: [
        { id: "activity-log", label: "Activity Log", icon: Activity },
        { id: "access-log", label: "Access Log", icon: Eye },
      ],
    },
    {
      label: "SETTINGS",
      items: [
        { id: "permissions-schema", label: "Permissions Schema", icon: Settings },
        { id: "role-presets", label: "Role Presets", icon: Sparkles },
      ],
    },
  ]

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <h2 className="text-sm font-semibold">Team Management</h2>
          <p className="text-xs text-muted-foreground">Super Admin</p>
        </div>
        {/* Mobile close button */}
        <button
          onClick={onSidebarClose}
          className="rounded-md p-1 hover:bg-slate-200 dark:hover:bg-slate-700 lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeView === item.id
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onViewChange(item.id)
                        onSidebarClose()
                      }}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "border-l-2 border-[#185FA5] bg-white font-medium text-foreground shadow-sm dark:bg-slate-800"
                          : "text-muted-foreground hover:bg-white hover:text-foreground dark:hover:bg-slate-800"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge && item.badge.count > 0 && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                            item.badge.color
                          )}
                        >
                          {item.badge.count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden h-full w-[220px] shrink-0 border-r bg-slate-50 dark:bg-slate-900 lg:block">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={onSidebarClose}
          />
          {/* Sidebar panel */}
          <aside className="relative h-full w-[220px] bg-slate-50 dark:bg-slate-900 shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
