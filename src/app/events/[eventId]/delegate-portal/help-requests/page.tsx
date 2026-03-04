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
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  open: { label: "Open", color: "text-red-700", bg: "bg-red-100", icon: HelpCircle },
  in_progress: { label: "In Progress", color: "text-amber-700", bg: "bg-amber-100", icon: Clock },
  resolved: { label: "Resolved", color: "text-green-700", bg: "bg-green-100", icon: CheckCircle },
  closed: { label: "Closed", color: "text-gray-600", bg: "bg-gray-100", icon: XCircle },
}

export default function HelpRequestsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("all")

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["help-requests", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/help-request?event_id=${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch")
      return res.json()
    },
    refetchInterval: 15000,
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, admin_notes }: { id: string; status?: string; admin_notes?: string }) => {
      const res = await fetch("/api/help-request", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, admin_notes }),
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

  const filtered = filterStatus === "all" ? requests : requests.filter((r: any) => r.status === filterStatus)

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

      {/* Filter Tabs */}
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
            const isExpanded = expandedId === req.id

            return (
              <div key={req.id} className="bg-card border rounded-lg overflow-hidden">
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
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                        {req.category || "General"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">{req.message}</p>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {format(new Date(req.created_at), "dd MMM, h:mm a")}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>

                {/* Expanded details */}
                {isExpanded && (
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

                    {/* Message */}
                    <div className="bg-card border rounded-lg p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                        <MessageSquare className="h-4 w-4" />
                        Message
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{req.message}</p>
                    </div>

                    {/* Admin notes */}
                    <div>
                      <label className="block text-sm font-medium mb-1">Admin Notes</label>
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
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
