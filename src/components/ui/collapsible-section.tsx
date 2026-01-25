"use client"

import * as React from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface CollapsibleSectionProps {
  title: string
  description?: string
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
  icon?: React.ReactNode
  badge?: React.ReactNode
}

/**
 * Collapsible Section Component
 *
 * Expandable panel with header
 *
 * Usage:
 * ```
 * <CollapsibleSection title="Advanced Settings" defaultOpen={false}>
 *   <SettingsForm />
 * </CollapsibleSection>
 * ```
 */
export function CollapsibleSection({
  title,
  description,
  defaultOpen = true,
  open,
  onOpenChange,
  children,
  className,
  headerClassName,
  contentClassName,
  icon,
  badge,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)
  const actualOpen = open ?? isOpen
  const setActualOpen = onOpenChange ?? setIsOpen

  return (
    <div className={className}>
      <button
        onClick={() => setActualOpen(!actualOpen)}
        className={cn(
          "flex items-center justify-between w-full p-4 text-left",
          "hover:bg-muted/50 transition-colors rounded-lg",
          headerClassName
        )}
      >
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <h3 className="font-medium">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {badge}
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform",
            actualOpen && "rotate-180"
          )}
        />
      </button>
      {actualOpen && (
        <div className={cn("px-4 pb-4", contentClassName)}>
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * Collapsible card variant
 */
export function CollapsibleCard({
  title,
  description,
  defaultOpen = true,
  children,
  className,
  icon,
  actions,
}: CollapsibleSectionProps & {
  actions?: React.ReactNode
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)

  return (
    <div className={cn("border rounded-lg", className)}>
      <div className="flex items-center justify-between p-4 border-b">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-3 text-left"
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              isOpen && "rotate-90"
            )}
          />
          {icon}
          <div>
            <h3 className="font-medium">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </button>
        {actions && (
          <div onClick={(e) => e.stopPropagation()}>{actions}</div>
        )}
      </div>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  )
}

/**
 * Accordion with multiple sections
 */
export function Accordion({
  items,
  allowMultiple = false,
  defaultOpenItems = [],
  className,
}: {
  items: Array<{
    id: string
    title: string
    description?: string
    content: React.ReactNode
    icon?: React.ReactNode
  }>
  allowMultiple?: boolean
  defaultOpenItems?: string[]
  className?: string
}) {
  const [openItems, setOpenItems] = React.useState<Set<string>>(
    new Set(defaultOpenItems)
  )

  const toggleItem = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (!allowMultiple) {
          next.clear()
        }
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className={cn("divide-y border rounded-lg", className)}>
      {items.map((item) => (
        <div key={item.id}>
          <button
            onClick={() => toggleItem(item.id)}
            className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              {item.icon}
              <div>
                <h3 className="font-medium">{item.title}</h3>
                {item.description && (
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
            <ChevronDown
              className={cn(
                "h-5 w-5 text-muted-foreground transition-transform",
                openItems.has(item.id) && "rotate-180"
              )}
            />
          </button>
          {openItems.has(item.id) && (
            <div className="px-4 pb-4">
              {item.content}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Simple show more / show less
 */
export function ShowMore({
  children,
  maxHeight = 200,
  className,
}: {
  children: React.ReactNode
  maxHeight?: number
  className?: string
}) {
  const [expanded, setExpanded] = React.useState(false)
  const [showButton, setShowButton] = React.useState(false)
  const contentRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (contentRef.current) {
      setShowButton(contentRef.current.scrollHeight > maxHeight)
    }
  }, [children, maxHeight])

  return (
    <div className={className}>
      <div
        ref={contentRef}
        className={cn(
          "overflow-hidden transition-all",
          !expanded && showButton && "relative"
        )}
        style={{
          maxHeight: expanded ? "none" : `${maxHeight}px`,
        }}
      >
        {children}
        {!expanded && showButton && (
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
        )}
      </div>
      {showButton && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-primary hover:underline mt-2"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  )
}
