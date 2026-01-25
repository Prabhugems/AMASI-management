"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

/**
 * Speakers > Travel now redirects to the main Travel module's Guests page
 * This ensures consistency and avoids having two separate travel management areas
 */
export default function SpeakerTravelPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string

  useEffect(() => {
    // Redirect to the main Travel module
    router.replace(`/events/${eventId}/travel`)
  }, [eventId, router])

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to Travel...</p>
      </div>
    </div>
  )
}
