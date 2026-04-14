"use client"

import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Blocks, Loader2, Save } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ==================== MODULE DEFINITIONS ====================
const MODULE_DEFS = [
  { category: "Event Operations", modules: [
    { key: "enable_speakers", label: "Speakers", icon: "Mic", description: "Manage speakers, invitations, portal links, travel & accommodation", defaultOn: true },
    { key: "enable_program", label: "Program", icon: "Calendar", description: "Build event schedule with sessions, tracks, and speaker assignments", defaultOn: true },
    { key: "enable_checkin", label: "Checkin Hub", icon: "QrCode", description: "QR-based check-in, session tracking, and attendance reports", defaultOn: true },
    { key: "enable_badges", label: "Badges", icon: "BadgeCheck", description: "Design and print attendee badges with templates", defaultOn: true, dependsOn: "enable_checkin" },
    { key: "enable_certificates", label: "Certificates", icon: "Award", description: "Generate and email certificates to attendees", defaultOn: true },
    { key: "enable_print_station", label: "Print Station", icon: "Printer", description: "Kiosk mode for on-site badge printing", defaultOn: true, dependsOn: "enable_badges" },
  ]},
  { category: "Registration & Forms", modules: [
    { key: "enable_addons", label: "Addons", icon: "Package", description: "Optional add-on items for registration (meals, kits, etc.)", defaultOn: true },
    { key: "enable_waitlist", label: "Waitlist", icon: "ListOrdered", description: "Manage waitlist when tickets are sold out", defaultOn: true },
    { key: "enable_forms", label: "Forms", icon: "FileText", description: "Custom form builder for collecting additional data", defaultOn: true },
    { key: "enable_delegate_portal", label: "Delegate Portal", icon: "BarChart3", description: "Self-service portal for attendees to manage their registration", defaultOn: true },
    { key: "enable_surveys", label: "Surveys", icon: "ClipboardList", description: "Post-event feedback and surveys", defaultOn: true },
    { key: "enable_leads", label: "Leads", icon: "UserPlus", description: "Capture and manage potential attendee leads", defaultOn: true },
  ]},
  { category: "Travel & Logistics", modules: [
    { key: "enable_travel", label: "Travel", icon: "Plane", description: "Manage flight bookings and transfers for speakers/delegates", defaultOn: true },
    { key: "enable_accommodation", label: "Accommodation", icon: "Hotel", description: "Manage hotel bookings and room allocations", defaultOn: true },
    { key: "enable_meals", label: "Meals", icon: "UtensilsCrossed", description: "Meal preferences, dietary requirements, and meal tracking", defaultOn: true },
    { key: "enable_visa", label: "Visa Letters", icon: "Stamp", description: "Generate visa invitation letters for international delegates", defaultOn: true },
  ]},
  { category: "Finance & Sponsors", modules: [
    { key: "enable_sponsors", label: "Sponsors", icon: "Building2", description: "Manage event sponsors, tiers, and sponsorship packages", defaultOn: true },
    { key: "enable_budget", label: "Budget", icon: "IndianRupee", description: "Track event budget, expenses, and financial reports", defaultOn: true },
  ]},
  { category: "Advanced Modules", modules: [
    { key: "enable_abstracts", label: "Abstract Management", icon: "BookOpen", description: "Abstract submission, review workflow, accept/reject decisions", defaultOn: false },
    { key: "enable_examination", label: "Examination (FMAS / MMAS)", icon: "GraduationCap", description: "Marks entry, results, convocation numbering, address collection", defaultOn: false },
    { key: "enable_convocation", label: "Convocation Process", icon: "ScrollText", description: "Built-in address collection, certificate dispatch tracking, convocation ceremony management", defaultOn: false },
  ]},
] as const

// Dependency map: if you disable a key, dependents should also be disabled
const MODULE_DEPS: Record<string, string[]> = {
  enable_checkin: ["enable_badges", "enable_print_station"],
  enable_badges: ["enable_print_station"],
}

export function ModulesSection({ eventId }: { eventId: string }) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  const ALL_MODULE_KEYS = MODULE_DEFS.flatMap(c => c.modules.map(m => m.key))
  const MODULE_FIELDS = ALL_MODULE_KEYS.join(", ")

  const { data: settings, isLoading } = useQuery({
    queryKey: ["event-module-settings", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_settings")
        .select(MODULE_FIELDS)
        .eq("event_id", eventId)
        .maybeSingle()

      if (error) throw error
      return data as Record<string, boolean> | null
    },
    enabled: !!eventId,
  })

  const getDefault = (key: string) => {
    for (const cat of MODULE_DEFS) {
      const mod = cat.modules.find(m => m.key === key)
      if (mod) return mod.defaultOn
    }
    return true
  }

  const [formData, setFormData] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const initial: Record<string, boolean> = {}
    for (const key of ALL_MODULE_KEYS) {
      initial[key] = settings?.[key] ?? getDefault(key)
    }
    setFormData(initial)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  const handleSaveAll = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/event-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, ...formData }),
      })
      if (!res.ok) throw new Error("Failed to save")
      await queryClient.invalidateQueries({ queryKey: ["event-module-settings", eventId] })
      await queryClient.invalidateQueries({ queryKey: ["event-setup-status", eventId] })
      window.dispatchEvent(new CustomEvent("event-settings-saved"))
      toast.success("All modules saved")
    } catch (error) {
      console.error("Failed to save module settings:", error)
      toast.error("Failed to save modules")
    }
    setSaving(false)
  }

  const toggleModule = (key: string) => {
    const newVal = !formData[key]
    const updates: Record<string, boolean> = { [key]: newVal }

    // If disabling, also disable dependents
    if (!newVal && MODULE_DEPS[key]) {
      for (const dep of MODULE_DEPS[key]) {
        updates[dep] = false
      }
    }

    setFormData(prev => ({ ...prev, ...updates }))

    // Show toast about cascaded disables
    if (!newVal && MODULE_DEPS[key]) {
      const disabledDeps = MODULE_DEPS[key].filter(d => formData[d])
      if (disabledDeps.length > 0) {
        const labels = disabledDeps.map(d => {
          for (const cat of MODULE_DEFS) {
            const mod = cat.modules.find(m => m.key === d)
            if (mod) return mod.label
          }
          return d
        })
        toast.info(`Also disabled: ${labels.join(", ")} (dependency)`)
      }
    }
  }

  const enableAll = () => {
    const updated: Record<string, boolean> = {}
    for (const key of ALL_MODULE_KEYS) updated[key] = true
    setFormData(updated)
  }

  const disableOptional = () => {
    const updated: Record<string, boolean> = {}
    for (const key of ALL_MODULE_KEYS) updated[key] = false
    setFormData(updated)
  }

  const enabledCount = Object.values(formData).filter(Boolean).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Blocks className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h3 className="font-semibold">Event Modules</h3>
            <p className="text-sm text-muted-foreground">
              {enabledCount} of {ALL_MODULE_KEYS.length} modules enabled
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={enableAll}>Enable All</Button>
          <Button variant="outline" size="sm" onClick={disableOptional}>Disable All</Button>
        </div>
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Toggle modules to show or hide them from the sidebar. Core items like Dashboard, Tickets,
          Attendees, Orders, Team, Communications, and Settings are always visible.
        </p>
      </div>

      {MODULE_DEFS.map((category) => {
        const categoryEnabledCount = category.modules.filter(m => formData[m.key] ?? m.defaultOn).length
        return (
          <div key={category.category} className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {category.category}
                <span className="ml-2 text-xs font-normal normal-case">
                  ({categoryEnabledCount}/{category.modules.length})
                </span>
              </h4>
            </div>

            {category.category === "Advanced Modules" && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  These modules are specialized. Enable only if your event requires abstract submission or examination components.
                </p>
              </div>
            )}

            <div className="grid gap-2">
              {category.modules.map((mod) => {
                const isEnabled = formData[mod.key] ?? mod.defaultOn
                // Check if this module's dependency is disabled
                const dep = (mod as any).dependsOn as string | undefined
                const depDisabled = dep ? !(formData[dep] ?? true) : false

                return (
                  <div
                    key={mod.key}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer",
                      isEnabled
                        ? "bg-secondary/30 border-border"
                        : "bg-muted/20 border-dashed border-border opacity-60"
                    )}
                    onClick={() => toggleModule(mod.key)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        isEnabled ? "bg-primary/10" : "bg-muted"
                      )}>
                        <Blocks className={cn("h-4 w-4", isEnabled ? "text-primary" : "text-muted-foreground")} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{mod.label}</p>
                          {isEnabled && (
                            <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded-full">On</span>
                          )}
                          {depDisabled && isEnabled && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                              Requires {dep?.replace("enable_", "")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{mod.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => toggleModule(mod.key)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="flex justify-end pt-4 border-t border-border">
        <Button onClick={handleSaveAll} disabled={saving} className="gap-2">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Modules
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
