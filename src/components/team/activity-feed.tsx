"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { getSupabaseClient } from "@/lib/supabase/client"
import { X, Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type ActivityItem = {
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

const ACTION_DOT_COLORS: Record<string, string> = {
  "team_member.created": "bg-green-500",
  "team_member.invited": "bg-green-500",
  "team_member.updated": "bg-blue-500",
  "team_member.role_changed": "bg-blue-500",
  "team_member.deleted": "bg-red-500",
  "team_member.deactivated": "bg-orange-500",
  "team_member.activated": "bg-green-500",
  "team_member.invite_accepted": "bg-teal-500",
}

const ACTION_LABELS: Record<string, string> = {
  "team_member.created": "added",
  "team_member.invited": "invited",
  "team_member.updated": "updated",
  "team_member.role_changed": "changed role of",
  "team_member.deleted": "removed",
  "team_member.deactivated": "deactivated",
  "team_member.activated": "activated",
  "team_member.invite_accepted": "accepted invite",
  "team_member.invite_revoked": "revoked invite for",
  "team_member.permissions_changed": "updated permissions of",
  "team_member.email_synced": "synced email for",
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffSec = Math.floor((now - then) / 1000)

  if (diffSec < 60) return "just now"
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

function actorName(email: string): string {
  return email.split("@")[0]
}

function targetName(item: ActivityItem): string | null {
  if (item.metadata?.name && typeof item.metadata.name === "string") return item.metadata.name
  if (item.target_email) return item.target_email.split("@")[0]
  return null
}

interface ActivityFeedProps {
  onClose: () => void
}

const MAX_ITEMS = 50

export function ActivityFeed({ onClose }: ActivityFeedProps) {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchInitial = useCallback(async () => {
    try {
      const supabase = getSupabaseClient()
      const { data } = await (supabase as any)
        .from("team_activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20)
      if (data) setItems(data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInitial()

    const supabase = getSupabaseClient()
    const channel = supabase
      .channel("team-activity-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "team_activity_logs" },
        (payload: any) => {
          const newItem = payload.new as ActivityItem
          setItems((prev) => [newItem, ...prev].slice(0, MAX_ITEMS))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchInitial])

  return (
    <>
      {/* Mobile overlay backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={cn(
          "fixed right-0 top-0 bottom-0 z-50 bg-white flex flex-col",
          "w-full sm:w-80 lg:relative lg:z-auto",
          "border-l border-slate-200 shadow-lg lg:shadow-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-600" />
            <h3 className="text-sm font-semibold text-slate-800">Activity Feed</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Feed */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-3 py-2 space-y-1"
        >
          {loading ? (
            <div className="space-y-2 pt-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse flex items-start gap-2 p-2">
                  <div className="h-2 w-2 rounded-full bg-slate-200 mt-1.5 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-slate-200 rounded w-3/4" />
                    <div className="h-2.5 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400">
              No activity yet
            </div>
          ) : (
            items.map((item) => {
              const dotColor = ACTION_DOT_COLORS[item.action] || "bg-slate-400"
              const actionLabel = ACTION_LABELS[item.action] || item.action.split(".").pop()
              const target = targetName(item)

              return (
                <div
                  key={item.id}
                  className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full mt-1.5 shrink-0",
                      dotColor
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 leading-relaxed">
                      <span className="font-medium">{actorName(item.actor_email)}</span>
                      {" "}
                      <span className="text-slate-500">{actionLabel}</span>
                      {target && (
                        <>
                          {" "}
                          <span className="font-medium">{target}</span>
                        </>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {relativeTime(item.created_at)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
