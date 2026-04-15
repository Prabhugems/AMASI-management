"use client"

import { WifiOff } from "lucide-react"
import { COMPANY_CONFIG } from "@/lib/config"

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-sm">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <WifiOff className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">
          You&apos;re offline
        </h1>
        <p className="text-muted-foreground mb-6">
          Check your internet connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium"
        >
          Retry
        </button>
        <p className="mt-8 text-xs text-muted-foreground">
          {COMPANY_CONFIG.fullName}
        </p>
      </div>
    </div>
  )
}
