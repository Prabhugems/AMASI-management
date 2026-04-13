"use client"

import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Bell,
  Mail,
  Clock,
  FileText,
  Loader2,
  Save,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export function AutomationSection({ eventId }: { eventId: string }) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  const { data: settings, isLoading } = useQuery({
    queryKey: ["event-automation-settings", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_settings")
        .select("auto_send_receipt, auto_generate_badge, auto_email_badge, auto_generate_certificate, auto_email_certificate, auto_send_reminder, reminder_lead_days")
        .eq("event_id", eventId)
        .maybeSingle()

      if (error) throw error
      return data || {
        auto_send_receipt: true,
        auto_generate_badge: false,
        auto_email_badge: false,
        auto_generate_certificate: false,
        auto_email_certificate: false,
        auto_send_reminder: false,
        reminder_lead_days: 3,
      }
    },
    enabled: !!eventId,
  })

  const { data: hasDefaultBadgeTemplate } = useQuery({
    queryKey: ["default-badge-template", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/badge-templates?event_id=${eventId}`)
      if (!res.ok) return false
      const templates = await res.json()
      return Array.isArray(templates) && templates.some((t: any) => t.is_default)
    },
    enabled: !!eventId,
  })

  const { data: hasDefaultCertTemplate } = useQuery({
    queryKey: ["default-certificate-template", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/certificate-templates?event_id=${eventId}`)
      if (!res.ok) return false
      const templates = await res.json()
      return Array.isArray(templates) && templates.some((t: any) => t.is_default)
    },
    enabled: !!eventId,
  })

  const [formData, setFormData] = useState({
    auto_send_receipt: true,
    auto_generate_badge: false,
    auto_email_badge: false,
    auto_generate_certificate: false,
    auto_email_certificate: false,
    auto_send_reminder: false,
    reminder_lead_days: 3,
  })

  useEffect(() => {
    if (settings) {
      setFormData({
        auto_send_receipt: settings.auto_send_receipt ?? true,
        auto_generate_badge: settings.auto_generate_badge ?? false,
        auto_email_badge: settings.auto_email_badge ?? false,
        auto_generate_certificate: settings.auto_generate_certificate ?? false,
        auto_email_certificate: settings.auto_email_certificate ?? false,
        auto_send_reminder: (settings as any).auto_send_reminder ?? false,
        reminder_lead_days: (settings as any).reminder_lead_days ?? 3,
      })
    }
  }, [settings])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/event-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, ...formData }),
      })
      if (!res.ok) throw new Error("Failed to save")
      await queryClient.invalidateQueries({ queryKey: ["event-automation-settings", eventId] })
      toast.success("Automation settings saved")
    } catch (error) {
      console.error("Failed to save automation settings:", error)
      toast.error("Failed to save automation settings")
    }
    setSaving(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Automation Settings</h3>
          <p className="text-sm text-muted-foreground">Configure automatic actions after registration</p>
        </div>
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>How Automation Works:</strong> These settings trigger automatically when a payment is completed.
          The system will perform the enabled actions in order: Receipt → Badge → Certificate.
        </p>
      </div>

      <div className="grid gap-4">
        {/* Auto Send Receipt */}
        <div className="flex items-start justify-between p-4 bg-secondary/30 rounded-xl border border-border">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">Auto-send Receipt</p>
              <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">Recommended</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Sends a confirmation email with registration details immediately after payment.
            </p>
          </div>
          <Switch
            checked={formData.auto_send_receipt}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, auto_send_receipt: checked }))}
          />
        </div>

        {/* Auto Send Reminder */}
        <div className="flex items-start justify-between p-4 bg-secondary/30 rounded-xl border border-border">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">Auto-send Reminder</p>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Send a reminder email to registered attendees before the event starts.
            </p>
            {formData.auto_send_reminder && (
              <div className="mt-3 flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">Days before event:</label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={formData.reminder_lead_days}
                  onChange={(e) => setFormData(prev => ({ ...prev, reminder_lead_days: parseInt(e.target.value) || 3 }))}
                  className="w-20 h-8 text-sm"
                />
              </div>
            )}
          </div>
          <Switch
            checked={formData.auto_send_reminder}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, auto_send_reminder: checked }))}
          />
        </div>

        <div className="border-t border-border my-2" />

        {/* Auto Generate Badge */}
        <div className="flex items-start justify-between p-4 bg-secondary/30 rounded-xl border border-border">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">Auto-generate Badge</p>
              {hasDefaultBadgeTemplate ? (
                <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">Template ready</span>
              ) : (
                <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full">No default template</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Creates a personalized badge PDF using your default badge template when registration is confirmed.
            </p>
          </div>
          <Switch
            checked={formData.auto_generate_badge}
            onCheckedChange={(checked) => {
              if (checked && !hasDefaultBadgeTemplate) {
                toast.warning("Create a default badge template first: Badges → Templates → mark as Default")
              }
              setFormData(prev => ({ ...prev, auto_generate_badge: checked }))
            }}
          />
        </div>

        {/* Auto Email Badge */}
        <div className={cn(
          "flex items-start justify-between p-4 bg-secondary/30 rounded-xl border border-border ml-6",
          !formData.auto_generate_badge && "opacity-50"
        )}>
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">Auto-email Badge</p>
              <span className="text-xs text-muted-foreground">(requires auto-generate)</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Emails the generated badge to the attendee with a download link.
            </p>
          </div>
          <Switch
            checked={formData.auto_email_badge}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, auto_email_badge: checked }))}
            disabled={!formData.auto_generate_badge}
          />
        </div>

        <div className="border-t border-border my-2" />

        {/* Auto Generate Certificate */}
        <div className="flex items-start justify-between p-4 bg-secondary/30 rounded-xl border border-border">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">Auto-generate Certificate</p>
              {hasDefaultCertTemplate ? (
                <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">Template ready</span>
              ) : (
                <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full">No default template</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Creates a participation certificate using your default certificate template.
            </p>
          </div>
          <Switch
            checked={formData.auto_generate_certificate}
            onCheckedChange={(checked) => {
              if (checked && !hasDefaultCertTemplate) {
                toast.warning("Create a default certificate template first: Certificates → Templates → mark as Default")
              }
              setFormData(prev => ({ ...prev, auto_generate_certificate: checked }))
            }}
          />
        </div>

        {/* Auto Email Certificate */}
        <div className={cn(
          "flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-border ml-6",
          !formData.auto_generate_certificate && "opacity-50"
        )}>
          <div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">Auto-email Certificate</p>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Send certificate to attendee after generation
            </p>
          </div>
          <Switch
            checked={formData.auto_email_certificate}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, auto_email_certificate: checked }))}
            disabled={!formData.auto_generate_certificate}
          />
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-border">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Automation Settings
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
