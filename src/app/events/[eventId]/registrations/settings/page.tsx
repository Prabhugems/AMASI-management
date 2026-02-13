"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Loader2,
  Save,
  Mail,
  Bell,
  Shield,
  Users,
  AlertTriangle,
  Link as LinkIcon,
  ChevronLeft,
} from "lucide-react"
import { toast } from "sonner"

export default function RegistrationSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [settings, setSettings] = useState({
    require_approval: false,
    send_confirmation_email: true,
    send_reminder_email: true,
    allow_cancellation: true,
    cancellation_deadline_hours: 24,
    confirmation_email_subject: "Registration Confirmed",
    confirmation_email_body: "Thank you for registering for our event!",
    // Duplicate email control
    allow_duplicate_email: true,
    show_duplicate_warning: true,
  })

  // Fetch event settings
  const { isLoading } = useQuery({
    queryKey: ["registration-settings", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("events")
        .select("registration_settings")
        .eq("id", eventId)
        .maybeSingle()

      if (data?.registration_settings) {
        setSettings({ ...settings, ...data.registration_settings })
      }
      return data
    },
  })

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("events")
        .update({ registration_settings: settings })
        .eq("id", eventId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registration-settings", eventId] })
      toast.success("Settings saved")
    },
    onError: () => {
      toast.error("Failed to save settings")
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Registration Settings</h1>
          <p className="text-muted-foreground">Configure registration behavior and emails</p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Approval Settings */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Approval Settings</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Require Approval</Label>
                <p className="text-xs text-muted-foreground">
                  New registrations will be pending until manually approved
                </p>
              </div>
              <Switch
                checked={settings.require_approval}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, require_approval: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Allow Cancellation</Label>
                <p className="text-xs text-muted-foreground">
                  Allow attendees to cancel their registration
                </p>
              </div>
              <Switch
                checked={settings.allow_cancellation}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, allow_cancellation: checked })
                }
              />
            </div>
            {settings.allow_cancellation && (
              <div>
                <Label>Cancellation Deadline (hours before event)</Label>
                <Input
                  type="number"
                  value={settings.cancellation_deadline_hours}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      cancellation_deadline_hours: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-32 mt-1"
                />
              </div>
            )}
          </div>
        </div>

        {/* Duplicate Email Control */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Duplicate Email Control</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Allow Multiple Registrations per Email</Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, same email can register multiple times
                </p>
              </div>
              <Switch
                checked={settings.allow_duplicate_email}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, allow_duplicate_email: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Show Warning for Existing Registrations</Label>
                <p className="text-xs text-muted-foreground">
                  Show a message when email already has a registration
                </p>
              </div>
              <Switch
                checked={settings.show_duplicate_warning}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, show_duplicate_warning: checked })
                }
              />
            </div>
            {!settings.allow_duplicate_email && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800">Duplicate emails blocked</p>
                    <p className="text-amber-700 text-xs mt-1">
                      When someone tries to register with an email that already exists, they will be redirected to the Delegate Portal to add addons or view their existing registration.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Delegate Portal Link */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-4">
            <LinkIcon className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Delegate Portal</h3>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Attendees can access their registrations, purchase additional addons, and download badges/certificates through the Delegate Portal.
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/my`}
                className="font-mono text-sm bg-muted"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/my`)
                  toast.success("Link copied to clipboard")
                }}
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this link with attendees who want to manage their registrations or purchase addons after registration.
            </p>
          </div>
        </div>

        {/* Email Settings */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Notification Settings</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Send Confirmation Email</Label>
                <p className="text-xs text-muted-foreground">
                  Send email when registration is confirmed
                </p>
              </div>
              <Switch
                checked={settings.send_confirmation_email}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, send_confirmation_email: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Send Reminder Email</Label>
                <p className="text-xs text-muted-foreground">
                  Send reminder email before the event
                </p>
              </div>
              <Switch
                checked={settings.send_reminder_email}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, send_reminder_email: checked })
                }
              />
            </div>
          </div>
        </div>

        {/* Email Templates */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Confirmation Email Template</h3>
          </div>
          <div className="space-y-4">
            <div>
              <Label>Subject</Label>
              <Input
                value={settings.confirmation_email_subject}
                onChange={(e) =>
                  setSettings({ ...settings, confirmation_email_subject: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea
                value={settings.confirmation_email_body}
                onChange={(e) =>
                  setSettings({ ...settings, confirmation_email_body: e.target.value })
                }
                rows={6}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use {"{{name}}"}, {"{{event}}"}, {"{{date}}"} for dynamic content
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
