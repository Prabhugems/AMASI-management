"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight, Home } from "lucide-react"
import { cn } from "@/lib/utils"

interface BreadcrumbItem {
  label: string
  href?: string
  icon?: React.ReactNode
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  showHome?: boolean
  homeHref?: string
  separator?: React.ReactNode
  className?: string
}

/**
 * Breadcrumbs Component
 *
 * Navigation breadcrumb trail
 *
 * Usage:
 * ```
 * <Breadcrumbs
 *   items={[
 *     { label: "Events", href: "/events" },
 *     { label: "My Event", href: "/events/123" },
 *     { label: "Registrations" }
 *   ]}
 * />
 * ```
 */
export function Breadcrumbs({
  items,
  showHome = true,
  homeHref = "/",
  separator,
  className,
}: BreadcrumbsProps) {
  const allItems: BreadcrumbItem[] = showHome
    ? [{ label: "Home", href: homeHref, icon: <Home className="h-4 w-4" /> }, ...items]
    : items

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center flex-wrap gap-1.5 text-sm">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1

          return (
            <li key={index} className="flex items-center gap-1.5">
              {index > 0 && (
                <span className="text-muted-foreground">
                  {separator || <ChevronRight className="h-4 w-4" />}
                </span>
              )}

              {isLast || !item.href ? (
                <span
                  className={cn(
                    "flex items-center gap-1.5",
                    isLast
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.icon}
                  <span className="max-w-[200px] truncate">{item.label}</span>
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.icon}
                  <span className="max-w-[200px] truncate">{item.label}</span>
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * Breadcrumbs with dropdown for overflow
 */
export function BreadcrumbsCollapsible({
  items,
  maxVisible = 3,
  showHome = true,
  homeHref = "/",
  className,
}: BreadcrumbsProps & { maxVisible?: number }) {
  const allItems: BreadcrumbItem[] = showHome
    ? [{ label: "Home", href: homeHref, icon: <Home className="h-4 w-4" /> }, ...items]
    : items

  if (allItems.length <= maxVisible) {
    return (
      <Breadcrumbs
        items={items}
        showHome={showHome}
        homeHref={homeHref}
        className={className}
      />
    )
  }

  const firstItem = allItems[0]
  const lastItems = allItems.slice(-maxVisible + 1)
  const hiddenItems = allItems.slice(1, -maxVisible + 1)

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center flex-wrap gap-1.5 text-sm">
        {/* First item */}
        <li className="flex items-center gap-1.5">
          {firstItem.href ? (
            <Link
              href={firstItem.href}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              {firstItem.icon}
              <span className="max-w-[200px] truncate">{firstItem.label}</span>
            </Link>
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {firstItem.icon}
              {firstItem.label}
            </span>
          )}
        </li>

        {/* Ellipsis with dropdown */}
        <li className="flex items-center gap-1.5">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div className="relative group">
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              ...
            </button>
            <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-50">
              <div className="bg-popover border rounded-md shadow-md py-1 min-w-[150px]">
                {hiddenItems.map((item, index) => (
                  <div key={index}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="block px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span className="block px-3 py-1.5 text-sm text-muted-foreground">
                        {item.label}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </li>

        {/* Last items */}
        {lastItems.map((item, index) => {
          const isLast = index === lastItems.length - 1

          return (
            <li key={index} className="flex items-center gap-1.5">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />

              {isLast || !item.href ? (
                <span
                  className={cn(
                    "flex items-center gap-1.5",
                    isLast
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.icon}
                  <span className="max-w-[200px] truncate">{item.label}</span>
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.icon}
                  <span className="max-w-[200px] truncate">{item.label}</span>
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * Simple breadcrumb from path
 *
 * Usage:
 * ```
 * <BreadcrumbsFromPath path="/events/123/registrations" />
 * ```
 */
export function BreadcrumbsFromPath({
  path,
  labels,
  className,
}: {
  path: string
  labels?: Record<string, string>
  className?: string
}) {
  const segments = path.split("/").filter(Boolean)

  const items: BreadcrumbItem[] = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/")
    const label = labels?.[segment] || formatSegment(segment)

    return {
      label,
      href: index < segments.length - 1 ? href : undefined,
    }
  })

  return <Breadcrumbs items={items} className={className} />
}

/**
 * Format URL segment to readable label
 */
function formatSegment(segment: string): string {
  // Handle UUIDs
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
    return "..."
  }

  // Handle numeric IDs
  if (/^\d+$/.test(segment)) {
    return `#${segment}`
  }

  // Convert kebab-case or snake_case to title case
  return segment
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}
