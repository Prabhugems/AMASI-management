"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useThemeColor, themeColors, sidebarColors } from "@/components/providers/theme-provider"
import { usePermissions } from "@/hooks/use-permissions"
import { createClient } from "@/lib/supabase/client"
import { format, formatDistanceToNow } from "date-fns"
import {
  Bell,
  Search,
  Sun,
  Moon,
  Monitor,
  Palette,
  ChevronDown,
  LogOut,
  User,
  HelpCircle,
  Shield,
  Calendar,
  Briefcase,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"

interface HeaderProps {
  sidebarCollapsed: boolean
}

// Role display config
const ROLE_DISPLAY: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  admin: { label: "Administrator", icon: Shield, color: "text-rose-500" },
  travel: { label: "Travel Coordinator", icon: Briefcase, color: "text-sky-500" },
  coordinator: { label: "Event Coordinator", icon: Calendar, color: "text-emerald-500" },
}

export function Header({ sidebarCollapsed }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const { color, setColor, sidebarColor, setSidebarColor } = useThemeColor()
  const [showThemeMenu, setShowThemeMenu] = React.useState(false)
  const [showUserMenu, setShowUserMenu] = React.useState(false)
  const [showNotifications, setShowNotifications] = React.useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Get user permissions and info
  const {
    userName,
    userEmail,
    role,
    isAdmin,
    isEventScoped,
    eventIds,
    hasFullAccess,
    permissions,
  } = usePermissions()

  // Get session info for login time
  const { data: sessionData } = useQuery({
    queryKey: ["session-info"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      return session
    },
    staleTime: 5 * 60 * 1000,
  })

  // Get login time from session
  const loginTime = React.useMemo(() => {
    if (!sessionData?.user?.last_sign_in_at) return null
    return new Date(sessionData.user.last_sign_in_at)
  }, [sessionData])

  // Get display role
  const getRoleDisplay = () => {
    if (isAdmin && !isEventScoped) return { label: "Super Admin", icon: Shield, color: "text-rose-500" }
    if (hasFullAccess && !isEventScoped) return { label: "Full Access", icon: Shield, color: "text-amber-500" }
    if (isEventScoped) return { label: "Event Team", icon: Calendar, color: "text-emerald-500" }
    return ROLE_DISPLAY[role || ""] || { label: role || "User", icon: User, color: "text-muted-foreground" }
  }

  const roleDisplay = getRoleDisplay()

  // Get initials from name
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      toast.success("Signed out successfully")
      router.push("/login")
    } catch (error) {
      toast.error("Failed to sign out")
    }
  }

  const notifications = [
    { id: 1, type: "info", title: "New faculty registered", message: "Dr. Sharma joined AMASICON 2026", time: "2 min ago", unread: true },
    { id: 2, type: "warning", title: "Pending approvals", message: "5 travel requests awaiting approval", time: "1 hour ago", unread: true },
    { id: 3, type: "success", title: "Import completed", message: "150 delegates imported successfully", time: "3 hours ago", unread: false },
    { id: 4, type: "error", title: "Payment failed", message: "Sponsor payment processing error", time: "5 hours ago", unread: false },
  ]

  const unreadCount = notifications.filter((n) => n.unread).length

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 h-16 bg-background/80 backdrop-blur-xl border-b border-border transition-all duration-300 print:hidden",
        sidebarCollapsed ? "left-20" : "left-64"
      )}
    >
      <div className="flex h-full items-center justify-between px-6">
        {/* Search */}
        <div className="flex items-center gap-4 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search events, faculty, attendees..."
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-secondary/50 border border-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:bg-secondary transition-colors"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <div className="relative">
            <button
              onClick={() => {
                setShowThemeMenu(!showThemeMenu)
                setShowUserMenu(false)
                setShowNotifications(false)
              }}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <Palette className="h-5 w-5" />
            </button>
            {showThemeMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowThemeMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-border bg-popover p-4 shadow-xl z-50 animate-in slide-in-from-top-2">
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-3">Appearance</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: "light", icon: Sun, label: "Light" },
                        { value: "dark", icon: Moon, label: "Dark" },
                        { value: "system", icon: Monitor, label: "System" },
                      ].map((mode) => (
                        <button
                          key={mode.value}
                          onClick={() => setTheme(mode.value)}
                          className={cn(
                            "flex flex-col items-center gap-2 rounded-xl border p-3 text-xs transition-all",
                            theme === mode.value
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <mode.icon className="h-5 w-5" />
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-3">Accent Color</p>
                    <div className="flex gap-2 flex-wrap">
                      {themeColors.map((tc) => (
                        <button
                          key={tc.value}
                          onClick={() => setColor(tc.value)}
                          className={cn(
                            "h-8 w-8 rounded-full transition-all hover:scale-110",
                            tc.class,
                            color === tc.value && "ring-2 ring-offset-2 ring-offset-background ring-foreground"
                          )}
                          title={tc.label}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground mb-3">Sidebar Color</p>
                    <div className="flex gap-2 flex-wrap">
                      {sidebarColors.map((sc) => (
                        <button
                          key={sc.value}
                          onClick={() => setSidebarColor(sc.value)}
                          className={cn(
                            "h-8 w-8 rounded-full transition-all hover:scale-110",
                            sc.class,
                            sidebarColor === sc.value && "ring-2 ring-offset-2 ring-offset-background ring-foreground"
                          )}
                          title={sc.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications)
                setShowThemeMenu(false)
                setShowUserMenu(false)
              }}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-border bg-popover shadow-xl z-50 animate-in slide-in-from-top-2">
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="font-semibold text-foreground">Notifications</h3>
                    <button className="text-xs text-primary hover:text-primary/80">Mark all read</button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={cn(
                          "flex gap-3 p-4 border-b border-border last:border-0 hover:bg-secondary/50 transition-colors cursor-pointer",
                          notification.unread && "bg-primary/5"
                        )}
                      >
                        <div
                          className={cn(
                            "h-2 w-2 rounded-full mt-2 flex-shrink-0",
                            notification.type === "info" && "bg-blue-500",
                            notification.type === "warning" && "bg-amber-500",
                            notification.type === "success" && "bg-emerald-500",
                            notification.type === "error" && "bg-rose-500"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{notification.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{notification.message}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">{notification.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 border-t border-border">
                    <button className="w-full text-center text-sm text-primary hover:text-primary/80 py-2">
                      View all notifications
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* User Menu */}
          <div className="relative ml-2">
            <button
              onClick={() => {
                setShowUserMenu(!showUserMenu)
                setShowThemeMenu(false)
                setShowNotifications(false)
              }}
              className="flex items-center gap-3 rounded-xl bg-secondary/50 pl-1 pr-3 py-1 hover:bg-secondary transition-colors"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-sm font-medium">
                  {getInitials(userName || userEmail || "U")}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-foreground leading-tight">{userName || userEmail?.split("@")[0] || "User"}</p>
                <p className={cn("text-[10px]", roleDisplay.color)}>{roleDisplay.label}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </button>
            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-border bg-popover shadow-xl z-50 animate-in slide-in-from-top-2">
                  {/* User Info Section */}
                  <div className="p-4 border-b border-border">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-lg font-medium">
                          {getInitials(userName || userEmail || "U")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{userName || "User"}</p>
                        <p className="text-sm text-muted-foreground truncate">{userEmail}</p>
                        <div className={cn("flex items-center gap-1 mt-1", roleDisplay.color)}>
                          <roleDisplay.icon className="h-3 w-3" />
                          <span className="text-xs font-medium">{roleDisplay.label}</span>
                        </div>
                      </div>
                    </div>

                    {/* Login Time */}
                    {loginTime && (
                      <div className="mt-3 p-2 rounded-lg bg-blue-500/10 text-xs flex items-center gap-2">
                        <Clock className="h-3 w-3 text-blue-500" />
                        <div>
                          <p className="text-blue-600 dark:text-blue-400 font-medium">
                            Logged in {formatDistanceToNow(loginTime, { addSuffix: true })}
                          </p>
                          <p className="text-blue-500/70 text-[10px]">
                            {format(loginTime, "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Access Info */}
                    {isEventScoped && eventIds.length > 0 && (
                      <div className="mt-2 p-2 rounded-lg bg-secondary/50 text-xs">
                        <p className="text-muted-foreground">Access limited to {eventIds.length} event{eventIds.length > 1 ? "s" : ""}</p>
                      </div>
                    )}
                    {!isEventScoped && hasFullAccess && (
                      <div className="mt-2 p-2 rounded-lg bg-emerald-500/10 text-xs">
                        <p className="text-emerald-600 dark:text-emerald-400">Full access to all events & modules</p>
                      </div>
                    )}
                    {!isEventScoped && !hasFullAccess && permissions.length > 0 && (
                      <div className="mt-2 p-2 rounded-lg bg-secondary/50 text-xs">
                        <p className="text-muted-foreground">Access: {permissions.join(", ")}</p>
                      </div>
                    )}
                  </div>

                  {/* Menu Items */}
                  <div className="p-2">
                    {[
                      { icon: HelpCircle, label: "Help & Support", href: "/help" },
                    ].map((item) => (
                      <button
                        key={item.label}
                        onClick={() => {
                          setShowUserMenu(false)
                          router.push(item.href)
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {/* Sign Out */}
                  <div className="p-2 border-t border-border">
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
