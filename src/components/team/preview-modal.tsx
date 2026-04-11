"use client"

import { useQuery } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  Check,
  X,
  Loader2,
  Sparkles,
  Lock,
  Calendar,
  Globe,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface PreviewModalProps {
  open: boolean
  onClose: () => void
  memberId: string | null
}

interface ModuleAccess {
  id: string
  label: string
  icon: string
  description: string
  accessible: boolean
}

interface CategoryAccess {
  key: string
  label: string
  icon: string
  color: string
  permissions: ModuleAccess[]
}

interface PreviewData {
  member: {
    id: string
    name: string
    email: string
    role: string
    role_label: string
    role_description: string
    is_active: boolean
  }
  access: {
    hasFullAccess: boolean
    modules: CategoryAccess[]
    totalModules: number
    accessibleModules: number
    events: {
      isAllEvents: boolean
      eventList: { id: string; title: string }[]
    }
  }
}

// Role badge colors
const ROLE_BADGE_STYLES: Record<string, { bg: string; text: string; gradient: string }> = {
  admin: { bg: "bg-purple-100", text: "text-purple-700", gradient: "from-purple-500 to-pink-500" },
  coordinator: { bg: "bg-blue-100", text: "text-blue-700", gradient: "from-blue-500 to-indigo-500" },
  travel: { bg: "bg-cyan-100", text: "text-cyan-700", gradient: "from-cyan-500 to-blue-500" },
}

export function PreviewModal({ open, onClose, memberId }: PreviewModalProps) {
  const { data, isLoading, error } = useQuery<PreviewData>({
    queryKey: ["team-member-preview", memberId],
    queryFn: async () => {
      const res = await fetch(`/api/team/${memberId}/preview`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || "Failed to load preview")
      }
      return res.json()
    },
    enabled: open && !!memberId,
  })

  const roleStyle = data ? (ROLE_BADGE_STYLES[data.member.role] || ROLE_BADGE_STYLES.coordinator) : ROLE_BADGE_STYLES.coordinator

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Preview Access</DialogTitle>
          <DialogDescription>
            Read-only view of what this team member can access
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 py-8 justify-center text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{(error as Error).message}</span>
          </div>
        )}

        {data && (
          <div className="space-y-5">
            {/* Member info */}
            <div className="flex items-center gap-4">
              <div className={cn(
                "h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br",
                roleStyle.gradient,
              )}>
                {data.member.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate">{data.member.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{data.member.email}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Badge className={cn("text-xs", roleStyle.bg, roleStyle.text)}>
                  {data.member.role_label}
                </Badge>
                {!data.member.is_active && (
                  <Badge variant="destructive" className="text-xs">Deactivated</Badge>
                )}
              </div>
            </div>

            {/* Access status */}
            <div className={cn(
              "rounded-lg px-4 py-3 border",
              data.access.hasFullAccess
                ? "bg-emerald-50 border-emerald-200"
                : "bg-amber-50 border-amber-200",
            )}>
              <div className="flex items-center gap-2">
                {data.access.hasFullAccess ? (
                  <>
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-800">
                      Full Access — All {data.access.totalModules} modules accessible
                    </span>
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">
                      Restricted — {data.access.accessibleModules} of {data.access.totalModules} modules
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="border-t" />

            {/* Module access grid */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Module Access
              </h4>
              {data.access.modules.map((category) => (
                <div key={category.key} className="space-y-2">
                  <h5 className="text-sm font-medium flex items-center gap-1.5">
                    <span className={category.color}>{category.label}</span>
                  </h5>
                  <div className="grid grid-cols-2 gap-1.5">
                    {category.permissions.map((perm) => (
                      <div
                        key={perm.id}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                          perm.accessible
                            ? "bg-green-50 text-green-800"
                            : "bg-red-50/60 text-red-600/80",
                        )}
                      >
                        {perm.accessible ? (
                          <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        )}
                        <span className="truncate">{perm.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t" />

            {/* Event scope */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Event Scope
              </h4>
              {data.access.events.isAllEvents ? (
                <div className="flex items-center gap-2 rounded-md px-3 py-2 bg-blue-50 text-blue-800 text-sm">
                  <Globe className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>All Events — Can access every event in the system</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {data.access.events.eventList.length > 0 ? (
                    data.access.events.eventList.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-2 rounded-md px-3 py-2 bg-slate-50 text-sm"
                      >
                        <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{event.title}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground px-3 py-2">
                      No events assigned
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="rounded-lg bg-muted/50 px-4 py-3 text-xs text-muted-foreground text-center">
              This is a read-only preview of what <strong>{data.member.name}</strong> can access
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
