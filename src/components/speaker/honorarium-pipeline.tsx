"use client"

import { cn } from "@/lib/utils"

export type HonorariumStatus =
  | "not_eligible"
  | "pending"
  | "approved"
  | "processing"
  | "paid"
  | "rejected"

interface HonorariumPipelineProps {
  status: HonorariumStatus
  className?: string
}

const STEPS: { key: HonorariumStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "processing", label: "Processing" },
  { key: "paid", label: "Paid" },
]

export function HonorariumPipeline({ status, className }: HonorariumPipelineProps) {
  // Terminal-but-out-of-flow states get a single badge
  if (status === "rejected" || status === "not_eligible") {
    const isRejected = status === "rejected"
    return (
      <div className={cn("inline-flex", className)}>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
            isRejected
              ? "bg-red-100 text-red-700 border border-red-200"
              : "bg-slate-100 text-slate-600 border border-slate-200"
          )}
        >
          {isRejected ? "Rejected" : "Not eligible"}
        </span>
      </div>
    )
  }

  const activeIndex = STEPS.findIndex((s) => s.key === status)

  return (
    <div className={cn("flex items-center gap-2 w-full", className)}>
      {STEPS.map((step, i) => {
        const isComplete = i < activeIndex
        const isCurrent = i === activeIndex
        const isUpcoming = i > activeIndex
        return (
          <div key={step.key} className="flex items-center gap-2 flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full transition-colors",
                  isCurrent && "bg-blue-600 ring-4 ring-blue-100",
                  isComplete && "bg-emerald-500",
                  isUpcoming && "bg-slate-200"
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "text-[10px] leading-none whitespace-nowrap",
                  isCurrent && "text-blue-700 font-medium",
                  isComplete && "text-emerald-700",
                  isUpcoming && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1 transition-colors",
                  i < activeIndex ? "bg-emerald-400" : "bg-slate-200"
                )}
                aria-hidden
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default HonorariumPipeline
