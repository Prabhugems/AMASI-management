"use client"

import { LucideIcon, Plus, Search, FileX, Users, Calendar, Plane, Hotel } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
    icon?: LucideIcon
  }
  className?: string
  size?: "sm" | "md" | "lg"
}

export function EmptyState({
  icon: Icon = FileX,
  title,
  description,
  action,
  className,
  size = "md",
}: EmptyStateProps) {
  const sizes = {
    sm: {
      container: "py-8",
      icon: "h-12 w-12",
      iconWrapper: "h-16 w-16",
      title: "text-lg",
      description: "text-sm",
    },
    md: {
      container: "py-12",
      icon: "h-10 w-10",
      iconWrapper: "h-20 w-20",
      title: "text-xl",
      description: "text-sm",
    },
    lg: {
      container: "py-20",
      icon: "h-12 w-12",
      iconWrapper: "h-24 w-24",
      title: "text-2xl",
      description: "text-base",
    },
  }

  const s = sizes[size]
  const ActionIcon = action?.icon || Plus

  return (
    <div className={cn("flex flex-col items-center justify-center text-center", s.container, className)}>
      <div className={cn(
        "rounded-full bg-muted/50 flex items-center justify-center mb-4",
        s.iconWrapper
      )}>
        <Icon className={cn("text-muted-foreground", s.icon)} />
      </div>
      <h3 className={cn("font-semibold mb-2", s.title)}>{title}</h3>
      <p className={cn("text-muted-foreground max-w-sm mb-6", s.description)}>{description}</p>
      {action && (
        <Button onClick={action.onClick} size={size === "lg" ? "lg" : "default"}>
          <ActionIcon className="h-4 w-4 mr-2" />
          {action.label}
        </Button>
      )}
    </div>
  )
}

// Pre-configured empty states
export function NoSearchResults({ query, onClear }: { query: string; onClear?: () => void }) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={`No matches for "${query}". Try adjusting your search.`}
      action={onClear ? { label: "Clear search", onClick: onClear } : undefined}
      size="sm"
    />
  )
}

export function NoTeamMembers({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon={Users}
      title="No team members yet"
      description="Add your first team member to start managing access and permissions."
      action={{ label: "Add Team Member", onClick: onAdd }}
    />
  )
}

export function NoEvents({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon={Calendar}
      title="No events yet"
      description="Create your first event to start managing conferences and workshops."
      action={{ label: "Create Event", onClick: onAdd }}
    />
  )
}

export function NoFlights({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon={Plane}
      title="No flight bookings"
      description="Start adding flight bookings for your faculty and attendees."
      action={{ label: "Add Flight", onClick: onAdd }}
    />
  )
}

export function NoHotels({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon={Hotel}
      title="No hotel bookings"
      description="Start adding hotel reservations for your guests."
      action={{ label: "Add Hotel", onClick: onAdd }}
    />
  )
}
