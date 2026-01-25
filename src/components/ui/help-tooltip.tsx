"use client"

import * as React from "react"
import { HelpCircle } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface HelpTooltipProps {
  content: React.ReactNode
  className?: string
  iconClassName?: string
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
}

export function HelpTooltip({
  content,
  className,
  iconClassName,
  side = "top",
  align = "center",
}: HelpTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors",
              className
            )}
          >
            <HelpCircle className={cn("h-4 w-4", iconClassName)} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className="max-w-xs text-sm"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface HelpInfoProps {
  title: string
  description: string
  tips?: string[]
  className?: string
}

export function HelpInfo({ title, description, tips, className }: HelpInfoProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground">{description}</p>
      {tips && tips.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-1 mt-2">
          {tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-1">
              <span className="text-primary">•</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
