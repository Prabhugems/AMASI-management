"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import {
  UserPlus,
  Edit,
  Shield,
  UserCheck,
  UserX,
  Trash2,
  Mail,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

export type ActivityEntry = {
  id: string
  actor_id: string
  actor_email: string
  action: string
  target_type: string
  target_id: string | null
  target_email: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

interface ActivityLogProps {
  memberId: string
}

const ACTION_CONFIG: Record<
  string,
  { icon: typeof Clock; color: string; borderColor: string; label: string }
> = {
  "team_member.created": {
    icon: UserPlus,
    color: "text-green-600 bg-green-50",
    borderColor: "border-l-green-500",
    label: "Member added",
  },
  "team_member.updated": {
    icon: Edit,
    color: "text-blue-600 bg-blue-50",
    borderColor: "border-l-blue-500",
    label: "Profile updated",
  },
  "team_member.role_changed": {
    icon: Shield,
    color: "text-purple-600 bg-purple-50",
    borderColor: "border-l-purple-500",
    label: "Role changed",
  },
  "team_member.activated": {
    icon: UserCheck,
    color: "text-green-600 bg-green-50",
    borderColor: "border-l-green-500",
    label: "Account activated",
  },
  "team_member.deactivated": {
    icon: UserX,
    color: "text-red-600 bg-red-50",
    borderColor: "border-l-red-500",
    label: "Account deactivated",
  },
  "team_member.deleted": {
    icon: Trash2,
    color: "text-red-600 bg-red-50",
    borderColor: "border-l-red-500",
    label: "Member removed",
  },
  "team_member.invited": {
    icon: Mail,
    color: "text-blue-600 bg-blue-50",
    borderColor: "border-l-blue-500",
    label: "Invitation sent",
  },
  "team_member.invite_accepted": {
    icon: CheckCircle,
    color: "text-green-600 bg-green-50",
    borderColor: "border-l-green-500",
    label: "Invitation accepted",
  },
}

const DEFAULT_CONFIG = {
  icon: Clock,
  color: "text-muted-foreground bg-slate-50",
  borderColor: "border-l-slate-400",
  label: "Activity",
}

function getActionLabel(entry: ActivityEntry) {
  const config = ACTION_CONFIG[entry.action]
  if (entry.action === "team_member.role_changed" && entry.metadata?.new_role) {
    return `Role changed to ${entry.metadata.new_role}`
  }
  return config?.label ?? entry.action
}

function MetadataDetails({ metadata }: { metadata: Record<string, unknown> }) {
  const [open, setOpen] = useState(false)
  const entries = Object.entries(metadata)
  if (entries.length === 0) return null

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Details
      </button>
      {open && (
        <div className="mt-1.5 p-2 rounded-lg bg-slate-50 text-xs space-y-1">
          {entries.map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <span className="text-muted-foreground font-medium min-w-[80px]">
                {key.replace(/_/g, " ")}
              </span>
              <span className="text-foreground">{String(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-3 rounded-xl bg-slate-50 border-l-4 border-l-slate-200 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-32 bg-slate-200 rounded" />
              <div className="h-3 w-48 bg-slate-200 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ActivityLog({ memberId }: ActivityLogProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["team-activity", memberId],
    queryFn: async () => {
      const res = await fetch(`/api/team/${memberId}/activity?limit=20`)
      if (!res.ok) throw new Error("Failed to fetch activity")
      return res.json()
    },
    enabled: !!memberId,
  })

  if (isLoading) return <LoadingSkeleton />

  const entries: ActivityEntry[] = data?.data ?? data ?? []

  if (entries.length === 0) {
    return (
      <div className="p-6 rounded-xl bg-slate-50 text-center">
        <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No activity recorded yet</p>
      </div>
    )
  }

  return (
    <div className="relative space-y-3">
      {/* Timeline connector line */}
      <div className="absolute left-[22px] top-4 bottom-4 w-px bg-slate-200" />

      {entries.map((entry) => {
        const config = ACTION_CONFIG[entry.action] ?? DEFAULT_CONFIG
        const Icon = config.icon

        return (
          <div
            key={entry.id}
            className={cn(
              "relative p-3 rounded-xl bg-slate-50 border-l-4 transition-colors hover:bg-slate-100",
              config.borderColor
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "relative z-10 flex items-center justify-center h-7 w-7 rounded-full shrink-0",
                  config.color
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{getActionLabel(entry)}</p>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                    {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                  </Badge>
                </div>
                {entry.actor_email && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    by {entry.actor_email}
                  </p>
                )}
                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                  <MetadataDetails metadata={entry.metadata} />
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
