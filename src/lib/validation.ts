/**
 * Input validation utilities for API routes
 */

// Email validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email)
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  return UUID_REGEX.test(uuid)
}

/**
 * Sanitize search input to prevent SQL injection
 */
export function sanitizeSearchInput(input: string, maxLength = 100): string {
  return input
    .replace(/[%_\\]/g, '\\$&') // Escape SQL wildcards
    .replace(/['"`;]/g, '') // Remove dangerous characters
    .substring(0, maxLength) // Limit length
}

/**
 * Validate and clamp pagination parameters
 */
export function validatePagination(
  page: number | string | null,
  limit: number | string | null,
  maxLimit = 100
): { page: number; limit: number; offset: number } {
  const parsedPage = Math.max(1, parseInt(String(page || '1'), 10) || 1)
  const parsedLimit = Math.min(maxLimit, Math.max(1, parseInt(String(limit || '50'), 10) || 50))
  const offset = (parsedPage - 1) * parsedLimit

  return { page: parsedPage, limit: parsedLimit, offset }
}

/**
 * Validate array of UUIDs
 */
export function validateUUIDArray(ids: unknown, maxLength = 100): { valid: boolean; ids: string[]; error?: string } {
  if (!Array.isArray(ids)) {
    return { valid: false, ids: [], error: 'Expected an array' }
  }

  if (ids.length > maxLength) {
    return { valid: false, ids: [], error: `Array exceeds maximum length of ${maxLength}` }
  }

  const validIds: string[] = []
  for (const id of ids) {
    if (typeof id !== 'string' || !isValidUUID(id)) {
      return { valid: false, ids: [], error: `Invalid UUID: ${id}` }
    }
    validIds.push(id)
  }

  return { valid: true, ids: validIds }
}

/**
 * Sanitize string input (remove potential XSS/injection characters)
 */
export function sanitizeString(input: string, maxLength = 500): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .substring(0, maxLength)
}

/**
 * Validate positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && value > 0
}

/**
 * Validate non-negative number
 */
export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && value >= 0
}

/**
 * Validate discount value based on type
 */
export function validateDiscountValue(
  type: 'percentage' | 'fixed',
  value: number
): { valid: boolean; error?: string } {
  if (!isPositiveNumber(value)) {
    return { valid: false, error: 'Discount value must be a positive number' }
  }

  if (type === 'percentage' && value > 100) {
    return { valid: false, error: 'Percentage discount cannot exceed 100%' }
  }

  return { valid: true }
}

/**
 * Rate limit check helper (to be used with a store)
 */
export function createRateLimiter(windowMs: number, maxRequests: number) {
  const requests = new Map<string, { count: number; resetAt: number }>()

  return {
    check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
      const now = Date.now()
      const record = requests.get(key)

      if (!record || now > record.resetAt) {
        requests.set(key, { count: 1, resetAt: now + windowMs })
        return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs }
      }

      if (record.count >= maxRequests) {
        return { allowed: false, remaining: 0, resetAt: record.resetAt }
      }

      record.count++
      return { allowed: true, remaining: maxRequests - record.count, resetAt: record.resetAt }
    },

    reset(key: string): void {
      requests.delete(key)
    },
  }
}
