import { Badge } from "@/components/ui/badge"

interface CmeCreditPillProps {
  credits: number | string | null | undefined
}

/**
 * Small badge that displays CME credit value for a session.
 * Renders nothing when credits are zero, null, or undefined.
 */
export function CmeCreditPill({ credits }: CmeCreditPillProps) {
  if (credits === null || credits === undefined) return null
  const numeric = typeof credits === "string" ? Number(credits) : credits
  if (!Number.isFinite(numeric) || numeric <= 0) return null

  // Trim trailing zeros for clean display (e.g. 1.00 -> 1, 1.50 -> 1.5)
  const display = Number(numeric.toFixed(2)).toString()

  return (
    <Badge
      variant="secondary"
      className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-400"
    >
      {display} CME
    </Badge>
  )
}

export default CmeCreditPill
