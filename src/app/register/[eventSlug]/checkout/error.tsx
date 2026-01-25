"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("[Checkout Error]", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-md bg-white rounded-lg shadow-lg p-8">
        <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-8 w-8 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Checkout Error</h2>
        <p className="text-gray-600 mb-4">
          Something went wrong during checkout. Your payment has not been processed.
        </p>
        {error.message && (
          <p className="text-sm text-red-600 bg-red-50 rounded p-2 mb-4">
            {error.message}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} variant="default">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Events
            </Link>
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-6">
          If this problem persists, please contact support.
        </p>
      </div>
    </div>
  )
}
