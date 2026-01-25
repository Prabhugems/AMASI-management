/**
 * Error Logging Utilities
 *
 * Structured error reporting and logging
 */

export interface ErrorContext {
  userId?: string
  sessionId?: string
  page?: string
  action?: string
  component?: string
  metadata?: Record<string, any>
}

export interface LoggedError {
  id: string
  timestamp: string
  message: string
  stack?: string
  type: string
  context: ErrorContext
  userAgent?: string
  url?: string
}

/**
 * Generate unique error ID
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Log an error
 */
export function logError(
  error: Error | string,
  context: ErrorContext = {}
): LoggedError {
  const errorObj = typeof error === "string" ? new Error(error) : error

  const loggedError: LoggedError = {
    id: generateErrorId(),
    timestamp: new Date().toISOString(),
    message: errorObj.message,
    stack: errorObj.stack,
    type: errorObj.name || "Error",
    context,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    url: typeof window !== "undefined" ? window.location.href : undefined,
  }

  // Console log in development
  if (process.env.NODE_ENV === "development") {
    console.error("[Error Logger]", loggedError)
  }

  // Send to error tracking service
  sendToErrorService(loggedError)

  return loggedError
}

/**
 * Send error to tracking service
 */
async function sendToErrorService(error: LoggedError): Promise<void> {
  // Send to Sentry
  if (typeof window !== "undefined" && (window as any).Sentry) {
    (window as any).Sentry.captureException(new Error(error.message), {
      extra: error.context,
      tags: {
        error_id: error.id,
        type: error.type,
      },
    })
  }

  // Send to custom endpoint
  try {
    const endpoint = process.env.NEXT_PUBLIC_ERROR_ENDPOINT
    if (endpoint) {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(error),
      })
    }
  } catch {
    // Silently fail if error reporting fails
    console.warn("Failed to send error to tracking service")
  }
}

/**
 * Create error logger with preset context
 */
export function createErrorLogger(defaultContext: ErrorContext) {
  return {
    error: (error: Error | string, additionalContext?: ErrorContext) => {
      return logError(error, { ...defaultContext, ...additionalContext })
    },
    warn: (message: string, context?: ErrorContext) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("[Warning]", message, { ...defaultContext, ...context })
      }
    },
    info: (message: string, context?: ErrorContext) => {
      if (process.env.NODE_ENV === "development") {
        console.info("[Info]", message, { ...defaultContext, ...context })
      }
    },
  }
}

/**
 * Wrap async function with error logging
 */
export function withErrorLogging<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: ErrorContext = {}
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        ...context,
        action: fn.name || "anonymous",
      })
      throw error
    }
  }) as T
}

/**
 * Error boundary logging
 */
export function logComponentError(
  error: Error,
  errorInfo: { componentStack: string },
  componentName?: string
): LoggedError {
  return logError(error, {
    component: componentName,
    metadata: {
      componentStack: errorInfo.componentStack,
    },
  })
}

// ==================== API Error Handling ====================

export interface APIError {
  status: number
  message: string
  code?: string
  details?: Record<string, any>
}

/**
 * Parse API error response
 */
export async function parseAPIError(response: Response): Promise<APIError> {
  let message = `HTTP ${response.status}: ${response.statusText}`
  let code: string | undefined
  let details: Record<string, any> | undefined

  try {
    const body = await response.json()
    message = body.message || body.error || message
    code = body.code
    details = body.details
  } catch {
    // Response is not JSON
  }

  return {
    status: response.status,
    message,
    code,
    details,
  }
}

/**
 * Log API error
 */
export function logAPIError(
  endpoint: string,
  method: string,
  error: APIError,
  context: ErrorContext = {}
): LoggedError {
  return logError(new Error(error.message), {
    ...context,
    action: `API ${method} ${endpoint}`,
    metadata: {
      status: error.status,
      code: error.code,
      details: error.details,
    },
  })
}

// ==================== User-Friendly Error Messages ====================

const errorMessages: Record<string, string> = {
  // Network errors
  NetworkError: "Unable to connect. Please check your internet connection.",
  TimeoutError: "The request timed out. Please try again.",

  // Auth errors
  Unauthorized: "You need to be logged in to perform this action.",
  Forbidden: "You don't have permission to perform this action.",
  SessionExpired: "Your session has expired. Please log in again.",

  // Validation errors
  ValidationError: "Please check your input and try again.",
  InvalidInput: "The provided data is invalid.",

  // Server errors
  InternalServerError: "Something went wrong on our end. Please try again later.",
  ServiceUnavailable: "The service is temporarily unavailable. Please try again later.",

  // Generic
  Default: "An unexpected error occurred. Please try again.",
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: Error | APIError | string): string {
  if (typeof error === "string") {
    return errorMessages[error] || error
  }

  if ("status" in error) {
    // API Error
    switch (error.status) {
      case 400:
        return errorMessages.ValidationError
      case 401:
        return errorMessages.Unauthorized
      case 403:
        return errorMessages.Forbidden
      case 404:
        return "The requested resource was not found."
      case 408:
        return errorMessages.TimeoutError
      case 429:
        return "Too many requests. Please wait a moment and try again."
      case 500:
        return errorMessages.InternalServerError
      case 503:
        return errorMessages.ServiceUnavailable
      default:
        return error.message || errorMessages.Default
    }
  }

  // Regular Error
  const errorType = error.name || "Error"
  return errorMessages[errorType] || error.message || errorMessages.Default
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error | APIError): boolean {
  if ("status" in error) {
    // Retry on network errors and 5xx server errors
    return error.status >= 500 || error.status === 408 || error.status === 429
  }

  // Retry on network errors
  return error.name === "TypeError" || error.message.includes("network")
}
