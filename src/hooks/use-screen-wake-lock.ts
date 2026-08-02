import { useEffect, useRef } from "react"
import * as Sentry from "@sentry/nextjs"

// Holds a Screen Wake Lock for the lifetime of the calling component --
// mount = job active, unmount = back at the menu (work order §6.1). Re-
// acquires on visibilitychange since the OS releases the lock whenever the
// tab is backgrounded, per spec. Feature-detects and no-ops silently on
// unsupported browsers (iOS Safari) -- this must never throw or block
// rendering, it's a best-effort tablet-sleep guard, not a requirement.
export function useScreenWakeLock() {
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!("wakeLock" in navigator)) return

    let cancelled = false

    const acquire = async () => {
      try {
        const sentinel = await navigator.wakeLock.request("screen")
        if (cancelled) {
          void sentinel.release()
          return
        }
        sentinelRef.current = sentinel
      } catch (err) {
        // Expected in some states (e.g. document not visible yet) -- only
        // worth Sentry's attention if it's not the common "not visible"
        // rejection, since that one self-resolves on the next
        // visibilitychange re-acquire below.
        const name = err instanceof Error ? err.name : undefined
        if (name !== "NotAllowedError") {
          Sentry.captureException(err, { tags: { module: "kiosk-wake-lock" } })
        }
      }
    }

    void acquire()

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !sentinelRef.current) {
        void acquire()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      if (sentinelRef.current) {
        void sentinelRef.current.release()
        sentinelRef.current = null
      }
    }
  }, [])
}
