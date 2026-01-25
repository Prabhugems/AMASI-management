"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface CountdownProps {
  targetDate: Date | string
  onComplete?: () => void
  className?: string
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
  total: number
}

function calculateTimeLeft(targetDate: Date): TimeLeft {
  const difference = targetDate.getTime() - new Date().getTime()

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 }
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
    total: difference,
  }
}

/**
 * Countdown Timer Component
 *
 * Display countdown to a target date
 *
 * Usage:
 * ```
 * <Countdown
 *   targetDate={event.startDate}
 *   onComplete={() => console.log("Event started!")}
 * />
 * ```
 */
export function Countdown({
  targetDate,
  onComplete,
  className,
}: CountdownProps) {
  const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate
  const [timeLeft, setTimeLeft] = React.useState<TimeLeft>(() =>
    calculateTimeLeft(target)
  )
  const completedRef = React.useRef(false)

  React.useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(target)
      setTimeLeft(newTimeLeft)

      if (newTimeLeft.total <= 0 && !completedRef.current) {
        completedRef.current = true
        clearInterval(timer)
        onComplete?.()
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [target, onComplete])

  if (timeLeft.total <= 0) {
    return (
      <div className={cn("text-center", className)}>
        <p className="text-lg font-medium">Event has started!</p>
      </div>
    )
  }

  return (
    <div className={cn("flex gap-4 justify-center", className)}>
      <CountdownUnit value={timeLeft.days} label="Days" />
      <CountdownUnit value={timeLeft.hours} label="Hours" />
      <CountdownUnit value={timeLeft.minutes} label="Minutes" />
      <CountdownUnit value={timeLeft.seconds} label="Seconds" />
    </div>
  )
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-primary text-primary-foreground rounded-lg px-4 py-3 min-w-[60px]">
        <span className="text-2xl font-bold tabular-nums">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="text-xs text-muted-foreground mt-1">{label}</span>
    </div>
  )
}

/**
 * Compact countdown
 */
export function CountdownCompact({
  targetDate,
  className,
}: {
  targetDate: Date | string
  className?: string
}) {
  const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate
  const [timeLeft, setTimeLeft] = React.useState<TimeLeft>(() =>
    calculateTimeLeft(target)
  )

  React.useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(target))
    }, 1000)

    return () => clearInterval(timer)
  }, [target])

  if (timeLeft.total <= 0) {
    return <span className={cn("text-green-600", className)}>Started</span>
  }

  const parts: string[] = []
  if (timeLeft.days > 0) parts.push(`${timeLeft.days}d`)
  if (timeLeft.hours > 0 || timeLeft.days > 0) parts.push(`${timeLeft.hours}h`)
  if (timeLeft.minutes > 0 || timeLeft.hours > 0) parts.push(`${timeLeft.minutes}m`)
  parts.push(`${timeLeft.seconds}s`)

  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {parts.join(" ")}
    </span>
  )
}

/**
 * Countdown with flip animation
 */
export function CountdownFlip({
  targetDate,
  onComplete,
  className,
}: CountdownProps) {
  const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate
  const [timeLeft, setTimeLeft] = React.useState<TimeLeft>(() =>
    calculateTimeLeft(target)
  )

  React.useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(target)
      setTimeLeft(newTimeLeft)

      if (newTimeLeft.total <= 0) {
        clearInterval(timer)
        onComplete?.()
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [target, onComplete])

  if (timeLeft.total <= 0) {
    return (
      <div className={cn("text-center", className)}>
        <p className="text-lg font-medium">Event has started!</p>
      </div>
    )
  }

  return (
    <div className={cn("flex gap-2 justify-center", className)}>
      <FlipUnit value={timeLeft.days} label="Days" />
      <span className="text-2xl font-bold self-center">:</span>
      <FlipUnit value={timeLeft.hours} label="Hours" />
      <span className="text-2xl font-bold self-center">:</span>
      <FlipUnit value={timeLeft.minutes} label="Mins" />
      <span className="text-2xl font-bold self-center">:</span>
      <FlipUnit value={timeLeft.seconds} label="Secs" />
    </div>
  )
}

function FlipUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div className="bg-gray-900 text-white rounded px-3 py-2">
          <span className="text-xl font-mono font-bold">
            {String(value).padStart(2, "0")}
          </span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
        {label}
      </span>
    </div>
  )
}

/**
 * Countdown hook
 */
export function useCountdown(targetDate: Date | string): TimeLeft & {
  isComplete: boolean
} {
  const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate
  const [timeLeft, setTimeLeft] = React.useState<TimeLeft>(() =>
    calculateTimeLeft(target)
  )

  React.useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(target))
    }, 1000)

    return () => clearInterval(timer)
  }, [target])

  return {
    ...timeLeft,
    isComplete: timeLeft.total <= 0,
  }
}

/**
 * Time since (count up)
 */
export function TimeSince({
  date,
  className,
}: {
  date: Date | string
  className?: string
}) {
  const target = typeof date === "string" ? new Date(date) : date
  const [elapsed, setElapsed] = React.useState<TimeLeft>(() => {
    const now = new Date()
    return calculateTimeLeft(new Date(now.getTime() - (now.getTime() - target.getTime())))
  })

  React.useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      const difference = now.getTime() - target.getTime()

      setElapsed({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        total: difference,
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [target])

  const parts: string[] = []
  if (elapsed.days > 0) parts.push(`${elapsed.days}d`)
  if (elapsed.hours > 0) parts.push(`${elapsed.hours}h`)
  if (elapsed.minutes > 0) parts.push(`${elapsed.minutes}m`)
  parts.push(`${elapsed.seconds}s`)

  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {parts.join(" ")} ago
    </span>
  )
}
