"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Loader2,
  HelpCircle,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  Mail,
  User,
  Hash,
  ChevronDown,
  ChevronUp,
  Send,
  UserCheck,
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { createBrowserClient } from "@supabase/ssr"

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  open: { label: "Open", color: "text-red-700", bg: "bg-red-100", icon: HelpCircle },
  in_progress: { label: "In Progress", color: "text-amber-700", bg: "bg-amber-100", icon: Clock },
  resolved: { label: "Resolved", color: "text-green-700", bg: "bg-green-100", icon: CheckCircle },
  closed: { label: "Closed", color: "text-gray-600", bg: "bg-gray-100", icon: XCircle },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  low: { label: "Low", color: "text-slate-600", bg: "bg-slate-100", border: "border-l-slate-400" },
  medium: { label: "Medium", color: "text-blue-700", bg: "bg-blue-100", border: "border-l-blue-500" },
  high: { label: "High", color: "text-orange-700", bg: "bg-orange-100", border: "border-l-orange-500" },
  urgent: { label: "Urgent", color: "text-red-700", bg: "bg-red-100", border: "border-l-red-600" },
}

export default function HelpRequestsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterAssignee, setFilterAssignee] = useState<string>("all")

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["help-requests", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/help-request?event_id=${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch")
      return res.json()
    },
    refetchInterval: 15000,
  })

  // Fetch team members for assignment dropdown
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members-for-event", eventId],
    queryFn: async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data } = await supabase
        .from("team_members")
        .select("id, name, email, event_ids")
        .eq("is_active", true)
      // Filter to members assigned to this event
      return (data || []).filter((m: any) =>
        Array.isArray(m.event_ids) && m.event_ids.includes(eventId)
      )
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; status?: string; admin_notes?: string; priority?: string; assigned_to?: string | null }) => {
      const res = await fetch("/api/help-request", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to update")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["help-requests", eventId] })
      toast.success("Updated")
    },
    onError: () => toast.error("Failed to update"),
  })

  let filtered = filterStatus === "all" ? requests : requests.filter((r: any) => r.status === filterStatus)
  if (filterAssignee !== "all") {
    filtered = filtered.filter((r: any) =>
      filterAssignee === "unassigned" ? !r.assigned_to : r.assigned_to === filterAssignee
    )
  }

  const counts = {
    all: requests.length,
    open: requests.filter((r: any) => r.status === "open").length,
    in_progress: requests.filter((r: any) => r.status === "in_progress").length,
    resolved: requests.filter((r: any) => r.status === "resolved").length,
    closed: requests.filter((r: any) => r.status === "closed").length,
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Help Requests</h1>
        <p className="text-muted-foreground">Delegate support requests from the portal</p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {(["all", "open", "in_progress", "resolved", "closed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterStatus === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {s === "all" ? "All" : STATUS_CONFIG[s]?.label || s} ({counts[s]})
            </button>
          ))}
        </div>

        {/* Assignee Filter */}
        {teamMembers.length > 0 && (
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All assignees</option>
              <option value="unassigned">Unassigned</option>
              {teamMembers.map((m: any) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Requests List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <HelpCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No help requests</p>
          <p className="text-sm mt-1">
            {filterStatus === "all"
              ? "Delegates haven't submitted any help requests yet."
              : `No ${STATUS_CONFIG[filterStatus]?.label?.toLowerCase() || filterStatus} requests.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req: any) => {
            const statusConf = STATUS_CONFIG[req.status] || STATUS_CONFIG.open
            const StatusIcon = statusConf.icon
            const priorityConf = PRIORITY_CONFIG[req.priority] || PRIORITY_CONFIG.medium
            const isExpanded = expandedId === req.id

            return (
              <div key={req.id} className={`bg-card border rounded-lg overflow-hidden border-l-4 ${priorityConf.border}`}>
                {/* Header row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
                >
                  <StatusIcon className={`h-5 w-5 flex-shrink-0 ${statusConf.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{req.name || req.email}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConf.bg} ${statusConf.color}`}>
                        {statusConf.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityConf.bg} ${priorityConf.color}`}>
                        {priorityConf.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                        {req.category || "General"}
                      </span>
                      {req.assigned_member && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                          {req.assigned_member.name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">{req.message}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {req.reply_count > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        {req.reply_count}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(req.created_at), "dd MMM, h:mm a")}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <ExpandedRequest
                    req={req}
                    eventId={eventId}
                    teamMembers={teamMembers}
                    updateMutation={updateMutation}
                    queryClient={queryClient}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ExpandedRequest({
  req,
  eventId,
  teamMembers,
  updateMutation,
  queryClient,
}: {
  req: any
  eventId: string
  teamMembers: any[]
  updateMutation: any
  queryClient: any
}) {
  const [replyText, setReplyText] = useState("")
  const [sendEmail, setSendEmail] = useState(true)
  const [sendingReply, setSendingReply] = useState(false)

  // Fetch conversation thread
  const { data: replies = [], isLoading: repliesLoading } = useQuery({
    queryKey: ["help-request-replies", req.id],
    queryFn: async () => {
      const res = await fetch(`/api/help-request/replies?help_request_id=${req.id}`)
      if (!res.ok) throw new Error("Failed to fetch replies")
      return res.json()
    },
  })

  const handleSendReply = async () => {
    if (!replyText.trim()) return
    setSendingReply(true)
    try {
      const res = await fetch("/api/help-request/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          help_request_id: req.id,
          sender_type: "admin",
          message: replyText.trim(),
          send_email: sendEmail,
        }),
      })
      if (!res.ok) throw new Error("Failed to send reply")
      setReplyText("")
      queryClient.invalidateQueries({ queryKey: ["help-request-replies", req.id] })
      queryClient.invalidateQueries({ queryKey: ["help-requests", eventId] })
      toast.success(sendEmail ? "Reply sent with email" : "Reply sent")
    } catch {
      toast.error("Failed to send reply")
    } finally {
      setSendingReply(false)
    }
  }

  return (
    <div className="border-t p-4 space-y-4 bg-muted/20">
      {/* Contact info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span>{req.name || "Not provided"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <a href={`mailto:${req.email}`} className="text-blue-600 hover:underline">
            {req.email}
          </a>
        </div>
        {req.registration_number && (
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">{req.registration_number}</span>
          </div>
        )}
      </div>

      {/* Priority & Assignee row */}
      <div className="flex flex-wrap gap-4">
        {/* Priority selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Priority:</span>
          <div className="flex gap-1">
            {(["low", "medium", "high", "urgent"] as const).map((p) => {
              const pc = PRIORITY_CONFIG[p]
              const isActive = req.priority === p
              return (
                <button
                  key={p}
                  onClick={() => {
                    if (!isActive) updateMutation.mutate({ id: req.id, priority: p })
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    isActive
                      ? `${pc.bg} ${pc.color} ring-2 ring-offset-1 ring-current`
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {pc.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Assignee dropdown */}
        {teamMembers.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Assign to:</span>
            <select
              value={req.assigned_to || ""}
              onChange={(e) =>
                updateMutation.mutate({ id: req.id, assigned_to: e.target.value || null })
              }
              className="px-2.5 py-1 border rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Unassigned</option>
              {teamMembers.map((m: any) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Original message */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
          <MessageSquare className="h-4 w-4" />
          Original Message
        </div>
        <p className="text-sm whitespace-pre-wrap">{req.message}</p>
      </div>

      {/* Conversation thread */}
      <div>
        <h4 className="text-sm font-medium mb-3">Conversation</h4>
        {repliesLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : replies.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-2">No replies yet</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {replies.map((reply: any) => (
              <div
                key={reply.id}
                className={`flex ${reply.sender_type === "admin" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    reply.sender_type === "admin"
                      ? "bg-blue-100 text-blue-900"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">{reply.sender_name}</span>
                    <span className="text-xs opacity-60">
                      {format(new Date(reply.created_at), "dd MMM, h:mm a")}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{reply.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reply input */}
        <div className="mt-3 space-y-2">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type your reply to the delegate..."
            rows={2}
            className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="rounded"
              />
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Send reply via email to delegate
            </label>
            <button
              onClick={handleSendReply}
              disabled={sendingReply || !replyText.trim()}
              className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sendingReply ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Internal admin notes (separate from thread) */}
      <div>
        <label className="block text-sm font-medium mb-1">Internal Notes (not visible to delegate)</label>
        <textarea
          defaultValue={req.admin_notes || ""}
          placeholder="Add internal notes about this request..."
          rows={2}
          className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          onBlur={(e) => {
            if (e.target.value !== (req.admin_notes || "")) {
              updateMutation.mutate({ id: req.id, admin_notes: e.target.value })
            }
          }}
        />
      </div>

      {/* Status actions */}
      <div className="flex flex-wrap gap-2">
        {req.status === "open" && (
          <>
            <button
              onClick={() => updateMutation.mutate({ id: req.id, status: "in_progress" })}
              className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors"
            >
              Mark In Progress
            </button>
            <button
              onClick={() => updateMutation.mutate({ id: req.id, status: "resolved" })}
              className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
            >
              Resolve
            </button>
          </>
        )}
        {req.status === "in_progress" && (
          <button
            onClick={() => updateMutation.mutate({ id: req.id, status: "resolved" })}
            className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
          >
            Resolve
          </button>
        )}
        {(req.status === "open" || req.status === "in_progress") && (
          <button
            onClick={() => updateMutation.mutate({ id: req.id, status: "closed" })}
            className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        )}
        {(req.status === "resolved" || req.status === "closed") && (
          <button
            onClick={() => updateMutation.mutate({ id: req.id, status: "open" })}
            className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
          >
            Reopen
          </button>
        )}
      </div>
    </div>
  )
}
