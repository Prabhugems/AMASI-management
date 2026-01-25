"use client"

import { useState, useEffect, useCallback } from "react"

/**
 * Hook for matching media queries
 *
 * Usage:
 * ```
 * const isMobile = useMediaQuery("(max-width: 768px)")
 * const prefersDark = useMediaQuery("(prefers-color-scheme: dark)")
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    setMatches(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    mediaQuery.addEventListener("change", handler)
    return () => mediaQuery.removeEventListener("change", handler)
  }, [query])

  return matches
}

// ==================== Breakpoint Hooks ====================

/**
 * Tailwind CSS breakpoints
 */
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const

type Breakpoint = keyof typeof breakpoints

/**
 * Hook to check if viewport is at least a certain breakpoint
 *
 * Usage:
 * ```
 * const isDesktop = useBreakpoint("lg")
 * ```
 */
export function useBreakpoint(breakpoint: Breakpoint): boolean {
  return useMediaQuery(`(min-width: ${breakpoints[breakpoint]}px)`)
}

/**
 * Hook to check if viewport is below a certain breakpoint
 */
export function useBreakpointDown(breakpoint: Breakpoint): boolean {
  return useMediaQuery(`(max-width: ${breakpoints[breakpoint] - 1}px)`)
}

/**
 * Hook to get current breakpoint name
 *
 * Usage:
 * ```
 * const breakpoint = useCurrentBreakpoint()
 * // Returns: "sm" | "md" | "lg" | "xl" | "2xl"
 * ```
 */
export function useCurrentBreakpoint(): Breakpoint | "xs" {
  const isSm = useBreakpoint("sm")
  const isMd = useBreakpoint("md")
  const isLg = useBreakpoint("lg")
  const isXl = useBreakpoint("xl")
  const is2xl = useBreakpoint("2xl")

  if (is2xl) return "2xl"
  if (isXl) return "xl"
  if (isLg) return "lg"
  if (isMd) return "md"
  if (isSm) return "sm"
  return "xs"
}

/**
 * Hook for responsive values based on breakpoint
 *
 * Usage:
 * ```
 * const columns = useResponsiveValue({ xs: 1, sm: 2, md: 3, lg: 4 })
 * ```
 */
export function useResponsiveValue<T>(values: Partial<Record<Breakpoint | "xs", T>>): T | undefined {
  const breakpoint = useCurrentBreakpoint()

  // Find the value for the current or nearest smaller breakpoint
  const breakpointOrder: (Breakpoint | "xs")[] = ["xs", "sm", "md", "lg", "xl", "2xl"]
  const currentIndex = breakpointOrder.indexOf(breakpoint)

  for (let i = currentIndex; i >= 0; i--) {
    const bp = breakpointOrder[i]
    if (values[bp] !== undefined) {
      return values[bp]
    }
  }

  return undefined
}

// ==================== Device Detection Hooks ====================

/**
 * Hook to detect if device is mobile
 */
export function useIsMobile(): boolean {
  return useBreakpointDown("md")
}

/**
 * Hook to detect if device is tablet
 */
export function useIsTablet(): boolean {
  const isMd = useBreakpoint("md")
  const isLg = useBreakpoint("lg")
  return isMd && !isLg
}

/**
 * Hook to detect if device is desktop
 */
export function useIsDesktop(): boolean {
  return useBreakpoint("lg")
}

/**
 * Hook to detect touch device
 */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    setIsTouch(
      "ontouchstart" in window ||
        navigator.maxTouchPoints > 0
    )
  }, [])

  return isTouch
}

// ==================== Preference Hooks ====================

/**
 * Hook to detect dark mode preference
 */
export function usePrefersDarkMode(): boolean {
  return useMediaQuery("(prefers-color-scheme: dark)")
}

/**
 * Hook to detect reduced motion preference
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)")
}

/**
 * Hook to detect high contrast preference
 */
export function usePrefersHighContrast(): boolean {
  return useMediaQuery("(prefers-contrast: high)")
}

// ==================== Orientation Hooks ====================

/**
 * Hook to detect landscape orientation
 */
export function useIsLandscape(): boolean {
  return useMediaQuery("(orientation: landscape)")
}

/**
 * Hook to detect portrait orientation
 */
export function useIsPortrait(): boolean {
  return useMediaQuery("(orientation: portrait)")
}

// ==================== Window Size Hook ====================

interface WindowSize {
  width: number
  height: number
}

/**
 * Hook to get window dimensions
 *
 * Usage:
 * ```
 * const { width, height } = useWindowSize()
 * ```
 */
export function useWindowSize(): WindowSize {
  const [size, setSize] = useState<WindowSize>({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  })

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return size
}

/**
 * Hook for debounced window size (prevents excessive re-renders)
 */
export function useDebouncedWindowSize(delay: number = 100): WindowSize {
  const [size, setSize] = useState<WindowSize>({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  })

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setSize({
          width: window.innerWidth,
          height: window.innerHeight,
        })
      }, delay)
    }

    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
      clearTimeout(timeoutId)
    }
  }, [delay])

  return size
}

// ==================== Container Query Hook ====================

/**
 * Hook to observe element size (like container queries)
 *
 * Usage:
 * ```
 * const { ref, width, height } = useElementSize()
 * return <div ref={ref}>Width: {width}px</div>
 * ```
 */
export function useElementSize<T extends HTMLElement = HTMLDivElement>(): {
  ref: React.RefObject<T>
  width: number
  height: number
} {
  const ref = useCallback((node: T | null) => {
    if (node) {
      elementRef.current = node
      observerRef.current?.observe(node)
    }
  }, []) as unknown as React.RefObject<T>

  const elementRef = { current: null as T | null }
  const observerRef = { current: null as ResizeObserver | null }

  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    observerRef.current = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })

    return () => {
      observerRef.current?.disconnect()
    }
  }, [])

  return { ref, ...size }
}
