"use client"

import { useRef, useEffect } from "react"

/**
 * Hook to get previous value of a variable
 *
 * Usage:
 * ```
 * const [count, setCount] = useState(0)
 * const previousCount = usePrevious(count)
 *
 * // previousCount will be the value from the previous render
 * ```
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined)

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref.current
}

/**
 * Hook to get previous value with initial value
 */
export function usePreviousWithInitial<T>(value: T, initialValue: T): T {
  const ref = useRef<T>(initialValue)

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref.current
}

/**
 * Hook to track value changes
 *
 * Usage:
 * ```
 * const { current, previous, hasChanged } = useValueChange(count)
 *
 * if (hasChanged) {
 *   console.log(`Changed from ${previous} to ${current}`)
 * }
 * ```
 */
export function useValueChange<T>(value: T): {
  current: T
  previous: T | undefined
  hasChanged: boolean
} {
  const previousValue = usePrevious(value)

  return {
    current: value,
    previous: previousValue,
    hasChanged: previousValue !== undefined && previousValue !== value,
  }
}

/**
 * Hook to run effect only when value changes from specific value
 *
 * Usage:
 * ```
 * useEffectOnChange(isOpen, true, false, () => {
 *   // Runs when isOpen changes from true to false
 *   console.log("Modal closed")
 * })
 * ```
 */
export function useEffectOnChange<T>(
  value: T,
  fromValue: T,
  toValue: T,
  effect: () => void | (() => void)
) {
  const previousValue = usePrevious(value)

  useEffect(() => {
    if (previousValue === fromValue && value === toValue) {
      return effect()
    }
  }, [value, previousValue, fromValue, toValue, effect])
}

/**
 * Hook to run effect only on value increase/decrease
 *
 * Usage:
 * ```
 * useEffectOnIncrease(count, () => {
 *   console.log("Count increased!")
 * })
 * ```
 */
export function useEffectOnIncrease(
  value: number,
  effect: (previous: number, current: number) => void
) {
  const previousValue = usePrevious(value)

  useEffect(() => {
    if (previousValue !== undefined && value > previousValue) {
      effect(previousValue, value)
    }
  }, [value, previousValue, effect])
}

export function useEffectOnDecrease(
  value: number,
  effect: (previous: number, current: number) => void
) {
  const previousValue = usePrevious(value)

  useEffect(() => {
    if (previousValue !== undefined && value < previousValue) {
      effect(previousValue, value)
    }
  }, [value, previousValue, effect])
}

/**
 * Hook to track history of values
 *
 * Usage:
 * ```
 * const { history, current, back, forward, canGoBack, canGoForward } = useHistory(value)
 * ```
 */
export function useHistory<T>(
  value: T,
  maxHistory: number = 10
): {
  history: T[]
  current: T
  index: number
  back: () => T | undefined
  forward: () => T | undefined
  canGoBack: boolean
  canGoForward: boolean
  clear: () => void
} {
  const historyRef = useRef<T[]>([value])
  const indexRef = useRef(0)

  useEffect(() => {
    const currentHistory = historyRef.current
    const currentIndex = indexRef.current

    // Only add to history if value changed
    if (currentHistory[currentIndex] !== value) {
      // Remove any forward history
      const newHistory = currentHistory.slice(0, currentIndex + 1)
      newHistory.push(value)

      // Trim to max history
      if (newHistory.length > maxHistory) {
        newHistory.shift()
      } else {
        indexRef.current = newHistory.length - 1
      }

      historyRef.current = newHistory
    }
  }, [value, maxHistory])

  const back = () => {
    if (indexRef.current > 0) {
      indexRef.current--
      return historyRef.current[indexRef.current]
    }
    return undefined
  }

  const forward = () => {
    if (indexRef.current < historyRef.current.length - 1) {
      indexRef.current++
      return historyRef.current[indexRef.current]
    }
    return undefined
  }

  const clear = () => {
    historyRef.current = [value]
    indexRef.current = 0
  }

  return {
    history: historyRef.current,
    current: value,
    index: indexRef.current,
    back,
    forward,
    canGoBack: indexRef.current > 0,
    canGoForward: indexRef.current < historyRef.current.length - 1,
    clear,
  }
}

/**
 * Hook to compare with initial value
 */
export function useInitialValue<T>(value: T): {
  initial: T
  current: T
  hasChanged: boolean
  reset: () => T
} {
  const initialRef = useRef(value)
  const isFirstRenderRef = useRef(true)

  useEffect(() => {
    if (isFirstRenderRef.current) {
      initialRef.current = value
      isFirstRenderRef.current = false
    }
  }, [value])

  return {
    initial: initialRef.current,
    current: value,
    hasChanged: initialRef.current !== value,
    reset: () => initialRef.current,
  }
}
