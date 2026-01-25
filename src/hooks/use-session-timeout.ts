"use client"

import { useEffect, useRef, useCallback, useState } from "react"

interface SessionTimeoutOptions {
  timeout: number // in milliseconds
  warningTime?: number // time before timeout to show warning
  onTimeout: () => void
  onWarning?: () => void
  onActivity?: () => void
  events?: string[]
  enabled?: boolean
}

/**
 * Session timeout with activity tracking
 *
 * Usage:
 * ```
 * const { remainingTime, isWarning, resetTimer } = useSessionTimeout({
 *   timeout: 30 * 60 * 1000, // 30 minutes
 *   warningTime: 5 * 60 * 1000, // 5 minute warning
 *   onTimeout: () => signOut(),
 *   onWarning: () => showTimeoutWarning(),
 * })
 * ```
 */
export function useSessionTimeout({
  timeout,
  warningTime = 60000,
  onTimeout,
  onWarning,
  onActivity,
  events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"],
  enabled = true,
}: SessionTimeoutOptions) {
  const [remainingTime, setRemainingTime] = useState(timeout)
  const [isWarning, setIsWarning] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const warningRef = useRef<NodeJS.Timeout | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef(Date.now())
  const warningShownRef = useRef(false)

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningRef.current) clearTimeout(warningRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  const resetTimer = useCallback(() => {
    clearTimers()
    lastActivityRef.current = Date.now()
    warningShownRef.current = false
    setIsWarning(false)
    setRemainingTime(timeout)

    if (!enabled) return

    // Set warning timer
    if (onWarning && warningTime < timeout) {
      warningRef.current = setTimeout(() => {
        warningShownRef.current = true
        setIsWarning(true)
        onWarning()
      }, timeout - warningTime)
    }

    // Set timeout timer
    timeoutRef.current = setTimeout(() => {
      onTimeout()
    }, timeout)

    // Update remaining time every second
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current
      const remaining = Math.max(0, timeout - elapsed)
      setRemainingTime(remaining)

      if (remaining <= warningTime && !warningShownRef.current) {
        warningShownRef.current = true
        setIsWarning(true)
        onWarning?.()
      }
    }, 1000)
  }, [timeout, warningTime, onTimeout, onWarning, enabled, clearTimers])

  const handleActivity = useCallback(() => {
    if (!enabled) return

    // Throttle activity events
    const now = Date.now()
    if (now - lastActivityRef.current < 1000) return

    resetTimer()
    onActivity?.()
  }, [enabled, resetTimer, onActivity])

  useEffect(() => {
    if (!enabled) {
      clearTimers()
      return
    }

    resetTimer()

    for (const event of events) {
      document.addEventListener(event, handleActivity, { passive: true })
    }

    return () => {
      clearTimers()
      for (const event of events) {
        document.removeEventListener(event, handleActivity)
      }
    }
  }, [enabled, events, handleActivity, resetTimer, clearTimers])

  return {
    remainingTime,
    isWarning,
    resetTimer,
    formatTime: formatTime(remainingTime),
  }
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }
  return `${remainingSeconds}s`
}

/**
 * Simple idle timeout (logout after inactivity)
 */
export function useIdleLogout(
  timeoutMs: number,
  onLogout: () => void,
  enabled = true
) {
  return useSessionTimeout({
    timeout: timeoutMs,
    onTimeout: onLogout,
    enabled,
  })
}
