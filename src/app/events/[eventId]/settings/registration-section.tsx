"use client"

import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Users, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { type SectionProps } from "./types"

interface RegistrationSectionProps extends SectionProps {
  regCount: number | undefined
}

export function RegistrationSection({ formData, updateField, setFormData, regCount }: RegistrationSectionProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
          <Users className="h-5 w-5 text-warning" />
        </div>
        <div>
          <h3 className="font-semibold">Registration Settings</h3>
          <p className="text-sm text-muted-foreground">Control how attendees can register</p>
        </div>
      </div>

      {/* Conflict warning */}
      {!(formData.is_public ?? true) && (formData.registration_open ?? true) && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Event is private but registration is open. Only users with a direct link can register.
          </p>
        </div>
      )}

      <div className="grid gap-5">
        <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-border">
          <div className="flex-1 pr-4">
            <p className="font-medium">Public Event</p>
            <p className="text-sm text-muted-foreground mt-1">
              When enabled, your event registration page will be visible to anyone with the link.
            </p>
          </div>
          <Switch
            checked={formData.is_public ?? true}
            onCheckedChange={(checked) => updateField("is_public", checked)}
          />
        </div>

        <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-border">
          <div className="flex-1 pr-4">
            <p className="font-medium">Registration Open</p>
            <p className="text-sm text-muted-foreground mt-1">
              Controls whether new registrations are accepted.
            </p>
          </div>
          <Switch
            checked={formData.registration_open ?? true}
            onCheckedChange={(checked) => updateField("registration_open", checked)}
          />
        </div>

        {/* Registration Deadline */}
        <div>
          <label className="text-sm font-medium text-foreground">Registration Deadline</label>
          <Input
            type="datetime-local"
            value={formData.registration_deadline?.slice(0, 16) || ""}
            onChange={(e) => updateField("registration_deadline", e.target.value ? new Date(e.target.value).toISOString() : null)}
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Auto-closes registration at this date/time, overriding the toggle above.
          </p>
          {formData.registration_deadline && new Date(formData.registration_deadline) < new Date() && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Deadline has already passed — registration is effectively closed
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Maximum Attendees</label>
          <Input
            type="number"
            value={formData.max_attendees || ""}
            onChange={(e) => updateField("max_attendees", e.target.value ? parseInt(e.target.value) : null)}
            placeholder="Leave empty for unlimited"
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Registration will close automatically when this limit is reached.
          </p>

          {/* Capacity bar */}
          {formData.max_attendees && formData.max_attendees > 0 && (
            <div className="mt-3 space-y-1.5">
              {(() => {
                const count = regCount || 0
                const max = formData.max_attendees!
                const pct = Math.min(Math.round((count / max) * 100), 100)
                const color = pct >= 95 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-green-500"
                return (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {count.toLocaleString()} / {max.toLocaleString()} registered
                      </span>
                      <span className={cn(
                        "font-medium",
                        pct >= 95 ? "text-red-600" : pct >= 80 ? "text-amber-600" : "text-green-600"
                      )}>
                        {pct}% capacity
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
                    </div>
                    {pct >= 100 && (
                      <p className="text-xs text-red-600 font-medium">Registration closed — limit reached</p>
                    )}
                  </>
                )
              })()}
            </div>
          )}
        </div>

        {/* Auto Waitlist */}
        <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-border">
          <div className="flex-1 pr-4">
            <p className="font-medium">Auto-open Waitlist</p>
            <p className="text-sm text-muted-foreground mt-1">
              When max attendees is reached, automatically switch to waitlist mode instead of closing registration entirely.
            </p>
            <p className="text-xs text-muted-foreground mt-1">Requires the Waitlist module to be enabled.</p>
          </div>
          <Switch
            checked={(formData as any).auto_waitlist ?? false}
            onCheckedChange={(checked) => {
              setFormData(prev => ({ ...prev, auto_waitlist: checked } as any))
            }}
          />
        </div>
      </div>
    </div>
  )
}
