"use client"

import { useState, useEffect } from "react"
import { Users, MessageCircle, Video, ChevronRight, Activity, Loader2 } from "lucide-react"
import { useTheme } from "next-themes"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

// Status Indicator
function StatusIndicator({ status, size = "md" }: { status: string; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "w-2.5 h-2.5",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  }[size]

  const config: Record<string, { color: string; ring: string; pulse: boolean }> = {
    online: {
      color: "bg-emerald-500",
      ring: "ring-emerald-500/30",
      pulse: true,
    },
    away: {
      color: "bg-amber-500",
      ring: "ring-amber-500/30",
      pulse: false,
    },
    busy: {
      color: "bg-rose-500",
      ring: "ring-rose-500/30",
      pulse: false,
    },
    offline: {
      color: "bg-slate-400",
      ring: "ring-slate-400/30",
      pulse: false,
    },
  }

  const statusConfig = config[status] || config.offline

  return (
    <span className={`relative flex ${sizes}`}>
      {statusConfig.pulse && (
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusConfig.color} opacity-75`} />
      )}
      <span className={`relative inline-flex rounded-full ${sizes} ${statusConfig.color} ring-2 ${statusConfig.ring}`} />
    </span>
  )
}

// Avatar Component
function Avatar({
  name,
  color,
  size = "md",
  status,
  isDark,
}: {
  name: string
  color: string
  size?: "sm" | "md" | "lg"
  status?: string
  isDark: boolean
}) {
  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
  }[size]

  const colors: Record<string, string> = {
    emerald: "from-emerald-500 to-teal-600",
    amber: "from-amber-500 to-orange-600",
    rose: "from-rose-500 to-pink-600",
    blue: "from-blue-500 to-cyan-600",
    indigo: "from-indigo-500 to-blue-600",
  }

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)

  // Use theme primary for violet, otherwise use preset gradients
  const isPrimary = color === "violet"

  return (
    <div className="relative">
      <div
        className={`
        ${sizes} rounded-full
        ${isPrimary ? "bg-gradient-primary" : `bg-gradient-to-br ${colors[color] || ""}`}
        flex items-center justify-center
        font-bold text-white
        ring-2 ${isDark ? "ring-slate-800" : "ring-white"}
      `}
      >
        {initials}
      </div>

      {status && (
        <div className={`absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full ${isDark ? "bg-slate-900" : "bg-white"}`}>
          <StatusIndicator status={status} size="sm" />
        </div>
      )}
    </div>
  )
}

// Team Member Row
function TeamMemberRow({
  member,
  index,
  isDark,
}: {
  member: {
    id: string
    name: string
    role: string
    status: string
    color: string
    time: string
  }
  index: number
  isDark: boolean
}) {
  const [isVisible, setIsVisible] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 80)
    return () => clearTimeout(timer)
  }, [index])

  return (
    <div
      className={`
        group flex items-center gap-3 p-3 rounded-xl cursor-pointer
        transition-all duration-500 ease-out
        ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"}
        ${isDark ? "hover:bg-slate-800/80" : "hover:bg-gray-100"}
      `}
      style={{ transitionDelay: `${index * 80}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Avatar name={member.name} color={member.color} size="sm" status={member.status} isDark={isDark} />

      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm truncate ${isDark ? "text-white" : "text-gray-900"}`}>{member.name}</p>
        <p className={`text-xs truncate ${isDark ? "text-slate-500" : "text-gray-500"}`}>{member.role}</p>
      </div>

      {/* Quick Action */}
      <div
        className={`
        flex items-center gap-1 transition-all duration-300
        ${isHovered ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2"}
      `}
      >
        <button
          className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-gray-200 text-gray-500"}`}
        >
          <MessageCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Time */}
      <span
        className={`
        text-xs transition-all duration-300
        ${isDark ? "text-slate-500" : "text-gray-400"}
        ${isHovered ? "opacity-0" : "opacity-100"}
      `}
      >
        {member.time}
      </span>
    </div>
  )
}

// Team member type for widget
type TeamMemberWidget = {
  id: string
  name: string
  role: string
  status: string
  color: string
  time: string
}

// Online Avatars Row
function OnlineAvatarsRow({ members, isDark }: { members: TeamMemberWidget[]; isDark: boolean }) {
  const onlineMembers = members.filter((m) => m.status === "online").slice(0, 5)
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className={`
        flex items-center gap-3 mx-4 mb-3 p-3 rounded-xl
        transition-all duration-300
        ${isDark ? "bg-slate-800/30" : "bg-gray-50"}
        ${isHovered ? (isDark ? "bg-slate-800/50" : "bg-gray-100") : ""}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar Stack */}
      <div className="flex -space-x-2">
        {onlineMembers.map((member, i) => (
          <div
            key={i}
            className={`transition-all duration-300 ${isHovered ? "hover:z-10 hover:scale-110" : ""}`}
            style={{ zIndex: onlineMembers.length - i }}
          >
            <Avatar name={member.name} color={member.color} size="sm" isDark={isDark} />
          </div>
        ))}
        {members.filter((m) => m.status === "online").length > 5 && (
          <div
            className={`
            w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
            ${isDark ? "bg-slate-700 text-white ring-2 ring-slate-800" : "bg-gray-200 text-gray-600 ring-2 ring-white"}
          `}
          >
            +{members.filter((m) => m.status === "online").length - 5}
          </div>
        )}
      </div>

      {/* Status Text */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
          {members.filter((m) => m.status === "online").length} active
        </p>
        <p className={`text-xs ${isDark ? "text-slate-500" : "text-gray-500"}`}>Team members with access</p>
      </div>

      {/* Manage Team Link */}
      <Link
        href="/team"
        className={`
        flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
        transition-all duration-300
        bg-gradient-primary text-white
        hover:shadow-lg shadow-primary-glow hover:scale-105
      `}
      >
        <Users className="w-3.5 h-3.5" />
        Manage
      </Link>
    </div>
  )
}

// Role label mapping
const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  travel: "Travel Coordinator",
  coordinator: "Event Coordinator",
}

// Color mapping for roles
const ROLE_COLORS: Record<string, string> = {
  admin: "violet",
  travel: "emerald",
  coordinator: "blue",
}

// Array of colors for variety
const MEMBER_COLORS = ["emerald", "amber", "rose", "blue", "indigo", "violet"]

export function WhosOnlineWidget() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const supabase = createClient()

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch team members from database
  type TeamMemberType = { id: string; name: string; email: string; role: string; is_active: boolean; created_at: string }
  const { data: teamMembersData, isLoading } = useQuery({
    queryKey: ["team-members-online"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, name, email, role, is_active, created_at")
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data || []) as TeamMemberType[]
    },
  })

  // Transform database data to widget format
  const teamMembers = (teamMembersData || []).map((member, index) => ({
    id: member.id,
    name: member.name,
    role: ROLE_LABELS[member.role] || member.role,
    status: member.is_active ? "online" : "offline",
    color: ROLE_COLORS[member.role] || MEMBER_COLORS[index % MEMBER_COLORS.length],
    time: member.is_active ? "Active" : "Inactive",
  }))

  const isDark = mounted ? resolvedTheme === "dark" : false
  const onlineCount = teamMembers.filter((m) => m.status === "online").length
  const offlineCount = teamMembers.filter((m) => m.status === "offline").length

  if (isLoading) {
    return (
      <div
        className={`
        rounded-2xl overflow-hidden p-8
        ${isDark ? "bg-slate-900/50 border border-slate-800 backdrop-blur-sm" : "bg-white border border-gray-200 shadow-xl shadow-gray-200/50"}
      `}
      >
        <div className="flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>Loading team...</p>
        </div>
      </div>
    )
  }

  if (teamMembers.length === 0) {
    return (
      <div
        className={`
        rounded-2xl overflow-hidden p-8
        ${isDark ? "bg-slate-900/50 border border-slate-800 backdrop-blur-sm" : "bg-white border border-gray-200 shadow-xl shadow-gray-200/50"}
      `}
      >
        <div className="flex flex-col items-center justify-center gap-3">
          <Users className={`h-8 w-8 ${isDark ? "text-slate-600" : "text-gray-400"}`} />
          <p className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>No team members yet</p>
          <Link href="/team" className="text-sm text-primary hover:underline">
            Add team members
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`
      rounded-2xl overflow-hidden
      ${isDark ? "bg-slate-900/50 border border-slate-800 backdrop-blur-sm" : "bg-white border border-gray-200 shadow-xl shadow-gray-200/50"}
    `}
    >
      {/* Header */}
      <div className={`flex items-center justify-between p-4 ${isDark ? "bg-slate-800/50" : "bg-gray-50"}`}>
        <div className="flex items-start gap-3">
          <div
            className={`
            relative p-2.5 rounded-xl
            ${isDark ? "bg-emerald-500/20" : "bg-emerald-100"}
          `}
          >
            {onlineCount > 0 && <div className="absolute inset-0 rounded-xl bg-emerald-500/30 animate-ping-slow" />}
            <Users className={`relative w-5 h-5 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Team Members</h3>
              <div
                className={`
                flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold
                ${isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"}
              `}
              >
                <Activity className="w-3 h-3" />
                {teamMembers.length}
              </div>
            </div>
            <p className={`text-xs ${isDark ? "text-slate-500" : "text-gray-500"}`}>
              {onlineCount} active • {offlineCount} inactive
            </p>
          </div>
        </div>
      </div>

      {/* Online Avatars */}
      {onlineCount > 0 && <OnlineAvatarsRow members={teamMembers} isDark={isDark} />}

      {/* Members List */}
      <div className="px-2 pb-2 max-h-[320px] overflow-y-auto">
        {teamMembers.map((member, index) => (
          <TeamMemberRow key={member.id} member={member} index={index} isDark={isDark} />
        ))}
      </div>

      {/* Footer */}
      <div
        className={`
        flex items-center justify-center p-4
        border-t cursor-pointer transition-all duration-300
        ${isDark ? "border-slate-700/50 hover:bg-slate-800/50" : "border-gray-100 hover:bg-gray-50"}
      `}
      >
        <Link
          href="/team"
          className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          View all team activity
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
