"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

// Redirect old /travel-login to new /team-login
export default function TravelLoginRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/team-login")
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}
