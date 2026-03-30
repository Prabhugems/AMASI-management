"use client"

import { useQuery } from "@tanstack/react-query"
import { Users, UserCheck, Shield, ChevronRight, Loader2, Clock, Wifi, WifiOff } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"

type TeamMember = {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
  has_logged_in: boolean
  last_sign_in_at: string | null
  last_active_at: string | null
  logged_out_at: string | null
  permissions?: string[] | null
}

function getStatus(member: TeamMember) {
  if (!member.is_active) return "offline"
  if (!member.has_logged_in) return "pending"
  if (member.last_active_at) {
    const diff = Date.now() - new Date(member.last_active_at).getTime()
    if (diff < 15 * 60 * 1000) return "online"
    if (diff < 60 * 60 * 1000) return "away"
  }
  return "offline"
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
}

const _ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  travel: "Travel",
  coordinator: "Coordinator",
}

export function TeamWidget() {
  const { data: members, isLoading } = useQuery({
    queryKey: ["team-widget"],
    queryFn: async () => {
      const res = await fetch("/api/team/status")
      if (!res.ok) throw new Error("Failed to fetch")
      const json = await res.json()
      return json.members as TeamMember[]
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 60000,
  })

  if (isLoading) {
    return (
      <div className="paper-card">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h5 className="text-base font-semibold text-foreground">Team</h5>
          </div>
        </div>
        <div className="p-5 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  const all = members || []
  const online = all.filter((m) => getStatus(m) === "online")
  const away = all.filter((m) => getStatus(m) === "away")
  const admins = all.filter((m) => m.role === "admin")
  const pending = all.filter((m) => !m.has_logged_in)

  return (
    <div className="paper-card">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h5 className="text-base font-semibold text-foreground">Team</h5>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-muted-foreground">
              {all.length}
            </span>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Online now */}
        {online.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Wifi className="h-3 w-3 text-emerald-500" />
              Online now
            </p>
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-2">
                {online.slice(0, 5).map((m) => (
                  <div
                    key={m.id}
                    className="relative w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-background"
                    title={m.name}
                  >
                    {getInitials(m.name)}
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                  </div>
                ))}
                {online.length > 5 && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground ring-2 ring-background">
                    +{online.length - 5}
                  </div>
                )}
              </div>
              <span className="text-xs text-muted-foreground ml-1">{online.length} active</span>
            </div>
          </div>
        )}

        {/* Away */}
        {away.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-amber-500" />
              Away
            </p>
            <div className="flex -space-x-2">
              {away.slice(0, 4).map((m) => (
                <div
                  key={m.id}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-background"
                  title={`${m.name} - ${m.last_active_at ? formatDistanceToNow(new Date(m.last_active_at), { addSuffix: true }) : ""}`}
                >
                  {getInitials(m.name)}
                </div>
              ))}
              {away.length > 4 && (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground ring-2 ring-background">
                  +{away.length - 4}
                </div>
              )}
            </div>
          </div>
        )}

        {/* No one online or away */}
        {online.length === 0 && away.length === 0 && all.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <WifiOff className="h-4 w-4" />
            <span>No one online right now</span>
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border">
          {[
            { label: "Total", value: all.length, icon: Users },
            { label: "Active", value: online.length + away.length, icon: UserCheck },
            { label: "Admins", value: admins.length, icon: Shield },
            { label: "Pending", value: pending.length, icon: Clock },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <stat.icon className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground/70" />
              <p className="text-lg font-bold text-foreground leading-none">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="card-stats-footer px-5 pb-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground/70">{all.filter((m) => m.is_active).length} active members</span>
        <Link href="/team" className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
          View all <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
