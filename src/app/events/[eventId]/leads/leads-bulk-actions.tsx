"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Trash2, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LEAD_STATUSES } from "./leads-types"
import type { LeadStatus } from "./leads-types"

interface LeadsBulkActionsProps {
  selectedIds: string[]
  eventId: string
  onComplete: () => void
  onClear: () => void
}

export function LeadsBulkActions({
  selectedIds,
  eventId,
  onComplete,
  onClear,
}: LeadsBulkActionsProps) {
  const [statusValue, setStatusValue] = useState<string>("")

  const bulkUpdateStatus = useMutation({
    mutationFn: async (status: LeadStatus) => {
      const res = await fetch(`/api/events/${eventId}/leads/bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_ids: selectedIds, status }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to update leads")
      }
      return res.json()
    },
    onSuccess: () => {
      setStatusValue("")
      toast.success(`${selectedIds.length} lead(s) updated`)
      onComplete()
    },
    onError: () => toast.error("Failed to update leads"),
  })

  const bulkDelete = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/events/${eventId}/leads/bulk`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_ids: selectedIds }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to delete leads")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success(`${selectedIds.length} lead(s) deleted`)
      onComplete()
    },
    onError: () => toast.error("Failed to delete leads"),
  })

  const isProcessing = bulkUpdateStatus.isPending || bulkDelete.isPending

  if (selectedIds.length === 0) return null

  const handleStatusChange = (value: string) => {
    setStatusValue(value)
    bulkUpdateStatus.mutate(value as LeadStatus)
  }

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedIds.length} lead${selectedIds.length !== 1 ? "s" : ""}? This action cannot be undone.`
    )
    if (confirmed) {
      bulkDelete.mutate()
    }
  }

  return (
    <div
      className={
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 " +
        "bg-card border border-border rounded-2xl shadow-xl " +
        "px-5 py-3 flex items-center gap-4 " +
        "transition-all duration-200 ease-out " +
        "animate-in slide-in-from-bottom-4 fade-in"
      }
    >
      {/* Count + clear */}
      <div className="flex items-center gap-2 pr-4 border-r border-border">
        <span className="text-sm font-medium text-foreground whitespace-nowrap">
          {selectedIds.length} lead{selectedIds.length !== 1 ? "s" : ""} selected
        </span>
        <button
          onClick={onClear}
          className="p-0.5 rounded hover:bg-muted transition-colors"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Status change */}
      <Select value={statusValue} onValueChange={handleStatusChange} disabled={isProcessing}>
        <SelectTrigger className="w-[150px] h-9">
          <SelectValue placeholder="Change status" />
        </SelectTrigger>
        <SelectContent>
          {LEAD_STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Delete */}
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
        disabled={isProcessing}
      >
        {bulkDelete.isPending ? (
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="mr-2 h-4 w-4" />
        )}
        Delete
      </Button>

      {/* Loading indicator for status update */}
      {bulkUpdateStatus.isPending && (
        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}
