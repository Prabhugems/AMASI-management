"use client"

import * as React from "react"
import { X, AlertCircle, Info, AlertTriangle, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface AnnouncementBannerProps {
  message: string
  variant?: "info" | "warning" | "error" | "success"
  dismissible?: boolean
  onDismiss?: () => void
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

const variants = {
  info: {
    bg: "bg-blue-50 dark:bg-blue-950",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-800 dark:text-blue-200",
    icon: Info,
  },
  warning: {
    bg: "bg-yellow-50 dark:bg-yellow-950",
    border: "border-yellow-200 dark:border-yellow-800",
    text: "text-yellow-800 dark:text-yellow-200",
    icon: AlertTriangle,
  },
  error: {
    bg: "bg-red-50 dark:bg-red-950",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-800 dark:text-red-200",
    icon: AlertCircle,
  },
  success: {
    bg: "bg-green-50 dark:bg-green-950",
    border: "border-green-200 dark:border-green-800",
    text: "text-green-800 dark:text-green-200",
    icon: CheckCircle,
  },
}

/**
 * Announcement Banner Component
 *
 * Site-wide notification banner
 *
 * Usage:
 * ```
 * <AnnouncementBanner
 *   message="New feature available!"
 *   variant="info"
 *   dismissible
 *   action={{ label: "Learn more", onClick: () => ... }}
 * />
 * ```
 */
export function AnnouncementBanner({
  message,
  variant = "info",
  dismissible = true,
  onDismiss,
  action,
  className,
}: AnnouncementBannerProps) {
  const [dismissed, setDismissed] = React.useState(false)

  if (dismissed) return null

  const { bg, border, text, icon: Icon } = variants[variant]

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  return (
    <div
      className={cn(
        "relative border-b px-4 py-3",
        bg,
        border,
        className
      )}
      role="alert"
    >
      <div className="container mx-auto flex items-center justify-center gap-4">
        <Icon className={cn("h-5 w-5 flex-shrink-0", text)} />

        <p className={cn("text-sm font-medium", text)}>{message}</p>

        {action && (
          <Button
            variant="outline"
            size="sm"
            onClick={action.onClick}
            className={cn("flex-shrink-0", text)}
          >
            {action.label}
          </Button>
        )}

        {dismissible && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className={cn("absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8", text)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Sticky announcement banner
 */
export function StickyAnnouncement({
  message,
  variant = "info",
  dismissible = true,
  storageKey,
  action,
  className,
}: AnnouncementBannerProps & {
  storageKey?: string
}) {
  const [dismissed, setDismissed] = React.useState(() => {
    if (storageKey && typeof localStorage !== "undefined") {
      return localStorage.getItem(storageKey) === "dismissed"
    }
    return false
  })

  const handleDismiss = () => {
    setDismissed(true)
    if (storageKey && typeof localStorage !== "undefined") {
      localStorage.setItem(storageKey, "dismissed")
    }
  }

  if (dismissed) return null

  return (
    <div className={cn("sticky top-0 z-50", className)}>
      <AnnouncementBanner
        message={message}
        variant={variant}
        dismissible={dismissible}
        onDismiss={handleDismiss}
        action={action}
      />
    </div>
  )
}

/**
 * Cookie consent banner
 */
export function CookieConsent({
  onAccept,
  onDecline,
  className,
}: {
  onAccept: () => void
  onDecline?: () => void
  className?: string
}) {
  const [visible, setVisible] = React.useState(() => {
    if (typeof localStorage !== "undefined") {
      return !localStorage.getItem("cookie-consent")
    }
    return true
  })

  const handleAccept = () => {
    setVisible(false)
    localStorage.setItem("cookie-consent", "accepted")
    onAccept()
  }

  const handleDecline = () => {
    setVisible(false)
    localStorage.setItem("cookie-consent", "declined")
    onDecline?.()
  }

  if (!visible) return null

  return (
    <div
      className={cn(
        "fixed bottom-0 inset-x-0 z-50 bg-background border-t shadow-lg p-4",
        className
      )}
    >
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground text-center sm:text-left">
          We use cookies to improve your experience. By continuing to use this site,
          you agree to our use of cookies.
        </p>
        <div className="flex gap-2 flex-shrink-0">
          {onDecline && (
            <Button variant="outline" size="sm" onClick={handleDecline}>
              Decline
            </Button>
          )}
          <Button size="sm" onClick={handleAccept}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Maintenance banner
 */
export function MaintenanceBanner({
  scheduledTime,
  duration,
  className,
}: {
  scheduledTime: Date | string
  duration?: string
  className?: string
}) {
  const time =
    typeof scheduledTime === "string"
      ? new Date(scheduledTime)
      : scheduledTime

  return (
    <AnnouncementBanner
      message={`Scheduled maintenance on ${time.toLocaleDateString()} at ${time.toLocaleTimeString()}${duration ? ` (${duration})` : ""}`}
      variant="warning"
      className={className}
    />
  )
}

/**
 * New version banner
 */
export function NewVersionBanner({
  version,
  onUpdate,
  className,
}: {
  version?: string
  onUpdate: () => void
  className?: string
}) {
  return (
    <AnnouncementBanner
      message={`A new version${version ? ` (${version})` : ""} is available.`}
      variant="info"
      action={{ label: "Update now", onClick: onUpdate }}
      className={className}
    />
  )
}

/**
 * Offline banner
 */
export function OfflineBanner({ className }: { className?: string }) {
  return (
    <AnnouncementBanner
      message="You are currently offline. Some features may not be available."
      variant="warning"
      dismissible={false}
      className={className}
    />
  )
}
