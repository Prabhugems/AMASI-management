"use client"

import * as React from "react"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors in child components and displays fallback UI
 *
 * Usage:
 * ```
 * <ErrorBoundary
 *   fallback={<ErrorFallback />}
 *   onError={(error) => logError(error)}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <ErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
        />
      )
    }

    return this.props.children
  }
}

/**
 * Default error fallback component
 */
export function ErrorFallback({
  error,
  onReset,
  className,
}: {
  error?: Error | null
  onReset?: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center",
        className
      )}
    >
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        {error?.message || "An unexpected error occurred. Please try again."}
      </p>
      {onReset && (
        <Button variant="outline" onClick={onReset}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try again
        </Button>
      )}
    </div>
  )
}

/**
 * Compact error fallback for smaller areas
 */
export function ErrorFallbackCompact({
  error,
  onReset,
  className,
}: {
  error?: Error | null
  onReset?: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 border border-destructive/20 bg-destructive/5 rounded-lg",
        className
      )}
    >
      <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Error loading content</p>
        <p className="text-xs text-muted-foreground truncate">
          {error?.message || "Please try again"}
        </p>
      </div>
      {onReset && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          Retry
        </Button>
      )}
    </div>
  )
}

/**
 * Inline error fallback
 */
export function ErrorFallbackInline({
  error,
  onReset,
  className,
}: {
  error?: Error | null
  onReset?: () => void
  className?: string
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-destructive", className)}
    >
      <AlertCircle className="h-4 w-4" />
      <span className="text-sm">
        {error?.message || "Error"}
        {onReset && (
          <button
            onClick={onReset}
            className="underline hover:no-underline ml-1"
          >
            Retry
          </button>
        )}
      </span>
    </span>
  )
}

/**
 * Hook for error boundary reset
 *
 * Usage:
 * ```
 * function MyComponent() {
 *   const { resetError } = useErrorBoundary()
 *
 *   return (
 *     <button onClick={() => {
 *       resetError()
 *       refetch()
 *     }}>
 *       Retry
 *     </button>
 *   )
 * }
 * ```
 */
const ErrorBoundaryContext = React.createContext<{
  resetError: () => void
} | null>(null)

export function useErrorBoundary() {
  const context = React.useContext(ErrorBoundaryContext)
  if (!context) {
    return { resetError: () => {} }
  }
  return context
}

/**
 * Error boundary with context provider
 */
export function ErrorBoundaryWithContext({
  children,
  ...props
}: ErrorBoundaryProps) {
  const [resetKey, setResetKey] = React.useState(0)

  const resetError = React.useCallback(() => {
    setResetKey((k) => k + 1)
  }, [])

  return (
    <ErrorBoundaryContext.Provider value={{ resetError }}>
      <ErrorBoundary key={resetKey} {...props}>
        {children}
      </ErrorBoundary>
    </ErrorBoundaryContext.Provider>
  )
}

/**
 * Async error boundary for handling async errors
 *
 * Usage:
 * ```
 * <AsyncErrorBoundary
 *   error={queryError}
 *   onReset={() => refetch()}
 * >
 *   <DataDisplay data={data} />
 * </AsyncErrorBoundary>
 * ```
 */
export function AsyncErrorBoundary({
  children,
  error,
  onReset,
  fallback,
}: {
  children: React.ReactNode
  error?: Error | null
  onReset?: () => void
  fallback?: React.ReactNode
}) {
  if (error) {
    return (
      fallback || <ErrorFallback error={error} onReset={onReset} />
    )
  }

  return <>{children}</>
}

/**
 * Page-level error component
 */
export function PageError({
  title = "Page Error",
  message = "We couldn't load this page. Please try again.",
  onReset,
  showHome = true,
}: {
  title?: string
  message?: string
  onReset?: () => void
  showHome?: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="rounded-full bg-destructive/10 p-6 mb-6">
        <AlertCircle className="h-12 w-12 text-destructive" />
      </div>
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <p className="text-muted-foreground mb-6 max-w-md">{message}</p>
      <div className="flex gap-3">
        {onReset && (
          <Button onClick={onReset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try again
          </Button>
        )}
        {showHome && (
          <Button variant="outline" asChild>
            <a href="/">Go home</a>
          </Button>
        )}
      </div>
    </div>
  )
}
