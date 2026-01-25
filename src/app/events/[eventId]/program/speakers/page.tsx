"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

/**
 * Program > Speakers now redirects to the main Speakers module
 * This avoids having two separate speaker management areas
 */
export default function ProgramSpeakersPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string

  useEffect(() => {
    // Redirect to the main Speakers module
    router.replace(`/events/${eventId}/speakers`)
  }, [eventId, router])

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to Speakers...</p>
      </div>
    </div>
  )
}
