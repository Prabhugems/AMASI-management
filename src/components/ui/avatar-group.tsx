"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getInitials } from "@/lib/formatters"

interface AvatarItem {
  name: string
  image?: string | null
  href?: string
}

interface AvatarGroupProps {
  items: AvatarItem[]
  max?: number
  size?: "sm" | "md" | "lg"
  showTooltip?: boolean
  className?: string
}

const sizeClasses = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
}

const overlapClasses = {
  sm: "-ml-2",
  md: "-ml-2.5",
  lg: "-ml-3",
}

/**
 * Avatar Group Component
 *
 * Shows overlapping avatars with overflow indicator
 *
 * Usage:
 * ```
 * <AvatarGroup
 *   items={[
 *     { name: "John Doe", image: "/avatars/john.jpg" },
 *     { name: "Jane Smith", image: "/avatars/jane.jpg" },
 *     { name: "Bob Wilson" },
 *   ]}
 *   max={3}
 * />
 * ```
 */
export function AvatarGroup({
  items,
  max = 4,
  size = "md",
  showTooltip = true,
  className,
}: AvatarGroupProps) {
  const visibleItems = items.slice(0, max)
  const overflowCount = items.length - max
  const hasOverflow = overflowCount > 0

  const renderAvatar = (item: AvatarItem, index: number) => {
    const avatar = (
      <Avatar
        key={index}
        className={cn(
          sizeClasses[size],
          "ring-2 ring-background",
          index > 0 && overlapClasses[size]
        )}
      >
        {item.image && <AvatarImage src={item.image} alt={item.name} />}
        <AvatarFallback className="text-[inherit]">
          {getInitials(item.name)}
        </AvatarFallback>
      </Avatar>
    )

    if (!showTooltip) return avatar

    return (
      <TooltipProvider key={index}>
        <Tooltip>
          <TooltipTrigger asChild>
            {item.href ? (
              <a href={item.href}>{avatar}</a>
            ) : (
              <span>{avatar}</span>
            )}
          </TooltipTrigger>
          <TooltipContent>
            <p>{item.name}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  const renderOverflow = () => {
    const overflowAvatar = (
      <Avatar
        className={cn(
          sizeClasses[size],
          "ring-2 ring-background bg-muted",
          overlapClasses[size]
        )}
      >
        <AvatarFallback className="text-[inherit] bg-muted">
          +{overflowCount}
        </AvatarFallback>
      </Avatar>
    )

    if (!showTooltip) return overflowAvatar

    const overflowNames = items.slice(max).map((item) => item.name)

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>{overflowAvatar}</span>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              {overflowNames.slice(0, 5).map((name, i) => (
                <p key={i}>{name}</p>
              ))}
              {overflowNames.length > 5 && (
                <p className="text-muted-foreground">
                  and {overflowNames.length - 5} more
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className={cn("flex items-center", className)}>
      {visibleItems.map((item, index) => renderAvatar(item, index))}
      {hasOverflow && renderOverflow()}
    </div>
  )
}

/**
 * Avatar group with names listed
 */
export function AvatarGroupWithNames({
  items,
  max = 3,
  size = "md",
  className,
}: AvatarGroupProps) {
  const visibleItems = items.slice(0, max)
  const overflowCount = items.length - max

  const getDisplayText = () => {
    if (items.length === 0) return ""
    if (items.length === 1) return items[0].name
    if (items.length === 2) return `${items[0].name} and ${items[1].name}`

    const names = visibleItems.map((item) => item.name.split(" ")[0])
    if (overflowCount > 0) {
      return `${names.join(", ")} and ${overflowCount} more`
    }
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <AvatarGroup items={items} max={max} size={size} showTooltip={false} />
      <span className="text-sm text-muted-foreground">{getDisplayText()}</span>
    </div>
  )
}

/**
 * Avatar stack (vertical)
 */
export function AvatarStack({
  items,
  max = 3,
  size = "md",
  className,
}: AvatarGroupProps) {
  const visibleItems = items.slice(0, max)
  const overflowCount = items.length - max

  return (
    <div className={cn("flex flex-col", className)}>
      {visibleItems.map((item, index) => (
        <Avatar
          key={index}
          className={cn(
            sizeClasses[size],
            "ring-2 ring-background",
            index > 0 && "-mt-2"
          )}
        >
          {item.image && <AvatarImage src={item.image} alt={item.name} />}
          <AvatarFallback className="text-[inherit]">
            {getInitials(item.name)}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflowCount > 0 && (
        <Avatar
          className={cn(
            sizeClasses[size],
            "ring-2 ring-background bg-muted -mt-2"
          )}
        >
          <AvatarFallback className="text-[inherit] bg-muted">
            +{overflowCount}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}

/**
 * Inline avatar with name
 */
export function AvatarWithName({
  name,
  image,
  subtitle,
  size = "md",
  className,
}: {
  name: string
  image?: string | null
  subtitle?: string
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Avatar className={sizeClasses[size]}>
        {image && <AvatarImage src={image} alt={name} />}
        <AvatarFallback className="text-[inherit]">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
