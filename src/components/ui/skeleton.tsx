import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

// Pre-built skeleton patterns
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-5", className)}>
      <div className="flex items-start gap-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2 mt-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-4 pt-4 border-t">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20 ml-auto" />
      </div>
    </div>
  )
}

function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="bg-muted/50 p-4 flex gap-4">
        <Skeleton className="h-4 w-[200px]" />
        <Skeleton className="h-4 w-[100px]" />
        <Skeleton className="h-4 w-[120px]" />
        <Skeleton className="h-4 w-[80px]" />
        <Skeleton className="h-4 w-[100px]" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 flex items-center gap-4 border-t">
          <div className="flex items-center gap-3 w-[200px]">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-6 w-[80px] rounded-full" />
          <Skeleton className="h-6 w-[100px]" />
          <Skeleton className="h-6 w-[60px] rounded-full" />
          <Skeleton className="h-4 w-[80px]" />
        </div>
      ))}
    </div>
  )
}

function SkeletonStats() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg bg-white/10" />
            <div className="space-y-1">
              <Skeleton className="h-6 w-8 bg-white/10" />
              <Skeleton className="h-3 w-16 bg-white/10" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function SkeletonList({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

export { Skeleton, SkeletonCard, SkeletonTable, SkeletonStats, SkeletonList }
