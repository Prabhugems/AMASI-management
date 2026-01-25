"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface OTPInputProps {
  length?: number
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
  autoFocus?: boolean
  type?: "number" | "text"
  className?: string
}

/**
 * OTP Input Component
 *
 * One-time password input with individual digit boxes
 *
 * Usage:
 * ```
 * <OTPInput
 *   length={6}
 *   value={otp}
 *   onChange={setOtp}
 *   onComplete={(code) => verifyOTP(code)}
 * />
 * ```
 */
export function OTPInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
  type = "number",
  className,
}: OTPInputProps) {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([])

  // Pad value to length
  const digits = value.padEnd(length, "").slice(0, length).split("")

  const focusInput = (index: number) => {
    const input = inputRefs.current[index]
    if (input) {
      input.focus()
      input.select()
    }
  }

  const handleChange = (index: number, digit: string) => {
    // Validate input
    if (type === "number" && !/^\d*$/.test(digit)) return
    if (digit.length > 1) digit = digit[0]

    // Update value
    const newDigits = [...digits]
    newDigits[index] = digit
    const newValue = newDigits.join("")
    onChange(newValue)

    // Move to next input
    if (digit && index < length - 1) {
      focusInput(index + 1)
    }

    // Check if complete
    if (newValue.length === length && !newValue.includes("")) {
      onComplete?.(newValue)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault()
      if (digits[index]) {
        // Clear current
        handleChange(index, "")
      } else if (index > 0) {
        // Move to previous and clear
        focusInput(index - 1)
        handleChange(index - 1, "")
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault()
      focusInput(index - 1)
    } else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault()
      focusInput(index + 1)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text")
    const sanitized = type === "number"
      ? pastedData.replace(/\D/g, "")
      : pastedData

    if (sanitized.length > 0) {
      const newValue = sanitized.slice(0, length)
      onChange(newValue)

      // Focus appropriate input
      const focusIndex = Math.min(newValue.length, length - 1)
      focusInput(focusIndex)

      // Check if complete
      if (newValue.length === length) {
        onComplete?.(newValue)
      }
    }
  }

  // Auto focus first input
  React.useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [autoFocus])

  return (
    <div className={cn("flex gap-2", className)}>
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el }}
          type={type === "number" ? "tel" : "text"}
          inputMode={type === "number" ? "numeric" : "text"}
          pattern={type === "number" ? "[0-9]*" : undefined}
          maxLength={1}
          value={digits[index] || ""}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          className={cn(
            "w-12 h-12 text-center text-lg font-semibold",
            "border rounded-md bg-background",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-all"
          )}
        />
      ))}
    </div>
  )
}

/**
 * OTP input with timer
 */
export function OTPInputWithTimer({
  length = 6,
  value,
  onChange,
  onComplete,
  onResend,
  resendDelay = 30,
  disabled = false,
  className,
}: OTPInputProps & {
  onResend?: () => void
  resendDelay?: number
}) {
  const [countdown, setCountdown] = React.useState(resendDelay)
  const [canResend, setCanResend] = React.useState(false)

  React.useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      setCanResend(true)
    }
  }, [countdown])

  const handleResend = () => {
    if (canResend && onResend) {
      onResend()
      setCountdown(resendDelay)
      setCanResend(false)
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <OTPInput
        length={length}
        value={value}
        onChange={onChange}
        onComplete={onComplete}
        disabled={disabled}
      />

      <div className="text-center text-sm">
        {canResend ? (
          <button
            onClick={handleResend}
            className="text-primary hover:underline"
          >
            Resend code
          </button>
        ) : (
          <span className="text-muted-foreground">
            Resend code in {countdown}s
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Masked OTP display (for showing sent code partially)
 */
export function MaskedOTP({
  value,
  visibleDigits = 2,
  className,
}: {
  value: string
  visibleDigits?: number
  className?: string
}) {
  const masked = value
    .split("")
    .map((char, index) =>
      index < visibleDigits || index >= value.length - visibleDigits
        ? char
        : "•"
    )
    .join("")

  return (
    <span className={cn("font-mono tracking-wider", className)}>
      {masked}
    </span>
  )
}
