/**
 * Retry Utility
 *
 * Exponential backoff and retry logic for failed operations
 */

interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number
  /** Add random jitter to delays (default: true) */
  jitter?: boolean
  /** Function to determine if error is retryable */
  retryIf?: (error: Error) => boolean
  /** Callback on each retry */
  onRetry?: (error: Error, attempt: number, delay: number) => void
}

/**
 * Retry a function with exponential backoff
 *
 * Usage:
 * ```
 * const result = await retry(
 *   () => fetch('/api/data'),
 *   {
 *     maxAttempts: 3,
 *     onRetry: (error, attempt) => console.log(`Retry ${attempt}:`, error)
 *   }
 * )
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    jitter = true,
    retryIf = () => true,
    onRetry,
  } = options

  let lastError: Error
  let delay = initialDelay

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry if we've exhausted attempts or error isn't retryable
      if (attempt === maxAttempts || !retryIf(lastError)) {
        throw lastError
      }

      // Calculate delay with optional jitter
      let currentDelay = Math.min(delay, maxDelay)
      if (jitter) {
        currentDelay = currentDelay * (0.5 + Math.random())
      }

      // Notify about retry
      onRetry?.(lastError, attempt, currentDelay)

      // Wait before next attempt
      await sleep(currentDelay)

      // Increase delay for next iteration
      delay *= backoffMultiplier
    }
  }

  throw lastError!
}

/**
 * Retry with fetch-specific handling
 *
 * Automatically retries on network errors and 5xx responses
 */
export async function retryFetch(
  url: string,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  return retry(
    async () => {
      const response = await fetch(url, init)

      // Throw on 5xx errors to trigger retry
      if (response.status >= 500) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return response
    },
    {
      ...options,
      retryIf: (error) => {
        // Retry on network errors
        if (error.name === "TypeError" && error.message.includes("fetch")) {
          return true
        }
        // Retry on 5xx errors
        if (error.message.startsWith("HTTP 5")) {
          return true
        }
        // Use custom retryIf if provided
        return options.retryIf?.(error) ?? true
      },
    }
  )
}

/**
 * Create a retryable version of any async function
 *
 * Usage:
 * ```
 * const retryableSave = withRetry(saveData, { maxAttempts: 3 })
 * await retryableSave(data)
 * ```
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return ((...args: Parameters<T>) => retry(() => fn(...args), options)) as T
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Timeout wrapper - fails if operation takes too long
 *
 * Usage:
 * ```
 * const result = await withTimeout(fetchData(), 5000)
 * ```
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError?: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutError || `Operation timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timeoutId!)
  }
}

/**
 * Retry with timeout per attempt
 */
export async function retryWithTimeout<T>(
  fn: () => Promise<T>,
  options: RetryOptions & { timeout?: number } = {}
): Promise<T> {
  const { timeout = 10000, ...retryOptions } = options

  return retry(
    () => withTimeout(fn(), timeout),
    retryOptions
  )
}

/**
 * Circuit breaker pattern
 *
 * Stops retrying after too many failures
 */
export class CircuitBreaker {
  private failures = 0
  private lastFailure: number | null = null
  private state: "closed" | "open" | "half-open" = "closed"

  constructor(
    private options: {
      failureThreshold?: number
      resetTimeout?: number
    } = {}
  ) {}

  private get failureThreshold() {
    return this.options.failureThreshold ?? 5
  }

  private get resetTimeout() {
    return this.options.resetTimeout ?? 60000
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should reset
    if (
      this.state === "open" &&
      this.lastFailure &&
      Date.now() - this.lastFailure >= this.resetTimeout
    ) {
      this.state = "half-open"
    }

    // Fail fast if circuit is open
    if (this.state === "open") {
      throw new Error("Circuit breaker is open")
    }

    try {
      const result = await fn()

      // Reset on success
      if (this.state === "half-open") {
        this.state = "closed"
        this.failures = 0
      }

      return result
    } catch (error) {
      this.failures++
      this.lastFailure = Date.now()

      // Open circuit if threshold reached
      if (this.failures >= this.failureThreshold) {
        this.state = "open"
      }

      throw error
    }
  }

  reset() {
    this.failures = 0
    this.lastFailure = null
    this.state = "closed"
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailure,
    }
  }
}

/**
 * Rate limiter for client-side operations
 */
export class RateLimiter {
  private tokens: number
  private lastRefill: number

  constructor(
    private options: {
      maxTokens?: number
      refillRate?: number // tokens per second
    } = {}
  ) {
    this.tokens = this.maxTokens
    this.lastRefill = Date.now()
  }

  private get maxTokens() {
    return this.options.maxTokens ?? 10
  }

  private get refillRate() {
    return this.options.refillRate ?? 1
  }

  private refill() {
    const now = Date.now()
    const elapsed = (now - this.lastRefill) / 1000
    const newTokens = elapsed * this.refillRate

    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens)
    this.lastRefill = now
  }

  async acquire(): Promise<void> {
    this.refill()

    if (this.tokens >= 1) {
      this.tokens--
      return
    }

    // Wait for token to be available
    const waitTime = ((1 - this.tokens) / this.refillRate) * 1000
    await sleep(waitTime)
    this.tokens = 0
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    return fn()
  }
}
