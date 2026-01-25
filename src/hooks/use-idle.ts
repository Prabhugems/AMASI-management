"use client"

import { useState, useEffect, useRef, useCallback } from "react"

/**
 * Hook to detect user idle state
 *
 * Usage:
 * ```
 * const isIdle = useIdle(60000) // 1 minute
 *
 * useEffect(() => {
 *   if (isIdle) {
 *     showIdleWarning()
 *   }
 * }, [isIdle])
 * ```
 */
export function useIdle(timeout: number = 60000): boolean {
  const [isIdle, setIsIdle] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    setIsIdle(false)

    timeoutRef.current = setTimeout(() => {
      setIsIdle(true)
    }, timeout)
  }, [timeout])

  useEffect(() => {
    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ]

    // Initial timer
    resetTimer()

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, resetTimer, { passive: true })
    })

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      events.forEach((event) => {
        document.removeEventListener(event, resetTimer)
      })
    }
  }, [resetTimer])

  return isIdle
}

/**
 * Hook with idle callbacks
 *
 * Usage:
 * ```
 * useIdleCallback({
 *   timeout: 300000, // 5 minutes
 *   onIdle: () => console.log("User is idle"),
 *   onActive: () => console.log("User is active again")
 * })
 * ```
 */
export function useIdleCallback({
  timeout = 60000,
  onIdle,
  onActive,
}: {
  timeout?: number
  onIdle?: () => void
  onActive?: () => void
}) {
  const isIdle = useIdle(timeout)
  const wasIdleRef = useRef(false)

  useEffect(() => {
    if (isIdle && !wasIdleRef.current) {
      wasIdleRef.current = true
      onIdle?.()
    } else if (!isIdle && wasIdleRef.current) {
      wasIdleRef.current = false
      onActive?.()
    }
  }, [isIdle, onIdle, onActive])

  return isIdle
}

/**
 * Hook for session timeout warning
 *
 * Usage:
 * ```
 * const { isWarning, isExpired, timeRemaining, resetSession } = useSessionTimeout({
 *   timeout: 15 * 60 * 1000, // 15 minutes
 *   warningTime: 60 * 1000, // 1 minute warning
 *   onExpire: () => signOut()
 * })
 * ```
 */
export function useSessionTimeout({
  timeout = 15 * 60 * 1000,
  warningTime = 60 * 1000,
  onWarning,
  onExpire,
}: {
  timeout?: number
  warningTime?: number
  onWarning?: () => void
  onExpire?: () => void
}) {
  const [timeRemaining, setTimeRemaining] = useState(timeout)
  const [isWarning, setIsWarning] = useState(false)
  const [isExpired, setIsExpired] = useState(false)

  const lastActivityRef = useRef(Date.now())
  const warningFiredRef = useRef(false)

  const resetSession = useCallback(() => {
    lastActivityRef.current = Date.now()
    setTimeRemaining(timeout)
    setIsWarning(false)
    setIsExpired(false)
    warningFiredRef.current = false
  }, [timeout])

  // Track activity
  useEffect(() => {
    const handleActivity = () => {
      if (!isExpired) {
        lastActivityRef.current = Date.now()
      }
    }

    const events = ["mousedown", "keydown", "scroll", "touchstart"]
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity)
      })
    }
  }, [isExpired])

  // Check timeout
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current
      const remaining = Math.max(0, timeout - elapsed)

      setTimeRemaining(remaining)

      // Warning state
      if (remaining <= warningTime && remaining > 0 && !warningFiredRef.current) {
        setIsWarning(true)
        warningFiredRef.current = true
        onWarning?.()
      }

      // Expired state
      if (remaining === 0 && !isExpired) {
        setIsExpired(true)
        setIsWarning(false)
        onExpire?.()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [timeout, warningTime, isExpired, onWarning, onExpire])

  return {
    timeRemaining,
    isWarning,
    isExpired,
    resetSession,
  }
}

/**
 * Hook to track time spent on page
 */
export function useTimeOnPage(): number {
  const [timeSpent, setTimeSpent] = useState(0)
  const startTimeRef = useRef(Date.now())
  const visibleTimeRef = useRef(0)
  const wasVisibleRef = useRef(true)

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page became hidden, save current time
        visibleTimeRef.current += Date.now() - startTimeRef.current
        wasVisibleRef.current = false
      } else {
        // Page became visible again
        startTimeRef.current = Date.now()
        wasVisibleRef.current = true
      }
    }

    const interval = setInterval(() => {
      if (!document.hidden) {
        const currentTime = visibleTimeRef.current + (Date.now() - startTimeRef.current)
        setTimeSpent(Math.floor(currentTime / 1000))
      }
    }, 1000)

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  return timeSpent
}

/**
 * Format seconds to human readable string
 */
export function formatTimeSpent(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`
}
