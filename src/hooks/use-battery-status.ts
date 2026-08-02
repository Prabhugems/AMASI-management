import { useEffect, useState } from "react"

// Battery Status API types aren't in lib.dom.d.ts (removed from the spec for
// top-level sites in some browsers over fingerprinting concerns, but still
// present on the Android/Chromium builds the kiosk tablets actually run).
interface BatteryManagerLike {
  level: number
  charging: boolean
  addEventListener: (type: "levelchange" | "chargingchange", listener: () => void) => void
  removeEventListener: (type: "levelchange" | "chargingchange", listener: () => void) => void
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManagerLike>
}

export interface BatteryStatus {
  supported: boolean
  level: number | null // 0-1
  charging: boolean | null
}

// Degrades quietly on any browser without the Battery Status API (iOS
// Safari, and Chrome on some platforms) -- callers must treat `supported:
// false` as "render nothing", never a broken/placeholder indicator (work
// order §6.2).
export function useBatteryStatus(): BatteryStatus {
  const [status, setStatus] = useState<BatteryStatus>({ supported: false, level: null, charging: null })

  useEffect(() => {
    let cancelled = false
    let battery: BatteryManagerLike | null = null
    const nav = navigator as NavigatorWithBattery
    if (typeof nav.getBattery !== "function") return

    const update = () => {
      if (!battery || cancelled) return
      setStatus({ supported: true, level: battery.level, charging: battery.charging })
    }

    nav
      .getBattery()
      .then((b) => {
        if (cancelled) return
        battery = b
        update()
        battery.addEventListener("levelchange", update)
        battery.addEventListener("chargingchange", update)
      })
      .catch(() => {
        // Permission denied or transient failure -- stay "unsupported" rather
        // than show a broken indicator.
      })

    return () => {
      cancelled = true
      if (battery) {
        battery.removeEventListener("levelchange", update)
        battery.removeEventListener("chargingchange", update)
      }
    }
  }, [])

  return status
}
