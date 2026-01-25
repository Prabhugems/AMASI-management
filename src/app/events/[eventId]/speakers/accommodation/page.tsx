"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

/**
 * Speakers > Accommodation now redirects to the main Accommodation module's Guests page
 * This ensures consistency and avoids having two separate accommodation management areas
 */
export default function SpeakerAccommodationPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string

  useEffect(() => {
    // Redirect to the main Accommodation module
    router.replace(`/events/${eventId}/accommodation`)
  }, [eventId, router])

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to Accommodation...</p>
      </div>
    </div>
  )
}
