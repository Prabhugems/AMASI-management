"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Inbox,
  Search,
  FileX,
  Users,
  Calendar,
  Mail,
  Settings,
  AlertCircle,
  LucideIcon,
} from "lucide-react"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: "default" | "outline" | "secondary"
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  className?: string
  size?: "sm" | "md" | "lg"
}

/**
 * Empty State Component
 *
 * Shows when there's no data to display
 *
 * Usage:
 * ```
 * <EmptyState
 *   icon={Users}
 *   title="No attendees yet"
 *   description="Add attendees to this event to see them here"
 *   action={{
 *     label: "Add Attendee",
 *     onClick: () => setShowAddModal(true)
 *   }}
 * />
 * ```
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = "md",
}: EmptyStateProps) {
  const sizes = {
    sm: {
      container: "py-8",
      icon: "h-8 w-8",
      title: "text-sm font-medium",
      description: "text-xs",
    },
    md: {
      container: "py-12",
      icon: "h-12 w-12",
      title: "text-lg font-medium",
      description: "text-sm",
    },
    lg: {
      container: "py-16",
      icon: "h-16 w-16",
      title: "text-xl font-semibold",
      description: "text-base",
    },
  }

  const s = sizes[size]

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        s.container,
        className
      )}
    >
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className={cn("text-muted-foreground", s.icon)} />
      </div>
      <h3 className={cn("text-foreground", s.title)}>{title}</h3>
      {description && (
        <p className={cn("text-muted-foreground mt-1 max-w-sm", s.description)}>
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 mt-4">
          {action && (
            <Button variant={action.variant || "default"} onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="ghost" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ==================== Preset Empty States ====================

export function NoSearchResults({
  query,
  onClear,
  className,
}: {
  query?: string
  onClear?: () => void
  className?: string
}) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={query ? `No matches for "${query}"` : "Try adjusting your search or filters"}
      action={onClear ? { label: "Clear search", onClick: onClear, variant: "outline" } : undefined}
      className={className}
    />
  )
}

export function NoData({
  itemName = "items",
  onAdd,
  className,
}: {
  itemName?: string
  onAdd?: () => void
  className?: string
}) {
  return (
    <EmptyState
      icon={Inbox}
      title={`No ${itemName} yet`}
      description={`Get started by adding your first ${itemName.replace(/s$/, "")}`}
      action={onAdd ? { label: `Add ${itemName.replace(/s$/, "")}`, onClick: onAdd } : undefined}
      className={className}
    />
  )
}

export function NoEvents({ onAdd, className }: { onAdd?: () => void; className?: string }) {
  return (
    <EmptyState
      icon={Calendar}
      title="No events yet"
      description="Create your first event to start managing registrations"
      action={onAdd ? { label: "Create Event", onClick: onAdd } : undefined}
      className={className}
    />
  )
}

export function NoRegistrations({
  onAdd,
  className,
}: {
  onAdd?: () => void
  className?: string
}) {
  return (
    <EmptyState
      icon={Users}
      title="No registrations yet"
      description="Share your event link to start collecting registrations"
      action={onAdd ? { label: "Add Registration", onClick: onAdd } : undefined}
      className={className}
    />
  )
}

export function NoMessages({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={Mail}
      title="No messages"
      description="Your inbox is empty"
      className={className}
    />
  )
}

export function LoadError({
  onRetry,
  message,
  className,
}: {
  onRetry?: () => void
  message?: string
  className?: string
}) {
  return (
    <EmptyState
      icon={AlertCircle}
      title="Failed to load"
      description={message || "Something went wrong while loading the data"}
      action={onRetry ? { label: "Try again", onClick: onRetry, variant: "outline" } : undefined}
      className={className}
    />
  )
}

export function AccessDenied({
  message,
  className,
}: {
  message?: string
  className?: string
}) {
  return (
    <EmptyState
      icon={AlertCircle}
      title="Access denied"
      description={message || "You don't have permission to view this content"}
      className={className}
    />
  )
}

export function NoFile({
  accept,
  onUpload,
  className,
}: {
  accept?: string
  onUpload?: () => void
  className?: string
}) {
  return (
    <EmptyState
      icon={FileX}
      title="No file selected"
      description={accept ? `Accepted formats: ${accept}` : "Select a file to upload"}
      action={onUpload ? { label: "Select File", onClick: onUpload, variant: "outline" } : undefined}
      className={className}
    />
  )
}

export function ComingSoon({
  feature,
  className,
}: {
  feature?: string
  className?: string
}) {
  return (
    <EmptyState
      icon={Settings}
      title="Coming soon"
      description={feature ? `${feature} is currently under development` : "This feature is under development"}
      className={className}
    />
  )
}

/**
 * Empty state for tables
 */
export function TableEmptyState({
  colSpan,
  ...props
}: EmptyStateProps & { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <EmptyState {...props} />
      </td>
    </tr>
  )
}
