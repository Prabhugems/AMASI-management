"use client"

import * as React from "react"
import { Bell, Check, Trash2, X, CheckCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"

export interface Notification {
  id: string
  title: string
  message: string
  type?: "info" | "success" | "warning" | "error"
  read?: boolean
  createdAt: Date | string
  link?: string
  icon?: React.ReactNode
}

interface NotificationCenterProps {
  notifications: Notification[]
  onRead?: (id: string) => void
  onReadAll?: () => void
  onDelete?: (id: string) => void
  onDeleteAll?: () => void
  onNotificationClick?: (notification: Notification) => void
  maxHeight?: number
  className?: string
}

/**
 * Notification Center Component
 *
 * Bell icon with notification list
 *
 * Usage:
 * ```
 * <NotificationCenter
 *   notifications={notifications}
 *   onRead={(id) => markAsRead(id)}
 *   onReadAll={() => markAllAsRead()}
 *   onDelete={(id) => deleteNotification(id)}
 * />
 * ```
 */
export function NotificationCenter({
  notifications,
  onRead,
  onReadAll,
  onDelete,
  onDeleteAll,
  onNotificationClick,
  maxHeight = 400,
  className,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const unreadCount = notifications.filter((n) => !n.read).length
  const hasNotifications = notifications.length > 0

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      onRead?.(notification.id)
    }
    onNotificationClick?.(notification)
    if (notification.link) {
      setIsOpen(false)
    }
  }

  const formatTime = (date: Date | string) => {
    const d = new Date(date)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString()
  }

  const typeColors = {
    info: "bg-blue-500",
    success: "bg-green-500",
    warning: "bg-yellow-500",
    error: "bg-red-500",
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", className)}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {hasNotifications && (
            <div className="flex items-center gap-1">
              {unreadCount > 0 && onReadAll && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={onReadAll}
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Notifications list */}
        <ScrollArea style={{ maxHeight }}>
          {!hasNotifications ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 hover:bg-muted/50 cursor-pointer transition-colors",
                    !notification.read && "bg-primary/5"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex gap-3">
                    {/* Icon or type indicator */}
                    <div className="flex-shrink-0 mt-0.5">
                      {notification.icon || (
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full mt-1.5",
                            typeColors[notification.type || "info"]
                          )}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm",
                          !notification.read && "font-medium"
                        )}
                      >
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(notification.createdAt)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div
                      className="flex-shrink-0 flex items-start gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!notification.read && onRead && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onRead(notification.id)}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => onDelete(notification.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {hasNotifications && onDeleteAll && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-destructive"
              onClick={onDeleteAll}
            >
              <Trash2 className="h-3 w-3 mr-2" />
              Clear all
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

/**
 * Notification item for standalone use
 */
export function NotificationItem({
  notification,
  onRead,
  onDelete,
  onClick,
  className,
}: {
  notification: Notification
  onRead?: () => void
  onDelete?: () => void
  onClick?: () => void
  className?: string
}) {
  const typeColors = {
    info: "border-l-blue-500",
    success: "border-l-green-500",
    warning: "border-l-yellow-500",
    error: "border-l-red-500",
  }

  return (
    <div
      className={cn(
        "p-4 border rounded-lg border-l-4 transition-colors",
        typeColors[notification.type || "info"],
        !notification.read && "bg-primary/5",
        onClick && "cursor-pointer hover:bg-muted/50",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className={cn("text-sm", !notification.read && "font-medium")}>
            {notification.title}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {notification.message}
          </p>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {!notification.read && onRead && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRead}>
              <Check className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Hook to manage notifications
 */
export function useNotifications(initialNotifications: Notification[] = []) {
  const [notifications, setNotifications] = React.useState(initialNotifications)

  const add = React.useCallback((notification: Omit<Notification, "id" | "createdAt">) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).slice(2),
      createdAt: new Date(),
      read: false,
    }
    setNotifications((prev) => [newNotification, ...prev])
    return newNotification.id
  }, [])

  const remove = React.useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const markAsRead = React.useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }, [])

  const markAllAsRead = React.useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const clear = React.useCallback(() => {
    setNotifications([])
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  return {
    notifications,
    add,
    remove,
    markAsRead,
    markAllAsRead,
    clear,
    unreadCount,
  }
}
