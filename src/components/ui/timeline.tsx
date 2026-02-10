"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { formatRelativeTime, formatDateTime } from "@/lib/formatters"
import { Check, Clock, Circle, LucideIcon } from "lucide-react"

interface TimelineItem {
  id: string | number
  title: string
  description?: string
  date: Date | string
  icon?: LucideIcon
  iconColor?: "default" | "success" | "warning" | "error" | "info"
  status?: "completed" | "current" | "pending"
}

interface TimelineProps {
  items: TimelineItem[]
  className?: string
  showRelativeTime?: boolean
}

const iconColors = {
  default: "text-muted-foreground bg-muted",
  success: "text-green-600 bg-green-100 dark:bg-green-900/30",
  warning: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30",
  error: "text-red-600 bg-red-100 dark:bg-red-900/30",
  info: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
}

const statusIcons: Record<string, LucideIcon> = {
  completed: Check,
  current: Clock,
  pending: Circle,
}

const statusColors: Record<string, string> = {
  completed: "success",
  current: "info",
  pending: "default",
}

/**
 * Timeline Component
 *
 * Vertical timeline for activity logs, history, etc.
 *
 * Usage:
 * ```
 * <Timeline
 *   items={[
 *     {
 *       id: "1",
 *       title: "Registration created",
 *       description: "John Doe registered for the event",
 *       date: new Date(),
 *       iconColor: "success"
 *     },
 *     {
 *       id: "2",
 *       title: "Payment received",
 *       date: new Date(),
 *       iconColor: "success"
 *     }
 *   ]}
 * />
 * ```
 */
export function Timeline({
  items,
  className,
  showRelativeTime = true,
}: TimelineProps) {
  return (
    <div className={cn("relative", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        const Icon = item.icon || (item.status ? statusIcons[item.status] : Circle)
        const color = item.iconColor || (item.status ? statusColors[item.status] : "default")

        return (
          <div key={item.id} className="relative pl-8 pb-6 last:pb-0">
            {/* Connector line */}
            {!isLast && (
              <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-border" />
            )}

            {/* Icon */}
            <div
              className={cn(
                "absolute left-0 top-0.5 h-6 w-6 rounded-full flex items-center justify-center",
                iconColors[color as keyof typeof iconColors]
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>

            {/* Content */}
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm font-medium">{item.title}</p>
                <time
                  className="text-xs text-muted-foreground whitespace-nowrap"
                  dateTime={
                    typeof item.date === "string"
                      ? item.date
                      : item.date.toISOString()
                  }
                >
                  {showRelativeTime
                    ? formatRelativeTime(item.date)
                    : formatDateTime(item.date)}
                </time>
              </div>
              {item.description && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Compact timeline (horizontal)
 */
export function TimelineHorizontal({
  items,
  className,
}: {
  items: TimelineItem[]
  className?: string
}) {
  return (
    <div className={cn("flex items-start overflow-x-auto pb-4", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        const Icon = item.icon || (item.status ? statusIcons[item.status] : Circle)
        const color = item.iconColor || (item.status ? statusColors[item.status] : "default")

        return (
          <div key={item.id} className="flex items-start flex-shrink-0">
            <div className="flex flex-col items-center">
              {/* Icon */}
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center",
                  iconColors[color as keyof typeof iconColors]
                )}
              >
                <Icon className="h-4 w-4" />
              </div>

              {/* Content */}
              <div className="text-center mt-2 px-2 w-32">
                <p className="text-xs font-medium truncate">{item.title}</p>
                <time className="text-[10px] text-muted-foreground">
                  {formatRelativeTime(item.date)}
                </time>
              </div>
            </div>

            {/* Connector */}
            {!isLast && (
              <div className="h-0.5 w-8 bg-border self-start mt-4" />
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Activity timeline with user avatars
 */
export function ActivityTimeline({
  items,
  className,
}: {
  items: Array<{
    id: string | number
    user: { name: string; image?: string }
    action: string
    target?: string
    date: Date | string
  }>
  className?: string
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {items.map((item) => (
        <div key={item.id} className="flex gap-3">
          {/* Avatar */}
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            {item.user.image ? (
              <img
                src={item.user.image}
                alt={item.user.name}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <span className="text-xs font-medium">
                {item.user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm">
              <span className="font-medium">{item.user.name}</span>{" "}
              <span className="text-muted-foreground">{item.action}</span>
              {item.target && (
                <>
                  {" "}
                  <span className="font-medium">{item.target}</span>
                </>
              )}
            </p>
            <time className="text-xs text-muted-foreground">
              {formatRelativeTime(item.date)}
            </time>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Step progress timeline
 */
export function StepTimeline({
  steps,
  currentStep,
  className,
}: {
  steps: Array<{ label: string; description?: string }>
  currentStep: number
  className?: string
}) {
  return (
    <div className={cn("relative", className)}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep
        const isCurrent = index === currentStep
        const isPending = index > currentStep

        return (
          <div key={index} className="relative pl-8 pb-6 last:pb-0">
            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "absolute left-[11px] top-6 bottom-0 w-0.5",
                  isCompleted ? "bg-primary" : "bg-border"
                )}
              />
            )}

            {/* Step indicator */}
            <div
              className={cn(
                "absolute left-0 top-0.5 h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium",
                isCompleted && "bg-primary text-primary-foreground",
                isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                isPending && "bg-muted text-muted-foreground"
              )}
            >
              {isCompleted ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                index + 1
              )}
            </div>

            {/* Content */}
            <div>
              <p
                className={cn(
                  "text-sm font-medium",
                  isPending && "text-muted-foreground"
                )}
              >
                {step.label}
              </p>
              {step.description && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {step.description}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
