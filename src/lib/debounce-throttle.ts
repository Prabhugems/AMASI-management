/**
 * Debounce and Throttle Utilities
 *
 * Rate limiting for function calls
 */

/**
 * Debounce a function
 *
 * Usage:
 * ```
 * const debouncedSearch = debounce((query: string) => search(query), 300)
 * input.addEventListener("input", (e) => debouncedSearch(e.target.value))
 * ```
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): ((...args: Parameters<T>) => void) & { cancel: () => void; flush: () => void } {
  const { leading = false, trailing = true } = options
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<T> | null = null
  let lastCallTime: number | null = null
  let leadingCalled = false

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    lastArgs = null
    lastCallTime = null
    leadingCalled = false
  }

  const flush = () => {
    if (timeoutId && lastArgs) {
      fn(...lastArgs)
      cancel()
    }
  }

  const debounced = (...args: Parameters<T>) => {
    const now = Date.now()
    lastArgs = args
    lastCallTime = now

    // Leading edge call
    if (leading && !leadingCalled) {
      leadingCalled = true
      fn(...args)
      return
    }

    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    // Set new timeout for trailing edge
    if (trailing) {
      timeoutId = setTimeout(() => {
        if (lastArgs) {
          fn(...lastArgs)
        }
        cancel()
      }, delay)
    }
  }

  debounced.cancel = cancel
  debounced.flush = flush

  return debounced
}

/**
 * Throttle a function
 *
 * Usage:
 * ```
 * const throttledScroll = throttle(() => updatePosition(), 100)
 * window.addEventListener("scroll", throttledScroll)
 * ```
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  const { leading = true, trailing = true } = options
  let lastCallTime: number | null = null
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<T> | null = null

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    lastArgs = null
  }

  const throttled = (...args: Parameters<T>) => {
    const now = Date.now()
    lastArgs = args

    // First call or enough time has passed
    if (lastCallTime === null || now - lastCallTime >= limit) {
      if (leading) {
        fn(...args)
        lastCallTime = now
        return
      }
    }

    // Schedule trailing call
    if (trailing && !timeoutId) {
      const remaining = limit - (now - (lastCallTime || 0))
      timeoutId = setTimeout(() => {
        if (lastArgs) {
          fn(...lastArgs)
          lastCallTime = Date.now()
        }
        timeoutId = null
      }, remaining)
    }
  }

  throttled.cancel = cancel

  return throttled
}

/**
 * Request animation frame throttle (for visual updates)
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  fn: T
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let frameId: number | null = null
  let lastArgs: Parameters<T> | null = null

  const cancel = () => {
    if (frameId) {
      cancelAnimationFrame(frameId)
      frameId = null
    }
  }

  const throttled = (...args: Parameters<T>) => {
    lastArgs = args

    if (frameId === null) {
      frameId = requestAnimationFrame(() => {
        if (lastArgs) {
          fn(...lastArgs)
        }
        frameId = null
      })
    }
  }

  throttled.cancel = cancel

  return throttled
}

/**
 * Create a debounced async function that only resolves the latest call
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let latestResolve: ((value: Awaited<ReturnType<T>>) => void) | null = null
  let latestReject: ((reason: any) => void) | null = null

  return (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    return new Promise((resolve, reject) => {
      // Store the latest resolve/reject
      latestResolve = resolve
      latestReject = reject

      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args)
          // Only resolve if this is still the latest call
          if (latestResolve === resolve) {
            resolve(result)
          }
        } catch (error) {
          if (latestReject === reject) {
            reject(error)
          }
        }
      }, delay)
    })
  }
}

/**
 * Leading edge debounce (fires immediately, then debounces)
 */
export function debounceLeading<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  return debounce(fn, delay, { leading: true, trailing: false })
}

/**
 * Trailing edge throttle (fires at end of limit period)
 */
export function throttleTrailing<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  return throttle(fn, limit, { leading: false, trailing: true })
}

/**
 * Debounce with a maximum wait time
 */
export function debounceMaxWait<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
  maxWait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let maxTimeoutId: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<T> | null = null
  let startTime: number | null = null

  return (...args: Parameters<T>) => {
    lastArgs = args
    const now = Date.now()

    if (startTime === null) {
      startTime = now
    }

    // Clear existing debounce timeout
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    // Set up max wait timeout
    if (!maxTimeoutId) {
      maxTimeoutId = setTimeout(() => {
        if (lastArgs) {
          fn(...lastArgs)
        }
        timeoutId = null
        maxTimeoutId = null
        startTime = null
        lastArgs = null
      }, maxWait)
    }

    // Set up debounce timeout
    const remaining = maxWait - (now - startTime)
    const actualDelay = Math.min(delay, remaining)

    timeoutId = setTimeout(() => {
      if (maxTimeoutId) {
        clearTimeout(maxTimeoutId)
        maxTimeoutId = null
      }
      if (lastArgs) {
        fn(...lastArgs)
      }
      timeoutId = null
      startTime = null
      lastArgs = null
    }, actualDelay)
  }
}
