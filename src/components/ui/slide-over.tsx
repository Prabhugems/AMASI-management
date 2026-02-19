"use client"

import * as React from "react"
import { X, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"

const MIN_WIDTH = 320
const MAX_WIDTH = 900
const DEFAULT_WIDTH = 512

interface SlideOverProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: React.ReactNode
  width?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl"
  showOverlay?: boolean
  resizable?: boolean
}

const widthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
}

const defaultWidths = {
  sm: 384,
  md: 448,
  lg: 512,
  xl: 576,
  "2xl": 672,
  "3xl": 768,
  "4xl": 896,
}

export function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = "lg",
  showOverlay = true,
  resizable = true,
}: SlideOverProps) {
  const [panelWidth, setPanelWidth] = React.useState(defaultWidths[width] || DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = React.useState(false)
  const panelRef = React.useRef<HTMLDivElement>(null)

  // Load saved width from localStorage
  React.useEffect(() => {
    const savedWidth = localStorage.getItem("slide-over-width")
    if (savedWidth && resizable) {
      const parsed = parseInt(savedWidth)
      if (parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
        setPanelWidth(parsed)
      }
    }
  }, [resizable])

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    if (open) {
      document.addEventListener("keydown", handleEscape)
      // Only block scroll if overlay is shown
      if (showOverlay) {
        document.body.style.overflow = "hidden"
      }
    }
    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "unset"
    }
  }, [open, onClose, showOverlay])

  // Handle resize
  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!isResizing) return
    const newWidth = window.innerWidth - e.clientX
    if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
      setPanelWidth(newWidth)
      localStorage.setItem("slide-over-width", newWidth.toString())
    }
  }, [isResizing])

  const handleMouseUp = React.useCallback(() => {
    setIsResizing(false)
  }, [])

  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = "ew-resize"
      document.body.style.userSelect = "none"
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  if (!open) return null

  return (
    <>
      {/* Overlay - only render if showOverlay */}
      {showOverlay && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel - positioned independently so clicks outside work */}
      <div className="fixed inset-y-0 right-0 z-50 flex max-w-full pointer-events-none">
        <div
          ref={panelRef}
          style={resizable ? { width: panelWidth } : undefined}
          className={cn(
            "transform transition-transform duration-300 ease-in-out",
            !resizable && cn("w-screen", widthClasses[width]),
            open ? "translate-x-0" : "translate-x-full",
            isResizing && "transition-none"
          )}
        >
          <div className="flex h-full flex-col bg-background shadow-2xl border-l border-border pointer-events-auto relative">
            {/* Resize Handle - on left edge */}
            {resizable && (
              <div
                onMouseDown={handleMouseDown}
                className={cn(
                  "absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/50 transition-colors group z-50",
                  isResizing && "bg-primary"
                )}
              >
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-primary text-primary-foreground rounded p-0.5">
                    <GripVertical className="h-4 w-4" />
                  </div>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-border bg-secondary/30">
              <div className="flex-1 min-w-0">
                {title && (
                  <h2 className="text-lg font-semibold text-foreground truncate">
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="ml-4 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// Tab component for slide-over panels
interface SlideOverTabsProps {
  tabs: { id: string; label: string; count?: number }[]
  activeTab: string
  onTabChange: (tabId: string) => void
}

export function SlideOverTabs({ tabs, activeTab, onTabChange }: SlideOverTabsProps) {
  return (
    <div className="border-b border-border px-6">
      <nav className="flex gap-6" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "ml-2 rounded-full px-2 py-0.5 text-xs",
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}

// Section component for organizing content
export interface SlideOverSectionProps {
  title?: string
  icon?: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  className?: string
}

export function SlideOverSection({ title, icon: Icon, children, className }: SlideOverSectionProps) {
  return (
    <div className={cn("px-5 py-4 border-b border-border/30 last:border-b-0", className)}>
      {title && (
        <h3 className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-[0.1em] mb-3 flex items-center gap-2">
          {Icon && <Icon className="h-3.5 w-3.5 text-primary/50" />}
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}

// Footer for actions
interface SlideOverFooterProps {
  children: React.ReactNode
  className?: string
}

export function SlideOverFooter({ children, className }: SlideOverFooterProps) {
  return (
    <div className={cn("border-t border-border px-5 py-4 bg-muted/20", className)}>
      {children}
    </div>
  )
}
