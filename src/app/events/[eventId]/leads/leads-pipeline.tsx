"use client"

import { useState, useCallback, useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Phone, GripVertical, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { Lead, LeadStatus } from "./leads-types"
import { LEAD_STATUSES, LEAD_SOURCES } from "./leads-types"

const PIPELINE_STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "converted"]

interface LeadsPipelineProps {
  leads: Lead[]
  eventId: string
  onSelectLead: (lead: Lead) => void
  onStatusChange: () => void
}

export default function LeadsPipeline({
  leads,
  eventId,
  onSelectLead,
  onStatusChange,
}: LeadsPipelineProps) {
  const queryClient = useQueryClient()
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<LeadStatus | null>(null)
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, LeadStatus>>({})
  const dragCounter = useRef<Record<string, number>>({})

  const updateStatusMutation = useMutation({
    mutationFn: async ({ leadIds, status }: { leadIds: string[]; status: LeadStatus }) => {
      const res = await fetch(`/api/events/${eventId}/leads/bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_ids: leadIds, status }),
      })
      if (!res.ok) throw new Error("Failed to update lead status")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-leads", eventId] })
      onStatusChange()
    },
    onError: () => {
      // Revert optimistic update on error
      setOptimisticUpdates({})
    },
  })

  const getLeadStatus = useCallback(
    (lead: Lead): LeadStatus => {
      return optimisticUpdates[lead.id] || lead.status
    },
    [optimisticUpdates]
  )

  const getColumnLeads = useCallback(
    (status: LeadStatus): Lead[] => {
      return leads.filter((lead) => getLeadStatus(lead) === status)
    },
    [leads, getLeadStatus]
  )

  const handleDragStart = useCallback((e: React.DragEvent, leadId: string) => {
    setDraggedLeadId(leadId)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", leadId)
    // Make the drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5"
    }
  }, [])

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedLeadId(null)
    setDropTarget(null)
    dragCounter.current = {}
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1"
    }
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault()
    dragCounter.current[status] = (dragCounter.current[status] || 0) + 1
    setDropTarget(status)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault()
    dragCounter.current[status] = (dragCounter.current[status] || 0) - 1
    if (dragCounter.current[status] <= 0) {
      dragCounter.current[status] = 0
      setDropTarget((prev) => (prev === status ? null : prev))
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, newStatus: LeadStatus) => {
      e.preventDefault()
      setDropTarget(null)
      dragCounter.current = {}

      const leadId = e.dataTransfer.getData("text/plain")
      if (!leadId) return

      const lead = leads.find((l) => l.id === leadId)
      if (!lead || getLeadStatus(lead) === newStatus) return

      // Optimistic update
      setOptimisticUpdates((prev) => ({ ...prev, [leadId]: newStatus }))

      updateStatusMutation.mutate(
        { leadIds: [leadId], status: newStatus },
        {
          onSettled: () => {
            setOptimisticUpdates((prev) => {
              const next = { ...prev }
              delete next[leadId]
              return next
            })
          },
        }
      )
    },
    [leads, getLeadStatus, updateStatusMutation]
  )

  const getSourceLabel = (source: string) => {
    return LEAD_SOURCES.find((s) => s.value === source)?.label || source
  }

  const getStatusConfig = (status: LeadStatus) => {
    return LEAD_STATUSES.find((s) => s.value === status)!
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" })
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 min-h-[500px]">
      {PIPELINE_STATUSES.map((status) => {
        const config = getStatusConfig(status)
        const columnLeads = getColumnLeads(status)
        const isDropping = dropTarget === status && draggedLeadId !== null

        return (
          <div
            key={status}
            className={cn(
              "flex-shrink-0 w-72 sm:w-80 flex flex-col rounded-xl border transition-all duration-200",
              "bg-muted/30 dark:bg-muted/10",
              isDropping && "border-blue-400 dark:border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900/50"
            )}
            onDragEnter={(e) => handleDragEnter(e, status)}
            onDragLeave={(e) => handleDragLeave(e, status)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status)}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-card rounded-t-xl">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-block w-2.5 h-2.5 rounded-full",
                    status === "new" && "bg-blue-500",
                    status === "contacted" && "bg-amber-500",
                    status === "qualified" && "bg-purple-500",
                    status === "converted" && "bg-emerald-500"
                  )}
                />
                <span className="font-semibold text-sm text-foreground">{config.label}</span>
              </div>
              <Badge variant="secondary" className="text-xs font-medium tabular-nums">
                {columnLeads.length}
              </Badge>
            </div>

            {/* Column Content */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)]">
              {columnLeads.length === 0 ? (
                <div
                  className={cn(
                    "flex items-center justify-center h-32 rounded-lg border-2 border-dashed",
                    "text-muted-foreground text-sm",
                    isDropping
                      ? "border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/20"
                      : "border-muted"
                  )}
                >
                  No leads
                </div>
              ) : (
                columnLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onSelectLead(lead)}
                    className={cn(
                      "group relative bg-card rounded-xl border p-3 cursor-pointer",
                      "hover:shadow-md hover:border-foreground/20 transition-all duration-150",
                      "active:scale-[0.98]",
                      draggedLeadId === lead.id && "opacity-50"
                    )}
                  >
                    {/* Drag Handle */}
                    <div className="absolute top-3 right-2 opacity-0 group-hover:opacity-60 transition-opacity">
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                    </div>

                    {/* Lead Name / Email */}
                    <div className="flex items-start gap-2 mb-2 pr-6">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-foreground truncate">
                          {lead.name || lead.email}
                        </p>
                        {lead.name && (
                          <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                        )}
                      </div>
                    </div>

                    {/* Meta Row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className="text-[11px] px-1.5 py-0 rounded-lg font-normal"
                      >
                        {getSourceLabel(lead.source)}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(lead.created_at)}
                      </span>
                      {lead.phone && (
                        <Phone className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
