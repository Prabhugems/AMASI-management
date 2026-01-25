"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useParams } from "next/navigation"

export default function CheckinError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const params = useParams()
  const eventId = params.eventId as string

  useEffect(() => {
    console.error("[Check-in Error]", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-md bg-white rounded-lg shadow-lg p-8">
        <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-8 w-8 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Check-in Error</h2>
        <p className="text-gray-600 mb-4">
          Something went wrong while loading the check-in system.
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
            <Link href={`/events/${eventId}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Event
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
