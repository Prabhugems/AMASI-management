"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Ban,
  Pause,
  Play,
  Circle,
  LucideIcon,
} from "lucide-react"

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
        warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
        error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
        info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
        neutral: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
        purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
        orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
      },
      size: {
        sm: "text-[10px] px-2 py-0.5",
        md: "text-xs px-2.5 py-0.5",
        lg: "text-sm px-3 py-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  icon?: LucideIcon | false
  showDot?: boolean
  pulse?: boolean
}

/**
 * Status Badge Component
 *
 * Displays status with color coding and optional icon
 *
 * Usage:
 * ```
 * <StatusBadge variant="success" icon={CheckCircle}>
 *   Confirmed
 * </StatusBadge>
 *
 * <StatusBadge variant="warning" showDot pulse>
 *   Pending
 * </StatusBadge>
 * ```
 */
export function StatusBadge({
  className,
  variant,
  size,
  icon: Icon,
  showDot = false,
  pulse = false,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ variant, size }), className)} {...props}>
      {showDot && (
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
                variant === "success" && "bg-green-500",
                variant === "warning" && "bg-yellow-500",
                variant === "error" && "bg-red-500",
                variant === "info" && "bg-blue-500",
                variant === "neutral" && "bg-gray-500",
                variant === "purple" && "bg-purple-500",
                variant === "orange" && "bg-orange-500",
                !variant && "bg-primary"
              )}
            />
          )}
          <span
            className={cn(
              "relative inline-flex rounded-full h-2 w-2",
              variant === "success" && "bg-green-500",
              variant === "warning" && "bg-yellow-500",
              variant === "error" && "bg-red-500",
              variant === "info" && "bg-blue-500",
              variant === "neutral" && "bg-gray-500",
              variant === "purple" && "bg-purple-500",
              variant === "orange" && "bg-orange-500",
              !variant && "bg-primary"
            )}
          />
        </span>
      )}
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  )
}

// ==================== Preset Status Badges ====================

export function ConfirmedBadge({ className }: { className?: string }) {
  return (
    <StatusBadge variant="success" icon={CheckCircle} className={className}>
      Confirmed
    </StatusBadge>
  )
}

export function PendingBadge({ className }: { className?: string }) {
  return (
    <StatusBadge variant="warning" icon={Clock} className={className}>
      Pending
    </StatusBadge>
  )
}

export function CancelledBadge({ className }: { className?: string }) {
  return (
    <StatusBadge variant="error" icon={XCircle} className={className}>
      Cancelled
    </StatusBadge>
  )
}

export function ActiveBadge({ className }: { className?: string }) {
  return (
    <StatusBadge variant="success" showDot pulse className={className}>
      Active
    </StatusBadge>
  )
}

export function InactiveBadge({ className }: { className?: string }) {
  return (
    <StatusBadge variant="neutral" icon={Pause} className={className}>
      Inactive
    </StatusBadge>
  )
}

export function DraftBadge({ className }: { className?: string }) {
  return (
    <StatusBadge variant="neutral" icon={Circle} className={className}>
      Draft
    </StatusBadge>
  )
}

export function PublishedBadge({ className }: { className?: string }) {
  return (
    <StatusBadge variant="success" icon={CheckCircle} className={className}>
      Published
    </StatusBadge>
  )
}

export function ProcessingBadge({ className }: { className?: string }) {
  return (
    <StatusBadge variant="info" icon={Loader2} className={cn("animate-pulse", className)}>
      Processing
    </StatusBadge>
  )
}

export function FailedBadge({ className }: { className?: string }) {
  return (
    <StatusBadge variant="error" icon={AlertCircle} className={className}>
      Failed
    </StatusBadge>
  )
}

export function BlockedBadge({ className }: { className?: string }) {
  return (
    <StatusBadge variant="error" icon={Ban} className={className}>
      Blocked
    </StatusBadge>
  )
}

export function PaidBadge({ className }: { className?: string }) {
  return (
    <StatusBadge variant="success" icon={CheckCircle} className={className}>
      Paid
    </StatusBadge>
  )
}

export function UnpaidBadge({ className }: { className?: string }) {
  return (
    <StatusBadge variant="warning" icon={Clock} className={className}>
      Unpaid
    </StatusBadge>
  )
}

export function RefundedBadge({ className }: { className?: string }) {
  return (
    <StatusBadge variant="info" className={className}>
      Refunded
    </StatusBadge>
  )
}

export function CheckedInBadge({ className }: { className?: string }) {
  return (
    <StatusBadge variant="success" icon={CheckCircle} className={className}>
      Checked In
    </StatusBadge>
  )
}

export function NotCheckedInBadge({ className }: { className?: string }) {
  return (
    <StatusBadge variant="neutral" className={className}>
      Not Checked In
    </StatusBadge>
  )
}

/**
 * Dynamic status badge based on status string
 */
export function DynamicStatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const normalizedStatus = status.toLowerCase().replace(/[_-]/g, "")

  const statusConfig: Record<string, { variant: StatusBadgeProps["variant"]; icon?: LucideIcon }> = {
    confirmed: { variant: "success", icon: CheckCircle },
    approved: { variant: "success", icon: CheckCircle },
    active: { variant: "success", icon: Play },
    paid: { variant: "success", icon: CheckCircle },
    published: { variant: "success", icon: CheckCircle },
    completed: { variant: "success", icon: CheckCircle },
    checkedin: { variant: "success", icon: CheckCircle },

    pending: { variant: "warning", icon: Clock },
    awaiting: { variant: "warning", icon: Clock },
    processing: { variant: "warning", icon: Loader2 },
    unpaid: { variant: "warning", icon: Clock },
    review: { variant: "warning", icon: AlertCircle },

    cancelled: { variant: "error", icon: XCircle },
    rejected: { variant: "error", icon: XCircle },
    failed: { variant: "error", icon: AlertCircle },
    expired: { variant: "error", icon: Clock },
    blocked: { variant: "error", icon: Ban },

    draft: { variant: "neutral", icon: Circle },
    inactive: { variant: "neutral", icon: Pause },
    archived: { variant: "neutral" },
  }

  const config = statusConfig[normalizedStatus] || { variant: "neutral" as const }

  return (
    <StatusBadge variant={config.variant} icon={config.icon} className={className}>
      {status}
    </StatusBadge>
  )
}
