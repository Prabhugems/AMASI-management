/**
 * API Utilities
 *
 * Common utilities for API routes including rate limiting, error handling, etc.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  checkRateLimit,
  getClientIp,
  createRateLimitHeaders,
  rateLimitExceededResponse,
  RateLimitTier,
} from './rate-limit'

type ApiHandler = (request: NextRequest, context?: any) => Promise<Response | NextResponse>

interface WithRateLimitOptions {
  tier?: RateLimitTier
  // Optional: Use a custom identifier instead of IP
  getIdentifier?: (request: NextRequest) => string
  // Skip rate limiting for certain conditions
  skip?: (request: NextRequest) => boolean
}

/**
 * Wrap an API handler with rate limiting
 *
 * Usage:
 * ```
 * export const POST = withRateLimit(async (request) => {
 *   // Your handler logic
 * }, { tier: 'public' })
 * ```
 */
export function withRateLimit(
  handler: ApiHandler,
  options: WithRateLimitOptions = {}
): ApiHandler {
  const { tier = 'public', getIdentifier, skip } = options

  return async (request: NextRequest, context?: any) => {
    // Check if rate limiting should be skipped
    if (skip?.(request)) {
      return handler(request, context)
    }

    // Get identifier (IP or custom)
    const identifier = getIdentifier?.(request) ?? getClientIp(request)

    // Check rate limit
    const result = checkRateLimit(identifier, tier)

    if (!result.success) {
      return rateLimitExceededResponse(result)
    }

    // Call the actual handler
    const response = await handler(request, context)

    // Add rate limit headers to response
    const headers = createRateLimitHeaders(result)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  }
}

/**
 * Create a standardized error response
 */
export function errorResponse(
  message: string,
  status: number = 500,
  details?: Record<string, any>
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      ...details,
    },
    { status }
  )
}

/**
 * Create a standardized success response
 */
export function successResponse<T>(
  data: T,
  status: number = 200
): NextResponse {
  return NextResponse.json(data, { status })
}
