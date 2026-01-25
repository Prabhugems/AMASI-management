"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface VirtualListProps<T> {
  items: T[]
  height: number
  itemHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  overscan?: number
  className?: string
  onEndReached?: () => void
  endReachedThreshold?: number
}

/**
 * Virtual List Component
 *
 * Efficiently render large lists by only rendering visible items
 *
 * Usage:
 * ```
 * <VirtualList
 *   items={users}
 *   height={400}
 *   itemHeight={50}
 *   renderItem={(user, index) => <UserRow user={user} />}
 *   onEndReached={() => loadMore()}
 * />
 * ```
 */
export function VirtualList<T>({
  items,
  height,
  itemHeight,
  renderItem,
  overscan = 3,
  className,
  onEndReached,
  endReachedThreshold = 0.8,
}: VirtualListProps<T>) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = React.useState(0)
  const [isScrolling, setIsScrolling] = React.useState(false)
  const scrollTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const endReachedRef = React.useRef(false)

  const totalHeight = items.length * itemHeight

  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(
    items.length - 1,
    Math.floor((scrollTop + height) / itemHeight) + overscan
  )

  const visibleItems = React.useMemo(() => {
    const result: Array<{ item: T; index: number; style: React.CSSProperties }> = []
    for (let i = startIndex; i <= endIndex; i++) {
      result.push({
        item: items[i],
        index: i,
        style: {
          position: "absolute",
          top: i * itemHeight,
          left: 0,
          right: 0,
          height: itemHeight,
        },
      })
    }
    return result
  }, [items, startIndex, endIndex, itemHeight])

  const handleScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement
      setScrollTop(target.scrollTop)
      setIsScrolling(true)

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }

      // Set scrolling to false after scroll ends
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false)
      }, 150)

      // Check for end reached
      const scrollPercent =
        (target.scrollTop + target.clientHeight) / target.scrollHeight
      if (scrollPercent >= endReachedThreshold && !endReachedRef.current) {
        endReachedRef.current = true
        onEndReached?.()
      }

      if (scrollPercent < endReachedThreshold) {
        endReachedRef.current = false
      }
    },
    [endReachedThreshold, onEndReached]
  )

  React.useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn("overflow-auto relative", className)}
      style={{ height }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {visibleItems.map(({ item, index, style }) => (
          <div key={index} style={style}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Variable height virtual list
 */
interface VariableVirtualListProps<T> {
  items: T[]
  height: number
  estimatedItemHeight: number
  renderItem: (item: T, index: number, measureRef: (el: HTMLElement | null) => void) => React.ReactNode
  overscan?: number
  className?: string
}

export function VariableVirtualList<T>({
  items,
  height,
  estimatedItemHeight,
  renderItem,
  overscan = 3,
  className,
}: VariableVirtualListProps<T>) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = React.useState(0)
  const [measuredHeights, setMeasuredHeights] = React.useState<Map<number, number>>(new Map())

  // Calculate positions
  const { positions, totalHeight } = React.useMemo(() => {
    const positions: Array<{ top: number; height: number }> = []
    let currentTop = 0

    for (let i = 0; i < items.length; i++) {
      const itemHeight = measuredHeights.get(i) || estimatedItemHeight
      positions.push({ top: currentTop, height: itemHeight })
      currentTop += itemHeight
    }

    return { positions, totalHeight: currentTop }
  }, [items.length, measuredHeights, estimatedItemHeight])

  // Find visible range using binary search
  const { startIndex, endIndex } = React.useMemo(() => {
    let start = 0
    let end = positions.length - 1

    // Find start index
    while (start < end) {
      const mid = Math.floor((start + end) / 2)
      if (positions[mid].top + positions[mid].height < scrollTop) {
        start = mid + 1
      } else {
        end = mid
      }
    }
    const startIdx = Math.max(0, start - overscan)

    // Find end index
    start = startIdx
    end = positions.length - 1
    while (start < end) {
      const mid = Math.ceil((start + end) / 2)
      if (positions[mid].top > scrollTop + height) {
        end = mid - 1
      } else {
        start = mid
      }
    }
    const endIdx = Math.min(positions.length - 1, end + overscan)

    return { startIndex: startIdx, endIndex: endIdx }
  }, [positions, scrollTop, height, overscan])

  const createMeasureRef = React.useCallback(
    (index: number) => (el: HTMLElement | null) => {
      if (el) {
        const measuredHeight = el.getBoundingClientRect().height
        if (measuredHeight !== measuredHeights.get(index)) {
          setMeasuredHeights((prev) => {
            const next = new Map(prev)
            next.set(index, measuredHeight)
            return next
          })
        }
      }
    },
    [measuredHeights]
  )

  const visibleItems = React.useMemo(() => {
    const result: Array<{ item: T; index: number; style: React.CSSProperties }> = []
    for (let i = startIndex; i <= endIndex; i++) {
      result.push({
        item: items[i],
        index: i,
        style: {
          position: "absolute",
          top: positions[i].top,
          left: 0,
          right: 0,
        },
      })
    }
    return result
  }, [items, startIndex, endIndex, positions])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop((e.target as HTMLDivElement).scrollTop)
  }

  return (
    <div
      ref={containerRef}
      className={cn("overflow-auto relative", className)}
      style={{ height }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {visibleItems.map(({ item, index, style }) => (
          <div key={index} style={style}>
            {renderItem(item, index, createMeasureRef(index))}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Grid virtual list
 */
interface VirtualGridProps<T> {
  items: T[]
  height: number
  itemHeight: number
  itemWidth: number
  columnCount?: number
  renderItem: (item: T, index: number) => React.ReactNode
  overscan?: number
  gap?: number
  className?: string
}

export function VirtualGrid<T>({
  items,
  height,
  itemHeight,
  itemWidth,
  columnCount: forcedColumnCount,
  renderItem,
  overscan = 2,
  gap = 0,
  className,
}: VirtualGridProps<T>) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = React.useState(0)
  const [containerWidth, setContainerWidth] = React.useState(0)

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width)
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const columnCount = forcedColumnCount || Math.max(1, Math.floor(containerWidth / (itemWidth + gap)))
  const rowCount = Math.ceil(items.length / columnCount)
  const totalHeight = rowCount * (itemHeight + gap)

  const startRow = Math.max(0, Math.floor(scrollTop / (itemHeight + gap)) - overscan)
  const endRow = Math.min(
    rowCount - 1,
    Math.floor((scrollTop + height) / (itemHeight + gap)) + overscan
  )

  const visibleItems = React.useMemo(() => {
    const result: Array<{
      item: T
      index: number
      style: React.CSSProperties
    }> = []

    for (let row = startRow; row <= endRow; row++) {
      for (let col = 0; col < columnCount; col++) {
        const index = row * columnCount + col
        if (index >= items.length) break

        result.push({
          item: items[index],
          index,
          style: {
            position: "absolute",
            top: row * (itemHeight + gap),
            left: col * (itemWidth + gap),
            width: itemWidth,
            height: itemHeight,
          },
        })
      }
    }

    return result
  }, [items, startRow, endRow, columnCount, itemHeight, itemWidth, gap])

  return (
    <div
      ref={containerRef}
      className={cn("overflow-auto relative", className)}
      style={{ height }}
      onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {visibleItems.map(({ item, index, style }) => (
          <div key={index} style={style}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  )
}
