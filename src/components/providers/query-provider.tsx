"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, useEffect, useCallback, useRef, type ReactNode } from "react"
import { useSessionTimeout } from "@/hooks/use-session-timeout"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

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

function SessionTimeoutManager() {
  const supabase = createClient()
  const toastIdRef = useRef<string | number | null>(null)

  const handleTimeout = useCallback(async () => {
    // Dismiss warning toast if shown
    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current)
      toastIdRef.current = null
    }
    // Track logout before signing out
    await fetch("/api/track-logout", { method: "POST" }).catch(() => {})
    await supabase.auth.signOut()
    window.location.href = "/login?reason=timeout"
  }, [supabase])

  const handleWarning = useCallback(() => {
    toastIdRef.current = toast.warning("Session expiring soon", {
      description: "You'll be logged out in 5 minutes due to inactivity.",
      duration: 5 * 60 * 1000,
    })
  }, [])

  useSessionTimeout({
    timeout: 30 * 60 * 1000, // 30 minutes
    warningTime: 5 * 60 * 1000, // 5 minute warning
    onTimeout: handleTimeout,
    onWarning: handleWarning,
  })

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
      <SessionTimeoutManager />
      {children}
    </QueryClientProvider>
  )
}
