"use client"

import { Battery, BatteryWarning, BatteryCharging } from "lucide-react"
import { useBatteryStatus } from "@/hooks/use-battery-status"

const LOW_BATTERY_THRESHOLD = 0.2

// Renders nothing on any browser without the Battery Status API (work order
// §6.2: "degrade quietly... do not show a broken indicator") -- never a
// placeholder or a fixed "--%" text.
//
// Uses orange for the low-battery warning, deliberately NOT the amber/red
// reserved for check-in results (§1: "Result colours... reserved. Never
// used for anything else") -- this is device health, not a scan outcome, but
// stays out of that hue family so it's never mistaken for one at a glance.
export function BatteryStatusBadge({ className = "" }: { className?: string }) {
  const { supported, level, charging } = useBatteryStatus()
  if (!supported || level === null) return null

  const percent = Math.round(level * 100)
  const low = !charging && level < LOW_BATTERY_THRESHOLD
  const Icon = charging ? BatteryCharging : low ? BatteryWarning : Battery

  return (
    <span
      className={`inline-flex items-center gap-1 ${low ? "text-orange-600 font-semibold" : "text-muted-foreground"} ${className}`}
    >
      <Icon className="size-3.5" />
      {percent}%
    </span>
  )
}
