"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

// Redirect old /transport-portal to new /team-portal
export default function TransportPortalRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/team-portal")
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}
