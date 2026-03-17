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
  Hash,
} from "lucide-react"
import { toast } from "sonner"

function SectionSaveButton({ onClick, isPending }: { onClick: () => void; isPending: boolean }) {
  return (
    <Button
      size="sm"
      onClick={onClick}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Save className="h-4 w-4 mr-2" />
      )}
      Save
    </Button>
  )
}

export default function RegistrationSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [approvalSettings, setApprovalSettings] = useState({
    require_approval: false,
    allow_cancellation: true,
    cancellation_deadline_hours: 24,
  })

  const [duplicateSettings, setDuplicateSettings] = useState({
    allow_duplicate_email: true,
    show_duplicate_warning: true,
  })

  const [notificationSettings, setNotificationSettings] = useState({
    send_confirmation_email: true,
    send_reminder_email: true,
  })

  const [emailTemplate, setEmailTemplate] = useState({
    confirmation_email_subject: "Registration Confirmed",
    confirmation_email_body: "Thank you for registering for our event!",
  })

  // Registration ID format state
  const [regIdSettings, setRegIdSettings] = useState({
    customize_registration_id: false,
    registration_prefix: "",
    registration_start_number: 1,
    registration_suffix: "",
    current_registration_number: 0,
  })

  // Fetch event settings (from events table)
  const { isLoading } = useQuery({
    queryKey: ["registration-settings", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("events")
        .select("registration_settings")
        .eq("id", eventId)
        .maybeSingle()

      if (data?.registration_settings) {
        const s = data.registration_settings
        setApprovalSettings({
          require_approval: s.require_approval ?? false,
          allow_cancellation: s.allow_cancellation ?? true,
          cancellation_deadline_hours: s.cancellation_deadline_hours ?? 24,
        })
        setDuplicateSettings({
          allow_duplicate_email: s.allow_duplicate_email ?? true,
          show_duplicate_warning: s.show_duplicate_warning ?? true,
        })
        setNotificationSettings({
          send_confirmation_email: s.send_confirmation_email ?? true,
          send_reminder_email: s.send_reminder_email ?? true,
        })
        setEmailTemplate({
          confirmation_email_subject: s.confirmation_email_subject || "Registration Confirmed",
          confirmation_email_body: s.confirmation_email_body || "Thank you for registering for our event!",
        })
      }
      return data
    },
  })

  // Fetch registration ID format settings (from event_settings table)
  const { isLoading: loadingRegId } = useQuery({
    queryKey: ["event-settings-regid", eventId],
    queryFn: async () => {
      const response = await fetch(`/api/event-settings?event_id=${eventId}`)
      if (!response.ok) return null
      const data = await response.json()
      if (data) {
        setRegIdSettings({
          customize_registration_id: data.customize_registration_id ?? false,
          registration_prefix: data.registration_prefix || "",
          registration_start_number: data.registration_start_number || 1,
          registration_suffix: data.registration_suffix || "",
          current_registration_number: data.current_registration_number || 0,
        })
      }
      return data
    },
    enabled: !!eventId,
  })

  // Helper to save a section to events.registration_settings (merges with existing)
  const useSectionSave = (sectionName: string) => {
    return useMutation({
      mutationFn: async (sectionData: Record<string, any>) => {
        // First get existing settings to merge
        const { data: existing } = await (supabase as any)
          .from("events")
          .select("registration_settings")
          .eq("id", eventId)
          .maybeSingle()

        const merged = { ...(existing?.registration_settings || {}), ...sectionData }

        const { error } = await (supabase as any)
          .from("events")
          .update({ registration_settings: merged })
          .eq("id", eventId)

        if (error) throw error
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["registration-settings", eventId] })
        toast.success(`${sectionName} saved`)
      },
      onError: () => {
        toast.error(`Failed to save ${sectionName}`)
      },
    })
  }

  const saveApproval = useSectionSave("Approval settings")
  const saveDuplicate = useSectionSave("Duplicate email settings")
  const saveNotification = useSectionSave("Notification settings")
  const saveEmailTemplate = useSectionSave("Email template")

  // Save registration ID format settings (to event_settings table)
  const saveRegIdMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/event-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          ...regIdSettings,
        }),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Failed to save")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-settings-regid", eventId] })
      toast.success("Registration ID settings saved")
    },
    onError: () => {
      toast.error("Failed to save registration ID settings")
    },
  })

  const registrationPreview = regIdSettings.customize_registration_id
    ? `${regIdSettings.registration_prefix || ""}${regIdSettings.current_registration_number > 0 ? regIdSettings.current_registration_number + 1 : regIdSettings.registration_start_number}${regIdSettings.registration_suffix || ""}`
    : "REG-20260317-XXXX"

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
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Registration Settings</h1>
        <p className="text-muted-foreground">Configure registration behavior and emails</p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Registration ID Format */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Registration ID Format</h3>
            </div>
            <SectionSaveButton
              onClick={() => saveRegIdMutation.mutate()}
              isPending={saveRegIdMutation.isPending || loadingRegId}
            />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Customize Registration ID</Label>
                <p className="text-xs text-muted-foreground">
                  Use a custom format instead of the default REG-DATE-XXXX
                </p>
              </div>
              <Switch
                checked={regIdSettings.customize_registration_id}
                onCheckedChange={(checked) =>
                  setRegIdSettings({ ...regIdSettings, customize_registration_id: checked })
                }
              />
            </div>

            {/* Preview */}
            <div className="inline-flex items-center gap-2 bg-secondary rounded-full px-4 py-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Next ID: </span>
              <span className="font-mono font-medium">{registrationPreview}</span>
            </div>

            {/* Current counter info */}
            {regIdSettings.customize_registration_id && regIdSettings.current_registration_number > 0 && (
              <p className="text-xs text-muted-foreground">
                Last assigned number: <span className="font-mono font-medium">{regIdSettings.registration_prefix}{regIdSettings.current_registration_number}{regIdSettings.registration_suffix}</span>
              </p>
            )}

            {/* Input Fields */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Prefix</Label>
                <Input
                  placeholder="e.g., 122A"
                  value={regIdSettings.registration_prefix || ""}
                  onChange={(e) =>
                    setRegIdSettings({ ...regIdSettings, registration_prefix: e.target.value })
                  }
                  disabled={!regIdSettings.customize_registration_id}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Starting Number</Label>
                <Input
                  type="number"
                  min={1}
                  value={regIdSettings.registration_start_number || 1}
                  onChange={(e) =>
                    setRegIdSettings({
                      ...regIdSettings,
                      registration_start_number: parseInt(e.target.value) || 1,
                    })
                  }
                  disabled={!regIdSettings.customize_registration_id}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Suffix (optional)</Label>
                <Input
                  placeholder="e.g., -DEL"
                  value={regIdSettings.registration_suffix || ""}
                  onChange={(e) =>
                    setRegIdSettings({ ...regIdSettings, registration_suffix: e.target.value })
                  }
                  disabled={!regIdSettings.customize_registration_id}
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            {/* Examples */}
            {regIdSettings.customize_registration_id && (
              <div className="p-3 bg-secondary/50 rounded-md text-sm">
                <p className="font-medium text-foreground mb-2">Examples:</p>
                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                  <div>
                    Skill Course: <code className="bg-background px-1 rounded">122A1175</code>
                  </div>
                  <div>
                    AMASICON: <code className="bg-background px-1 rounded">AMASI26-1001</code>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Approval Settings */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Approval Settings</h3>
            </div>
            <SectionSaveButton
              onClick={() => saveApproval.mutate(approvalSettings)}
              isPending={saveApproval.isPending}
            />
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
                checked={approvalSettings.require_approval}
                onCheckedChange={(checked) =>
                  setApprovalSettings({ ...approvalSettings, require_approval: checked })
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
                checked={approvalSettings.allow_cancellation}
                onCheckedChange={(checked) =>
                  setApprovalSettings({ ...approvalSettings, allow_cancellation: checked })
                }
              />
            </div>
            {approvalSettings.allow_cancellation && (
              <div>
                <Label>Cancellation Deadline (hours before event)</Label>
                <Input
                  type="number"
                  value={approvalSettings.cancellation_deadline_hours}
                  onChange={(e) =>
                    setApprovalSettings({
                      ...approvalSettings,
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Duplicate Email Control</h3>
            </div>
            <SectionSaveButton
              onClick={() => saveDuplicate.mutate(duplicateSettings)}
              isPending={saveDuplicate.isPending}
            />
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
                checked={duplicateSettings.allow_duplicate_email}
                onCheckedChange={(checked) =>
                  setDuplicateSettings({ ...duplicateSettings, allow_duplicate_email: checked })
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
                checked={duplicateSettings.show_duplicate_warning}
                onCheckedChange={(checked) =>
                  setDuplicateSettings({ ...duplicateSettings, show_duplicate_warning: checked })
                }
              />
            </div>
            {!duplicateSettings.allow_duplicate_email && (
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

        {/* Notification Settings */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Notification Settings</h3>
            </div>
            <SectionSaveButton
              onClick={() => saveNotification.mutate(notificationSettings)}
              isPending={saveNotification.isPending}
            />
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
                checked={notificationSettings.send_confirmation_email}
                onCheckedChange={(checked) =>
                  setNotificationSettings({ ...notificationSettings, send_confirmation_email: checked })
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
                checked={notificationSettings.send_reminder_email}
                onCheckedChange={(checked) =>
                  setNotificationSettings({ ...notificationSettings, send_reminder_email: checked })
                }
              />
            </div>
          </div>
        </div>

        {/* Email Templates */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Confirmation Email Template</h3>
            </div>
            <SectionSaveButton
              onClick={() => saveEmailTemplate.mutate(emailTemplate)}
              isPending={saveEmailTemplate.isPending}
            />
          </div>
          <div className="space-y-4">
            <div>
              <Label>Subject</Label>
              <Input
                value={emailTemplate.confirmation_email_subject}
                onChange={(e) =>
                  setEmailTemplate({ ...emailTemplate, confirmation_email_subject: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea
                value={emailTemplate.confirmation_email_body}
                onChange={(e) =>
                  setEmailTemplate({ ...emailTemplate, confirmation_email_body: e.target.value })
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
