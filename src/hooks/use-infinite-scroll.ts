"use client"

import { useEffect, useRef, useState, useCallback } from "react"

interface UseInfiniteScrollOptions<T> {
  /** Function to fetch data for a page */
  fetcher: (page: number) => Promise<T[]>
  /** Initial page number (default: 1) */
  initialPage?: number
  /** Threshold in pixels from bottom to trigger load (default: 200) */
  threshold?: number
  /** Enable infinite scroll (default: true) */
  enabled?: boolean
  /** Callback when new data is loaded */
  onLoadMore?: (newData: T[], allData: T[]) => void
  /** Callback on error */
  onError?: (error: Error) => void
}

/**
 * Hook for infinite scroll pagination
 *
 * Usage:
 * ```
 * const {
 *   data,
 *   isLoading,
 *   hasMore,
 *   sentinelRef
 * } = useInfiniteScroll({
 *   fetcher: (page) => fetchRegistrations({ page, limit: 20 }),
 *   threshold: 300
 * })
 *
 * return (
 *   <div>
 *     {data.map(item => <Card key={item.id} {...item} />)}
 *     <div ref={sentinelRef} />
 *     {isLoading && <Spinner />}
 *   </div>
 * )
 * ```
 */
export function useInfiniteScroll<T>({
  fetcher,
  initialPage = 1,
  threshold = 200,
  enabled = true,
  onLoadMore,
  onError,
}: UseInfiniteScrollOptions<T>) {
  const [data, setData] = useState<T[]>([])
  const [page, setPage] = useState(initialPage)
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadingRef = useRef(false)

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore || !enabled) return

    loadingRef.current = true
    setIsLoading(true)
    setError(null)

    try {
      const newData = await fetcher(page)

      if (newData.length === 0) {
        setHasMore(false)
      } else {
        setData((prev) => {
          const allData = [...prev, ...newData]
          onLoadMore?.(newData, allData)
          return allData
        })
        setPage((p) => p + 1)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      onError?.(error)
    } finally {
      setIsLoading(false)
      loadingRef.current = false
    }
  }, [fetcher, page, hasMore, enabled, onLoadMore, onError])

  // Reset when fetcher changes
  const reset = useCallback(() => {
    setData([])
    setPage(initialPage)
    setHasMore(true)
    setError(null)
    loadingRef.current = false
  }, [initialPage])

  // Set up intersection observer
  useEffect(() => {
    if (!enabled) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && hasMore && !loadingRef.current) {
          loadMore()
        }
      },
      {
        rootMargin: `${threshold}px`,
      }
    )

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current)
    }

    return () => {
      observerRef.current?.disconnect()
    }
  }, [enabled, hasMore, threshold, loadMore])

  // Initial load
  useEffect(() => {
    if (enabled && data.length === 0 && hasMore) {
      loadMore()
    }
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    isLoading,
    hasMore,
    error,
    sentinelRef,
    loadMore,
    reset,
  }
}

/**
 * Hook for scroll-based pagination with manual trigger
 */
export function useLoadMore<T>({
  fetcher,
  initialPage = 1,
}: {
  fetcher: (page: number) => Promise<T[]>
  initialPage?: number
}) {
  const [data, setData] = useState<T[]>([])
  const [page, setPage] = useState(initialPage)
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return

    setIsLoading(true)
    setError(null)

    try {
      const newData = await fetcher(page)

      if (newData.length === 0) {
        setHasMore(false)
      } else {
        setData((prev) => [...prev, ...newData])
        setPage((p) => p + 1)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }, [fetcher, page, isLoading, hasMore])

  const reset = useCallback(() => {
    setData([])
    setPage(initialPage)
    setHasMore(true)
    setError(null)
  }, [initialPage])

  return {
    data,
    isLoading,
    hasMore,
    error,
    loadMore,
    reset,
  }
}

/**
 * Hook for cursor-based infinite scroll
 */
export function useCursorInfiniteScroll<T, C>({
  fetcher,
  getNextCursor,
  threshold = 200,
  enabled = true,
}: {
  fetcher: (cursor: C | null) => Promise<T[]>
  getNextCursor: (data: T[]) => C | null
  threshold?: number
  enabled?: boolean
}) {
  const [data, setData] = useState<T[]>([])
  const [cursor, setCursor] = useState<C | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadingRef = useRef(false)
  const isInitialLoad = useRef(true)

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore || !enabled) return

    loadingRef.current = true
    setIsLoading(true)
    setError(null)

    try {
      const newData = await fetcher(cursor)

      if (newData.length === 0) {
        setHasMore(false)
      } else {
        setData((prev) => [...prev, ...newData])
        const nextCursor = getNextCursor(newData)
        setCursor(nextCursor)
        if (nextCursor === null) {
          setHasMore(false)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
      loadingRef.current = false
    }
  }, [fetcher, cursor, hasMore, enabled, getNextCursor])

  const reset = useCallback(() => {
    setData([])
    setCursor(null)
    setHasMore(true)
    setError(null)
    loadingRef.current = false
    isInitialLoad.current = true
  }, [])

  // Set up intersection observer
  useEffect(() => {
    if (!enabled) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && hasMore && !loadingRef.current) {
          loadMore()
        }
      },
      {
        rootMargin: `${threshold}px`,
      }
    )

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current)
    }

    return () => {
      observerRef.current?.disconnect()
    }
  }, [enabled, hasMore, threshold, loadMore])

  // Initial load
  useEffect(() => {
    if (enabled && isInitialLoad.current) {
      isInitialLoad.current = false
      loadMore()
    }
  }, [enabled, loadMore])

  return {
    data,
    isLoading,
    hasMore,
    error,
    sentinelRef,
    loadMore,
    reset,
  }
}
