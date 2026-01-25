"use client"

import { useEffect, useRef, useCallback, useState } from "react"

interface UsePollingOptions {
  /** Polling interval in milliseconds */
  interval: number
  /** Start polling immediately (default: true) */
  enabled?: boolean
  /** Stop polling when window is not visible (default: true) */
  pauseOnHidden?: boolean
  /** Stop polling on error (default: false) */
  stopOnError?: boolean
  /** Callback when polling errors */
  onError?: (error: Error) => void
}

/**
 * Hook for polling data at regular intervals
 *
 * Usage:
 * ```
 * const { data, isPolling, start, stop } = usePolling(
 *   async () => {
 *     const res = await fetch('/api/status')
 *     return res.json()
 *   },
 *   { interval: 5000 }
 * )
 * ```
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  options: UsePollingOptions
): {
  data: T | null
  error: Error | null
  isPolling: boolean
  isLoading: boolean
  start: () => void
  stop: () => void
  refresh: () => Promise<void>
} {
  const {
    interval,
    enabled = true,
    pauseOnHidden = true,
    stopOnError = false,
    onError,
  } = options

  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isPolling, setIsPolling] = useState(enabled)
  const [isLoading, setIsLoading] = useState(false)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const fetcherRef = useRef(fetcher)
  const isMountedRef = useRef(true)

  // Update fetcher ref when it changes
  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  const doFetch = useCallback(async () => {
    if (!isMountedRef.current) return

    setIsLoading(true)
    try {
      const result = await fetcherRef.current()
      if (isMountedRef.current) {
        setData(result)
        setError(null)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      if (isMountedRef.current) {
        setError(error)
        onError?.(error)
        if (stopOnError) {
          setIsPolling(false)
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [onError, stopOnError])

  const start = useCallback(() => {
    setIsPolling(true)
  }, [])

  const stop = useCallback(() => {
    setIsPolling(false)
  }, [])

  const refresh = useCallback(async () => {
    await doFetch()
  }, [doFetch])

  // Handle visibility change
  useEffect(() => {
    if (!pauseOnHidden) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Pause polling when hidden
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      } else if (isPolling) {
        // Resume polling when visible
        doFetch()
        intervalRef.current = setInterval(doFetch, interval)
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [pauseOnHidden, isPolling, interval, doFetch])

  // Main polling effect
  useEffect(() => {
    isMountedRef.current = true

    if (isPolling && !document.hidden) {
      // Initial fetch
      doFetch()

      // Set up interval
      intervalRef.current = setInterval(doFetch, interval)
    }

    return () => {
      isMountedRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isPolling, interval, doFetch])

  return {
    data,
    error,
    isPolling,
    isLoading,
    start,
    stop,
    refresh,
  }
}

/**
 * Hook for polling with automatic stop condition
 *
 * Usage:
 * ```
 * usePollingUntil(
 *   () => fetchJobStatus(jobId),
 *   (status) => status.complete,
 *   { interval: 2000, onComplete: (status) => console.log('Done!', status) }
 * )
 * ```
 */
export function usePollingUntil<T>(
  fetcher: () => Promise<T>,
  stopCondition: (data: T) => boolean,
  options: UsePollingOptions & {
    onComplete?: (data: T) => void
  }
): {
  data: T | null
  error: Error | null
  isPolling: boolean
  isComplete: boolean
} {
  const { onComplete, ...pollingOptions } = options
  const [isComplete, setIsComplete] = useState(false)

  const wrappedFetcher = useCallback(async () => {
    const result = await fetcher()
    if (stopCondition(result)) {
      setIsComplete(true)
      onComplete?.(result)
    }
    return result
  }, [fetcher, stopCondition, onComplete])

  const { data, error, isPolling, stop } = usePolling(wrappedFetcher, {
    ...pollingOptions,
    enabled: !isComplete && (pollingOptions.enabled ?? true),
  })

  // Stop polling when complete
  useEffect(() => {
    if (isComplete) {
      stop()
    }
  }, [isComplete, stop])

  return {
    data,
    error,
    isPolling: isPolling && !isComplete,
    isComplete,
  }
}

/**
 * Hook for long polling (waits for server response)
 */
export function useLongPolling<T>(
  fetcher: () => Promise<T>,
  options: {
    enabled?: boolean
    onData?: (data: T) => void
    onError?: (error: Error) => void
    retryDelay?: number
  } = {}
): {
  data: T | null
  error: Error | null
  isPolling: boolean
  stop: () => void
} {
  const {
    enabled = true,
    onData,
    onError,
    retryDelay = 1000,
  } = options

  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isPolling, setIsPolling] = useState(enabled)

  const isMountedRef = useRef(true)
  const fetcherRef = useRef(fetcher)

  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  const stop = useCallback(() => {
    setIsPolling(false)
  }, [])

  useEffect(() => {
    isMountedRef.current = true

    const poll = async () => {
      while (isMountedRef.current && isPolling) {
        try {
          const result = await fetcherRef.current()
          if (isMountedRef.current) {
            setData(result)
            setError(null)
            onData?.(result)
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err))
          if (isMountedRef.current) {
            setError(error)
            onError?.(error)
            // Wait before retrying on error
            await new Promise((resolve) => setTimeout(resolve, retryDelay))
          }
        }
      }
    }

    if (isPolling) {
      poll()
    }

    return () => {
      isMountedRef.current = false
    }
  }, [isPolling, onData, onError, retryDelay])

  return {
    data,
    error,
    isPolling,
    stop,
  }
}
