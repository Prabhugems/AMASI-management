"use client"

import { useState, useEffect, useRef } from "react"

/**
 * Animated count-up hook. Counts from 0 to `end` over `duration` ms.
 * Returns the current animated value.
 */
export function useCountUp(end: number, duration: number = 800): number {
  const [value, setValue] = useState(0)
  const prevEnd = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const startValue = prevEnd.current
    prevEnd.current = end

    if (end === 0 && startValue === 0) {
      setValue(0)
      return
    }

    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(startValue + (end - startValue) * eased)
      setValue(current)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [end, duration])

  return value
}
