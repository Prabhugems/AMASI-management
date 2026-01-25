"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

interface CurrencyInputProps {
  value: number | null | undefined
  onChange: (value: number | null) => void
  currency?: string
  locale?: string
  min?: number
  max?: number
  step?: number
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * Currency Input Component
 *
 * Formatted currency input with symbol
 *
 * Usage:
 * ```
 * <CurrencyInput
 *   value={amount}
 *   onChange={setAmount}
 *   currency="INR"
 * />
 * ```
 */
export function CurrencyInput({
  value,
  onChange,
  currency = "INR",
  locale = "en-IN",
  min,
  max,
  step = 1,
  placeholder = "0.00",
  disabled = false,
  className,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = React.useState("")
  const [isFocused, setIsFocused] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Currency symbol
  const currencySymbol = React.useMemo(() => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(0)
      .replace(/[\d.,\s]/g, "")
      .trim()
  }, [locale, currency])

  // Format number for display
  const formatForDisplay = (num: number | null | undefined): string => {
    if (num == null) return ""
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num)
  }

  // Parse display value to number
  const parseDisplayValue = (str: string): number | null => {
    if (!str.trim()) return null

    // Remove currency symbol and formatting
    const cleaned = str
      .replace(new RegExp(`[${currencySymbol}\\s,]`, "g"), "")
      .trim()

    const num = parseFloat(cleaned)
    return isNaN(num) ? null : num
  }

  // Update display when value changes externally
  React.useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatForDisplay(value))
    }
  }, [value, isFocused])

  const handleFocus = () => {
    setIsFocused(true)
    // Show raw number for editing
    setDisplayValue(value != null ? String(value) : "")
  }

  const handleBlur = () => {
    setIsFocused(false)
    const parsed = parseDisplayValue(displayValue)

    // Apply min/max constraints
    let constrained = parsed
    if (constrained != null) {
      if (min != null) constrained = Math.max(min, constrained)
      if (max != null) constrained = Math.min(max, constrained)
    }

    onChange(constrained)
    setDisplayValue(formatForDisplay(constrained))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value

    // Allow only numbers, decimal point, and minus sign
    if (/^-?\d*\.?\d*$/.test(input) || input === "") {
      setDisplayValue(input)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Increment/decrement with arrow keys
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault()
      const current = parseDisplayValue(displayValue) || 0
      const delta = e.key === "ArrowUp" ? step : -step
      let newValue = current + delta

      if (min != null) newValue = Math.max(min, newValue)
      if (max != null) newValue = Math.min(max, newValue)

      setDisplayValue(String(newValue))
      onChange(newValue)
    }
  }

  return (
    <div className={cn("relative", className)}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        {currencySymbol}
      </span>
      <Input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="pl-8"
      />
    </div>
  )
}

/**
 * Currency display (read-only)
 */
export function CurrencyDisplay({
  value,
  currency = "INR",
  locale = "en-IN",
  showZero = true,
  className,
}: {
  value: number | null | undefined
  currency?: string
  locale?: string
  showZero?: boolean
  className?: string
}) {
  if (value == null || (!showZero && value === 0)) {
    return <span className={cn("text-muted-foreground", className)}>—</span>
  }

  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)

  return <span className={className}>{formatted}</span>
}

/**
 * Currency range input
 */
export function CurrencyRangeInput({
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  currency = "INR",
  className,
}: {
  minValue: number | null | undefined
  maxValue: number | null | undefined
  onMinChange: (value: number | null) => void
  onMaxChange: (value: number | null) => void
  currency?: string
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <CurrencyInput
        value={minValue}
        onChange={onMinChange}
        currency={currency}
        placeholder="Min"
        max={maxValue ?? undefined}
      />
      <span className="text-muted-foreground">to</span>
      <CurrencyInput
        value={maxValue}
        onChange={onMaxChange}
        currency={currency}
        placeholder="Max"
        min={minValue ?? undefined}
      />
    </div>
  )
}

/**
 * Price breakdown display
 */
export function PriceBreakdown({
  items,
  total,
  currency = "INR",
  locale = "en-IN",
  className,
}: {
  items: Array<{ label: string; amount: number; type?: "add" | "subtract" }>
  total: number
  currency?: string
  locale?: string
  className?: string
}) {
  const formatAmount = (amount: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item, index) => (
        <div key={index} className="flex justify-between text-sm">
          <span className="text-muted-foreground">{item.label}</span>
          <span className={item.type === "subtract" ? "text-green-600" : ""}>
            {item.type === "subtract" ? "- " : ""}
            {formatAmount(item.amount)}
          </span>
        </div>
      ))}
      <div className="flex justify-between font-medium pt-2 border-t">
        <span>Total</span>
        <span>{formatAmount(total)}</span>
      </div>
    </div>
  )
}
