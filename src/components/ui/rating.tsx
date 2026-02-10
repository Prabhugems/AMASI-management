"use client"

import * as React from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface RatingProps {
  value: number
  max?: number
  onChange?: (value: number) => void
  size?: "sm" | "md" | "lg"
  readOnly?: boolean
  showValue?: boolean
  precision?: 0.5 | 1
  className?: string
  emptyColor?: string
  filledColor?: string
}

/**
 * Rating Component
 *
 * Star rating input/display
 *
 * Usage:
 * ```
 * // Display
 * <Rating value={4.5} readOnly />
 *
 * // Input
 * <Rating value={rating} onChange={setRating} />
 * ```
 */
export function Rating({
  value,
  max = 5,
  onChange,
  size = "md",
  readOnly = false,
  showValue = false,
  precision = 1,
  className,
  emptyColor = "text-muted-foreground/30",
  filledColor = "text-yellow-400",
}: RatingProps) {
  const [hoverValue, setHoverValue] = React.useState<number | null>(null)

  const displayValue = hoverValue ?? value

  const sizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  }

  const handleClick = (index: number) => {
    if (readOnly || !onChange) return

    const newValue = precision === 0.5 ? index + 0.5 : index + 1

    // If clicking same star, toggle between full and half (or 0)
    if (newValue === value) {
      onChange(precision === 0.5 ? index : 0)
    } else {
      onChange(newValue)
    }
  }

  const handleMouseMove = (index: number, event: React.MouseEvent) => {
    if (readOnly) return

    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const isHalf = precision === 0.5 && x < rect.width / 2

    setHoverValue(isHalf ? index + 0.5 : index + 1)
  }

  const handleMouseLeave = () => {
    setHoverValue(null)
  }

  const renderStar = (index: number) => {
    const isFilled = displayValue >= index + 1
    const isHalf = displayValue >= index + 0.5 && displayValue < index + 1

    return (
      <button
        key={index}
        type="button"
        className={cn(
          "relative focus:outline-none",
          !readOnly && "cursor-pointer hover:scale-110 transition-transform",
          readOnly && "cursor-default"
        )}
        onClick={() => handleClick(index)}
        onMouseMove={(e) => handleMouseMove(index, e)}
        onMouseLeave={handleMouseLeave}
        disabled={readOnly}
      >
        {/* Empty star (background) */}
        <Star className={cn(sizes[size], emptyColor, "fill-current")} />

        {/* Filled star (overlay) */}
        {(isFilled || isHalf) && (
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: isHalf ? "50%" : "100%" }}
          >
            <Star className={cn(sizes[size], filledColor, "fill-current")} />
          </div>
        )}
      </button>
    )
  }

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {Array.from({ length: max }, (_, i) => renderStar(i))}
      {showValue && (
        <span className="ml-2 text-sm text-muted-foreground">
          {displayValue.toFixed(precision === 0.5 ? 1 : 0)}
        </span>
      )}
    </div>
  )
}

/**
 * Rating display with count
 */
export function RatingWithCount({
  value,
  count,
  max = 5,
  size = "sm",
  className,
}: {
  value: number
  count: number
  max?: number
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Rating value={value} max={max} size={size} readOnly />
      <span className="text-sm text-muted-foreground">
        {value.toFixed(1)} ({count.toLocaleString()})
      </span>
    </div>
  )
}

/**
 * Rating breakdown bars
 */
export function RatingBreakdown({
  breakdown,
  total,
  className,
}: {
  breakdown: { stars: number; count: number }[]
  total: number
  className?: string
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {breakdown
        .sort((a, b) => b.stars - a.stars)
        .map(({ stars, count }) => {
          const percentage = total > 0 ? (count / total) * 100 : 0

          return (
            <div key={stars} className="flex items-center gap-2 text-sm">
              <span className="w-12 flex items-center gap-1">
                {stars}
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              </span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400 rounded-full transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-12 text-right text-muted-foreground">
                {count}
              </span>
            </div>
          )
        })}
    </div>
  )
}

/**
 * Emoji rating
 */
export function EmojiRating({
  value,
  onChange,
  className,
}: {
  value?: number
  onChange?: (value: number) => void
  className?: string
}) {
  const emojis = [
    { value: 1, emoji: "😞", label: "Very Dissatisfied" },
    { value: 2, emoji: "😕", label: "Dissatisfied" },
    { value: 3, emoji: "😐", label: "Neutral" },
    { value: 4, emoji: "😊", label: "Satisfied" },
    { value: 5, emoji: "😍", label: "Very Satisfied" },
  ]

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {emojis.map(({ value: v, emoji, label }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange?.(v)}
          className={cn(
            "text-2xl p-2 rounded-full transition-all",
            "hover:bg-muted hover:scale-110",
            value === v && "bg-muted scale-110 ring-2 ring-primary"
          )}
          title={label}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

/**
 * Simple thumbs up/down
 */
export function ThumbsRating({
  value,
  onChange,
  className,
}: {
  value?: "up" | "down" | null
  onChange?: (value: "up" | "down" | null) => void
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={() => onChange?.(value === "up" ? null : "up")}
        className={cn(
          "p-2 rounded-full transition-all",
          "hover:bg-green-100 dark:hover:bg-green-900/30",
          value === "up" && "bg-green-100 dark:bg-green-900/30 text-green-600"
        )}
      >
        👍
      </button>
      <button
        type="button"
        onClick={() => onChange?.(value === "down" ? null : "down")}
        className={cn(
          "p-2 rounded-full transition-all",
          "hover:bg-red-100 dark:hover:bg-red-900/30",
          value === "down" && "bg-red-100 dark:bg-red-900/30 text-red-600"
        )}
      >
        👎
      </button>
    </div>
  )
}

/**
 * NPS (Net Promoter Score) scale
 */
export function NPSRating({
  value,
  onChange,
  className,
}: {
  value?: number
  onChange?: (value: number) => void
  className?: string
}) {
  const getColor = (n: number) => {
    if (n <= 6) return "bg-red-500"
    if (n <= 8) return "bg-yellow-500"
    return "bg-green-500"
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Not likely</span>
        <span>Very likely</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange?.(i)}
            className={cn(
              "w-8 h-8 rounded text-sm font-medium transition-all",
              "hover:scale-110",
              value === i
                ? cn(getColor(i), "text-white")
                : "bg-muted hover:bg-muted/80"
            )}
          >
            {i}
          </button>
        ))}
      </div>
    </div>
  )
}
