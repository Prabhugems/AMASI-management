"use client"

import { useState, useEffect, useCallback } from "react"

/**
 * Hook to detect online/offline status
 *
 * Usage:
 * ```
 * const isOnline = useOnlineStatus()
 *
 * if (!isOnline) {
 *   return <OfflineBanner />
 * }
 * ```
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return isOnline
}

/**
 * Hook with online status and callbacks
 *
 * Usage:
 * ```
 * const { isOnline } = useNetworkStatus({
 *   onOnline: () => toast.success("Back online!"),
 *   onOffline: () => toast.error("You're offline")
 * })
 * ```
 */
export function useNetworkStatus(options: {
  onOnline?: () => void
  onOffline?: () => void
} = {}): {
  isOnline: boolean
  wasOffline: boolean
} {
  const { onOnline, onOffline } = options
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  )
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      if (wasOffline) {
        onOnline?.()
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      setWasOffline(true)
      onOffline?.()
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [onOnline, onOffline, wasOffline])

  return { isOnline, wasOffline }
}

/**
 * Hook to detect slow/fast connection
 *
 * Uses Network Information API where available
 */
export function useConnectionQuality(): {
  isOnline: boolean
  effectiveType: "slow-2g" | "2g" | "3g" | "4g" | "unknown"
  downlink: number | null
  rtt: number | null
  saveData: boolean
} {
  const [quality, setQuality] = useState<{
    effectiveType: "slow-2g" | "2g" | "3g" | "4g" | "unknown"
    downlink: number | null
    rtt: number | null
    saveData: boolean
  }>({
    effectiveType: "unknown",
    downlink: null,
    rtt: null,
    saveData: false,
  })

  const isOnline = useOnlineStatus()

  useEffect(() => {
    const connection = (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection

    if (!connection) return

    const updateQuality = () => {
      setQuality({
        effectiveType: connection.effectiveType || "unknown",
        downlink: connection.downlink || null,
        rtt: connection.rtt || null,
        saveData: connection.saveData || false,
      })
    }

    updateQuality()
    connection.addEventListener("change", updateQuality)

    return () => {
      connection.removeEventListener("change", updateQuality)
    }
  }, [])

  return { isOnline, ...quality }
}

/**
 * Hook to check if connection is slow
 */
export function useIsSlowConnection(): boolean {
  const { effectiveType, isOnline } = useConnectionQuality()

  if (!isOnline) return true
  return effectiveType === "slow-2g" || effectiveType === "2g"
}

/**
 * Hook for offline-capable operations
 *
 * Queues operations when offline and executes when back online
 *
 * Usage:
 * ```
 * const { execute, pendingCount } = useOfflineQueue<SaveData>({
 *   processor: async (data) => {
 *     await api.save(data)
 *   }
 * })
 *
 * // Will queue if offline, execute immediately if online
 * execute({ name: "John" })
 * ```
 */
export function useOfflineQueue<T>(options: {
  processor: (item: T) => Promise<void>
  onProcessed?: (item: T) => void
  onError?: (error: Error, item: T) => void
  storageKey?: string
}): {
  execute: (item: T) => void
  pendingCount: number
  isProcessing: boolean
  clearQueue: () => void
} {
  const { processor, onProcessed, onError, storageKey } = options
  const isOnline = useOnlineStatus()
  const [queue, setQueue] = useState<T[]>(() => {
    if (storageKey && typeof localStorage !== "undefined") {
      try {
        const stored = localStorage.getItem(storageKey)
        return stored ? JSON.parse(stored) : []
      } catch {
        return []
      }
    }
    return []
  })
  const [isProcessing, setIsProcessing] = useState(false)

  // Persist queue to localStorage
  useEffect(() => {
    if (storageKey && typeof localStorage !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(queue))
    }
  }, [queue, storageKey])

  // Process queue when online
  useEffect(() => {
    if (!isOnline || queue.length === 0 || isProcessing) return

    const processQueue = async () => {
      setIsProcessing(true)

      while (queue.length > 0) {
        const item = queue[0]
        try {
          await processor(item)
          setQueue((q) => q.slice(1))
          onProcessed?.(item)
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err))
          onError?.(error, item)
          // Stop processing on error
          break
        }
      }

      setIsProcessing(false)
    }

    processQueue()
  }, [isOnline, queue, isProcessing, processor, onProcessed, onError])

  const execute = useCallback(
    (item: T) => {
      if (isOnline && queue.length === 0 && !isProcessing) {
        // Execute immediately
        processor(item)
          .then(() => onProcessed?.(item))
          .catch((err) => {
            const error = err instanceof Error ? err : new Error(String(err))
            onError?.(error, item)
            // Queue for retry
            setQueue((q) => [...q, item])
          })
      } else {
        // Add to queue
        setQueue((q) => [...q, item])
      }
    },
    [isOnline, queue.length, isProcessing, processor, onProcessed, onError]
  )

  const clearQueue = useCallback(() => {
    setQueue([])
  }, [])

  return {
    execute,
    pendingCount: queue.length,
    isProcessing,
    clearQueue,
  }
}
