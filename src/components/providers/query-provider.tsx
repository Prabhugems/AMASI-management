"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, useEffect, type ReactNode } from "react"

function ActivityTracker() {
  useEffect(() => {
    const ping = () => {
      fetch("/api/track-activity", { method: "POST" }).catch(() => {})
    }
    // Ping on mount (page load = user is active)
    ping()
    // Then every 5 minutes
    const interval = setInterval(ping, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])
  return null
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ActivityTracker />
      {children}
    </QueryClientProvider>
  )
}
