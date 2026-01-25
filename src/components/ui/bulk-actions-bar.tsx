"use client"

import * as React from "react"
import { X, Trash2, Mail, Download, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface BulkAction {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: "default" | "destructive" | "outline"
  disabled?: boolean
}

interface BulkActionsBarProps {
  selectedCount: number
  onClearSelection: () => void
  actions: BulkAction[]
  className?: string
}

/**
 * Bulk Actions Bar
 *
 * Shows when items are selected, provides quick access to bulk operations
 *
 * Usage:
 * ```
 * <BulkActionsBar
 *   selectedCount={selectedIds.size}
 *   onClearSelection={clearAll}
 *   actions={[
 *     { label: "Delete", icon: <Trash2 />, onClick: handleDelete, variant: "destructive" },
 *     { label: "Export", icon: <Download />, onClick: handleExport },
 *   ]}
 * />
 * ```
 */
export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  actions,
  className,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "bg-primary text-primary-foreground rounded-full shadow-lg",
        "px-4 py-2 flex items-center gap-3",
        "animate-in slide-in-from-bottom-4 fade-in duration-200",
        className
      )}
    >
      <div className="flex items-center gap-2 pr-3 border-r border-primary-foreground/20">
        <span className="font-medium">{selectedCount} selected</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-primary-foreground/10"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant === "destructive" ? "destructive" : "ghost"}
            size="sm"
            className={cn(
              action.variant !== "destructive" && "hover:bg-primary-foreground/10"
            )}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.icon && <span className="mr-2">{action.icon}</span>}
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

/**
 * Common bulk action presets
 */
export const bulkActionPresets = {
  delete: (onClick: () => void, disabled?: boolean): BulkAction => ({
    label: "Delete",
    icon: <Trash2 className="h-4 w-4" />,
    onClick,
    variant: "destructive",
    disabled,
  }),

  export: (onClick: () => void, disabled?: boolean): BulkAction => ({
    label: "Export",
    icon: <Download className="h-4 w-4" />,
    onClick,
    disabled,
  }),

  email: (onClick: () => void, disabled?: boolean): BulkAction => ({
    label: "Send Email",
    icon: <Mail className="h-4 w-4" />,
    onClick,
    disabled,
  }),

  approve: (onClick: () => void, disabled?: boolean): BulkAction => ({
    label: "Approve",
    icon: <CheckCircle className="h-4 w-4" />,
    onClick,
    disabled,
  }),

  reject: (onClick: () => void, disabled?: boolean): BulkAction => ({
    label: "Reject",
    icon: <XCircle className="h-4 w-4" />,
    onClick,
    variant: "destructive",
    disabled,
  }),
}

/**
 * Inline bulk actions (shows at top of table)
 */
export function InlineBulkActions({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  actions,
  className,
}: {
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onClearSelection: () => void
  actions: BulkAction[]
  className?: string
}) {
  if (selectedCount === 0) return null

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-3 bg-primary/5 border-b",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">
          {selectedCount} of {totalCount} selected
        </span>
        {selectedCount < totalCount && (
          <Button variant="link" size="sm" className="h-auto p-0" onClick={onSelectAll}>
            Select all
          </Button>
        )}
        <Button variant="link" size="sm" className="h-auto p-0" onClick={onClearSelection}>
          Clear
        </Button>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant || "outline"}
            size="sm"
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.icon && <span className="mr-2">{action.icon}</span>}
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
