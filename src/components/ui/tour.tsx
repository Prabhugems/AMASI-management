"use client"

import * as React from "react"
import { X, ChevronLeft, ChevronRight, Circle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface TourStep {
  target: string // CSS selector
  title: string
  content: React.ReactNode
  placement?: "top" | "bottom" | "left" | "right"
  spotlightPadding?: number
}

interface TourProps {
  steps: TourStep[]
  isOpen: boolean
  onClose: () => void
  onComplete?: () => void
  startAt?: number
  showProgress?: boolean
  showSkip?: boolean
}

/**
 * Tour/Onboarding Component
 *
 * Step-by-step feature guide with spotlight effect
 *
 * Usage:
 * ```
 * <Tour
 *   isOpen={showTour}
 *   onClose={() => setShowTour(false)}
 *   onComplete={() => markTourComplete()}
 *   steps={[
 *     { target: "#sidebar", title: "Navigation", content: "Use the sidebar to navigate" },
 *     { target: "#search", title: "Search", content: "Search for anything" },
 *   ]}
 * />
 * ```
 */
export function Tour({
  steps,
  isOpen,
  onClose,
  onComplete,
  startAt = 0,
  showProgress = true,
  showSkip = true,
}: TourProps) {
  const [currentStep, setCurrentStep] = React.useState(startAt)
  const [targetRect, setTargetRect] = React.useState<DOMRect | null>(null)
  const tooltipRef = React.useRef<HTMLDivElement>(null)

  const step = steps[currentStep]
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === steps.length - 1

  // Find and highlight target element
  React.useEffect(() => {
    if (!isOpen || !step) return

    const target = document.querySelector(step.target)
    if (target) {
      const rect = target.getBoundingClientRect()
      setTargetRect(rect)

      // Scroll element into view
      target.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [isOpen, step, currentStep])

  const handleNext = React.useCallback(() => {
    if (isLastStep) {
      onComplete?.()
      onClose()
    } else {
      setCurrentStep((prev) => prev + 1)
    }
  }, [isLastStep, onComplete, onClose])

  const handlePrev = React.useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1)
    }
  }, [isFirstStep])

  // Keyboard navigation
  React.useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        handleNext()
      } else if (e.key === "ArrowLeft") {
        handlePrev()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose, handleNext, handlePrev])

  const handleSkip = () => {
    onClose()
  }

  if (!isOpen || !step) return null

  const tooltipPosition = getTooltipPosition(
    targetRect,
    step.placement || "bottom",
    step.spotlightPadding || 8
  )

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50">
        {/* Dark overlay with spotlight cutout */}
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {targetRect && (
                <rect
                  x={targetRect.left - (step.spotlightPadding || 8)}
                  y={targetRect.top - (step.spotlightPadding || 8)}
                  width={targetRect.width + (step.spotlightPadding || 8) * 2}
                  height={targetRect.height + (step.spotlightPadding || 8) * 2}
                  rx="8"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.5)"
            mask="url(#spotlight-mask)"
          />
        </svg>

        {/* Spotlight border */}
        {targetRect && (
          <div
            className="absolute border-2 border-primary rounded-lg pointer-events-none animate-pulse"
            style={{
              left: targetRect.left - (step.spotlightPadding || 8),
              top: targetRect.top - (step.spotlightPadding || 8),
              width: targetRect.width + (step.spotlightPadding || 8) * 2,
              height: targetRect.height + (step.spotlightPadding || 8) * 2,
            }}
          />
        )}

        {/* Tooltip */}
        <div
          ref={tooltipRef}
          className="absolute z-50 w-80 bg-background border rounded-lg shadow-lg"
          style={{
            left: tooltipPosition.left,
            top: tooltipPosition.top,
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Content */}
          <div className="p-4">
            <h3 className="font-semibold mb-2">{step.title}</h3>
            <div className="text-sm text-muted-foreground">{step.content}</div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t">
            {showProgress && (
              <div className="flex items-center gap-1">
                {steps.map((_, index) => (
                  <Circle
                    key={index}
                    className={cn(
                      "h-2 w-2",
                      index === currentStep
                        ? "fill-primary text-primary"
                        : "text-muted-foreground"
                    )}
                  />
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto">
              {showSkip && !isLastStep && (
                <Button variant="ghost" size="sm" onClick={handleSkip}>
                  Skip
                </Button>
              )}

              {!isFirstStep && (
                <Button variant="outline" size="sm" onClick={handlePrev}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}

              <Button size="sm" onClick={handleNext}>
                {isLastStep ? "Done" : "Next"}
                {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function getTooltipPosition(
  targetRect: DOMRect | null,
  placement: TourStep["placement"],
  padding: number
): { left: number; top: number } {
  if (!targetRect) {
    return { left: window.innerWidth / 2 - 160, top: window.innerHeight / 2 - 100 }
  }

  const tooltipWidth = 320
  const tooltipHeight = 200 // Estimated
  const gap = 12

  switch (placement) {
    case "top":
      return {
        left: Math.max(16, Math.min(targetRect.left + targetRect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16)),
        top: targetRect.top - padding - tooltipHeight - gap,
      }
    case "bottom":
      return {
        left: Math.max(16, Math.min(targetRect.left + targetRect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16)),
        top: targetRect.bottom + padding + gap,
      }
    case "left":
      return {
        left: targetRect.left - padding - tooltipWidth - gap,
        top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
      }
    case "right":
      return {
        left: targetRect.right + padding + gap,
        top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
      }
    default:
      return {
        left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        top: targetRect.bottom + padding + gap,
      }
  }
}

/**
 * Hook to manage tour state
 */
export function useTour(tourId: string) {
  const [isOpen, setIsOpen] = React.useState(false)

  React.useEffect(() => {
    // Check if tour was already completed
    const completed = localStorage.getItem(`tour_${tourId}_completed`)
    if (!completed) {
      // Delay to ensure page is loaded
      const timeout = setTimeout(() => setIsOpen(true), 1000)
      return () => clearTimeout(timeout)
    }
  }, [tourId])

  const startTour = () => setIsOpen(true)
  const closeTour = () => setIsOpen(false)
  const completeTour = () => {
    localStorage.setItem(`tour_${tourId}_completed`, "true")
    setIsOpen(false)
  }
  const resetTour = () => {
    localStorage.removeItem(`tour_${tourId}_completed`)
  }

  return { isOpen, startTour, closeTour, completeTour, resetTour }
}

/**
 * Simple tooltip-style hint
 */
export function Hint({
  children,
  content,
  side = "top",
  open,
  onOpenChange,
}: {
  children: React.ReactNode
  content: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const actualOpen = open ?? isOpen
  const setActualOpen = onOpenChange ?? setIsOpen

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setActualOpen(true)}
        onMouseLeave={() => setActualOpen(false)}
      >
        {children}
      </div>

      {actualOpen && (
        <div
          className={cn(
            "absolute z-50 px-3 py-2 text-sm bg-popover border rounded-lg shadow-lg",
            "animate-in fade-in-0 zoom-in-95",
            {
              "bottom-full left-1/2 -translate-x-1/2 mb-2": side === "top",
              "top-full left-1/2 -translate-x-1/2 mt-2": side === "bottom",
              "right-full top-1/2 -translate-y-1/2 mr-2": side === "left",
              "left-full top-1/2 -translate-y-1/2 ml-2": side === "right",
            }
          )}
        >
          {content}
        </div>
      )}
    </div>
  )
}
