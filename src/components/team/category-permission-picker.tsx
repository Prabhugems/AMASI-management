"use client"

import { useState, useCallback } from "react"
import { PERMISSION_CATEGORIES, ALL_PERMISSION_VALUES, type PermissionCategory } from "@/lib/team-constants"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Users, Calendar, CheckCircle, Award, FileText, Palette,
  ClipboardList, Settings, Clock, BookOpen, MapPin, Plane,
  Hotel, Car, Shield, Train, ChevronDown, ChevronRight, Sparkles,
} from "lucide-react"

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Users, Calendar, CheckCircle, Award, FileText, Palette,
  ClipboardList, Settings, Clock, BookOpen, MapPin, Plane,
  Hotel, Car, Shield, Train,
}

interface CategoryPermissionPickerProps {
  selectedPermissions: string[]
  onChange: (permissions: string[]) => void
  allAccess?: boolean
  onAllAccessChange?: (allAccess: boolean) => void
}

export function CategoryPermissionPicker({
  selectedPermissions,
  onChange,
  allAccess = false,
  onAllAccessChange,
}: CategoryPermissionPickerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const handleAllAccessChange = useCallback(
    (value: boolean) => {
      if (value) {
        const confirmed = window.confirm(
          "Granting full access allows this member to access ALL modules without restriction. Continue?"
        )
        if (!confirmed) return
      }
      onAllAccessChange?.(value)
    },
    [onAllAccessChange]
  )

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const catCount = (cat: PermissionCategory) => {
    const vals = cat.permissions.map((p) => p.value)
    return { sel: vals.filter((v) => selectedPermissions.includes(v)).length, tot: vals.length }
  }

  const toggleCatAll = (cat: PermissionCategory) => {
    const vals = cat.permissions.map((p) => p.value)
    const all = vals.every((v) => selectedPermissions.includes(v))
    onChange(all
      ? selectedPermissions.filter((p) => !vals.includes(p))
      : [...new Set([...selectedPermissions, ...vals])])
  }

  const togglePerm = (value: string) =>
    onChange(
      selectedPermissions.includes(value)
        ? selectedPermissions.filter((p) => p !== value)
        : [...selectedPermissions, value]
    )

  return (
    <div className="space-y-3">
      {/* Full access toggle */}
      {onAllAccessChange && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Full access to all modules</span>
          </div>
          <Switch checked={allAccess} onCheckedChange={handleAllAccessChange} />
        </div>
      )}

      {allAccess && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-800">
          <Shield className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">
            Full Access: This member can access ALL modules without restriction.
          </span>
        </div>
      )}

      {allAccess ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-medium">
            All {ALL_PERMISSION_VALUES.length} modules accessible
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {PERMISSION_CATEGORIES.map((cat) => {
            const { sel, tot } = catCount(cat)
            const isOpen = expanded.has(cat.key)
            const allSel = sel === tot
            const someSel = sel > 0 && !allSel
            const CatIcon = ICON_MAP[cat.icon] || Settings

            return (
              <div key={cat.key} className="rounded-xl border overflow-hidden">
                {/* Category header */}
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors",
                    sel > 0 ? cat.bgLight : "bg-slate-50 hover:bg-slate-100"
                  )}
                  onClick={() => toggle(cat.key)}
                >
                  <Checkbox
                    checked={allSel ? true : someSel ? "indeterminate" : false}
                    onCheckedChange={() => toggleCatAll(cat)}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0"
                  />
                  <CatIcon className={cn("h-4 w-4 shrink-0", cat.color)} />
                  <span className="text-sm font-medium flex-1">{cat.label}</span>
                  <Badge variant="secondary" className="text-xs font-normal px-1.5 py-0">
                    {sel}/{tot}
                  </Badge>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>

                {/* Expanded permission list */}
                {isOpen && (
                  <div className="border-t bg-white px-3 py-2 space-y-1">
                    {cat.permissions.map((perm) => {
                      const isSel = selectedPermissions.includes(perm.value)
                      const PermIcon = ICON_MAP[perm.icon] || Settings
                      return (
                        <div
                          key={perm.value}
                          onClick={() => togglePerm(perm.value)}
                          className={cn(
                            "flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer transition-colors",
                            isSel
                              ? "bg-primary/5 border border-primary/20"
                              : "hover:bg-slate-50 border border-transparent"
                          )}
                        >
                          <Checkbox checked={isSel} className="shrink-0" />
                          <PermIcon className={cn("h-3.5 w-3.5 shrink-0", cat.color)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{perm.label}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {perm.description}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
