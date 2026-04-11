"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PERMISSION_CATEGORIES, ROLE_CONFIG } from "@/lib/team-constants"
import { Plus, Minus, Equal, ArrowRight, Shield, Sparkles, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface PermissionDiffModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  isPending?: boolean
  memberName: string
  oldPermissions: string[]
  newPermissions: string[]
  oldRole?: string
  newRole?: string
}

/** Resolve a permission value to its human label via PERMISSION_CATEGORIES */
function getPermissionLabel(value: string): string {
  for (const cat of PERMISSION_CATEGORIES) {
    const perm = cat.permissions.find((p) => p.value === value)
    if (perm) return perm.label
  }
  return value
}

/** Resolve a permission value to its category label */
function getCategoryLabel(value: string): string {
  for (const cat of PERMISSION_CATEGORIES) {
    if (cat.permissions.some((p) => p.value === value)) return cat.label
  }
  return ""
}

function getRoleLabel(role: string): string {
  return ROLE_CONFIG[role]?.label ?? role
}

function getRoleBadgeClasses(role: string): string {
  const cfg = ROLE_CONFIG[role]
  if (!cfg) return "bg-gray-100 text-gray-700"
  return `${cfg.bg} ${cfg.color}`
}

export function PermissionDiffModal({
  open,
  onClose,
  onConfirm,
  isPending,
  memberName,
  oldPermissions,
  newPermissions,
  oldRole,
  newRole,
}: PermissionDiffModalProps) {
  const oldSet = new Set(oldPermissions)
  const newSet = new Set(newPermissions)

  const added = newPermissions.filter((p) => !oldSet.has(p))
  const removed = oldPermissions.filter((p) => !newSet.has(p))
  const unchanged = oldPermissions.filter((p) => newSet.has(p))

  const roleChanged = oldRole && newRole && oldRole !== newRole

  // Detect full-access transitions
  // "empty" permissions array = full access in this system
  const oldIsFullAccess = oldPermissions.length === 0
  const newIsFullAccess = newPermissions.length === 0
  const restrictingFromFullAccess = oldIsFullAccess && !newIsFullAccess
  const upgradingToFullAccess = !oldIsFullAccess && newIsFullAccess

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Shield className="h-4.5 w-4.5 text-white" />
            </div>
            Confirm Permission Changes
          </DialogTitle>
          <DialogDescription>
            Review the changes below for <span className="font-semibold text-foreground">{memberName}</span> before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Role change */}
          {roleChanged && (
            <div className="flex items-center gap-2 flex-wrap p-3 rounded-xl bg-slate-50 border">
              <span className="text-sm font-medium text-muted-foreground">Role:</span>
              <Badge className={cn("text-xs", getRoleBadgeClasses(oldRole!))}>
                {getRoleLabel(oldRole!)}
              </Badge>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <Badge className={cn("text-xs", getRoleBadgeClasses(newRole!))}>
                {getRoleLabel(newRole!)}
              </Badge>
            </div>
          )}

          {/* Full-access transition banners */}
          {restrictingFromFullAccess && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
              <Shield className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">
                Restricting from Full Access to specific modules
              </span>
            </div>
          )}
          {upgradingToFullAccess && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">
                Upgrading to Full Access (all modules)
              </span>
            </div>
          )}

          {/* Added permissions */}
          {added.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <Plus className="h-3.5 w-3.5" />
                Added ({added.length})
              </div>
              <div className="space-y-1 pl-1">
                {added.map((p) => (
                  <div
                    key={p}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800"
                  >
                    <Plus className="h-3 w-3 shrink-0" />
                    <span className="text-sm">{getPermissionLabel(p)}</span>
                    <span className="text-xs text-emerald-600 ml-auto">{getCategoryLabel(p)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Removed permissions */}
          {removed.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-sm font-medium text-red-700">
                <Minus className="h-3.5 w-3.5" />
                Removed ({removed.length})
              </div>
              <div className="space-y-1 pl-1">
                {removed.map((p) => (
                  <div
                    key={p}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-800"
                  >
                    <Minus className="h-3 w-3 shrink-0" />
                    <span className="text-sm">{getPermissionLabel(p)}</span>
                    <span className="text-xs text-red-600 ml-auto">{getCategoryLabel(p)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unchanged permissions */}
          {unchanged.length > 0 && !upgradingToFullAccess && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <Equal className="h-3.5 w-3.5" />
                Unchanged ({unchanged.length})
              </div>
              <div className="space-y-1 pl-1 opacity-50">
                {unchanged.map((p) => (
                  <div
                    key={p}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600"
                  >
                    <Equal className="h-3 w-3 shrink-0" />
                    <span className="text-sm">{getPermissionLabel(p)}</span>
                    <span className="text-xs text-slate-400 ml-auto">{getCategoryLabel(p)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nothing changed (shouldn't normally happen, but just in case) */}
          {added.length === 0 && removed.length === 0 && !roleChanged && !restrictingFromFullAccess && !upgradingToFullAccess && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No permission changes detected.
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Confirm Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
