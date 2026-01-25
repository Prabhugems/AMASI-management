"use client"

import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface PageLoaderProps {
  message?: string
  className?: string
  fullScreen?: boolean
}

export function PageLoader({ message = "Loading...", className, fullScreen = true }: PageLoaderProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center gap-4",
      fullScreen ? "min-h-screen" : "min-h-[400px]",
      className
    )}>
      <div className="relative">
        <div className="h-12 w-12 rounded-full border-4 border-muted" />
        <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
      <p className="text-muted-foreground text-sm animate-pulse">{message}</p>
    </div>
  )
}

export function InlineLoader({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center p-4", className)}>
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  )
}

export function ButtonLoader() {
  return <Loader2 className="h-4 w-4 animate-spin" />
}
