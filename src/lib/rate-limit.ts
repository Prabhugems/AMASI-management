/**
 * Rate Limiting Utility
 *
 * Implements a sliding window rate limiter with in-memory storage.
 * Can be upgraded to Redis/Upstash for distributed deployments.
 */

// Rate limit configuration tiers
export const RATE_LIMIT_TIERS = {
  // Strict: For sensitive endpoints (auth, password reset)
  strict: { requests: 5, windowMs: 60 * 1000 }, // 5 requests per minute

  // Public: For public-facing endpoints (registration, forms)
  public: { requests: 30, windowMs: 60 * 1000 }, // 30 requests per minute

  // Authenticated: For logged-in users
  authenticated: { requests: 100, windowMs: 60 * 1000 }, // 100 requests per minute

  // Bulk: For bulk operations
  bulk: { requests: 10, windowMs: 60 * 1000 }, // 10 requests per minute

  // Webhook: For payment webhooks (higher limit, verified by signature)
  webhook: { requests: 200, windowMs: 60 * 1000 }, // 200 requests per minute
} as const

export type RateLimitTier = keyof typeof RATE_LIMIT_TIERS

// In-memory store for rate limiting
// In production with multiple instances, use Redis/Upstash
interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number // Unix timestamp when the rate limit resets
  retryAfter?: number // Seconds until retry is allowed
}

/**
 * Check rate limit for a given identifier
 */
export function checkRateLimit(
  identifier: string,
  tier: RateLimitTier = 'public'
): RateLimitResult {
  const config = RATE_LIMIT_TIERS[tier]
  const now = Date.now()
  const key = `${tier}:${identifier}`

  let entry = rateLimitStore.get(key)

  // If no entry or expired, create new one
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + config.windowMs,
    }
    rateLimitStore.set(key, entry)

    return {
      success: true,
      limit: config.requests,
      remaining: config.requests - 1,
      reset: Math.floor(entry.resetAt / 1000),
    }
  }

  // Increment count
  entry.count++

  // Check if over limit
  if (entry.count > config.requests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return {
      success: false,
      limit: config.requests,
      remaining: 0,
      reset: Math.floor(entry.resetAt / 1000),
      retryAfter,
    }
  }

  return {
    success: true,
    limit: config.requests,
    remaining: config.requests - entry.count,
    reset: Math.floor(entry.resetAt / 1000),
  }
}

/**
 * Get client IP from request headers
 * Handles various proxy configurations
 */
export function getClientIp(request: Request): string {
  // Check various headers in order of preference
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // Take the first IP in the chain (original client)
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp.trim()
  }

  // Fallback for local development
  return '127.0.0.1'
}

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  }

  if (result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString()
  }

  return headers
}

/**
 * Rate limit response helper
 */
export function rateLimitExceededResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`,
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...createRateLimitHeaders(result),
      },
    }
  )
}
