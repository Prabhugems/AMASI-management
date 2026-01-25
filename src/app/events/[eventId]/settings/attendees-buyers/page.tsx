"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Users,
  User,
  Save,
  Loader2,
  CheckCircle2,
  Info,
  Hash,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface EventSettings {
  id?: string
  event_id: string
  allow_attendee_login: boolean
  allow_multiple_ticket_types: boolean
  allow_multiple_addons: boolean
  customize_registration_id: boolean
  registration_prefix: string | null
  registration_start_number: number
  registration_suffix: string | null
  current_registration_number: number
  allow_buyers: boolean
  buyer_form_id: string | null
  require_approval: boolean
  send_confirmation_email: boolean
}

interface Form {
  id: string
  name: string
  form_type: string
}

export default function AttendeesBuyersSettingsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [settings, setSettings] = useState<Partial<EventSettings>>({
    allow_attendee_login: false,
    allow_multiple_ticket_types: false,
    allow_multiple_addons: true,
    customize_registration_id: false,
    registration_prefix: "",
    registration_start_number: 1,
    registration_suffix: "",
    current_registration_number: 0,
    allow_buyers: false,
    buyer_form_id: null,
    require_approval: false,
    send_confirmation_email: true,
  })

  // Fetch event settings using API route
  const { data: settingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ["event-settings", eventId],
    queryFn: async () => {
      const response = await fetch(`/api/event-settings?event_id=${eventId}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to fetch settings")
      }
      return response.json() as Promise<EventSettings>
    },
    enabled: !!eventId,
  })

  // Fetch forms for buyer form selection
  const { data: forms } = useQuery({
    queryKey: ["buyer-forms", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("id, name, form_type")
        .eq("event_id", eventId)
        .eq("status", "published")

      if (error) throw error
      return data as Form[]
    },
    enabled: !!eventId,
  })

  // Initialize form data when settings load
  useEffect(() => {
    if (settingsData) {
      setSettings(settingsData)
    }
  }, [settingsData])

  // Save mutation using API route
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<EventSettings>) => {
      const payload = {
        event_id: eventId,
        allow_attendee_login: data.allow_attendee_login,
        allow_multiple_ticket_types: data.allow_multiple_ticket_types,
        allow_multiple_addons: data.allow_multiple_addons,
        customize_registration_id: data.customize_registration_id,
        registration_prefix: data.registration_prefix || null,
        registration_start_number: data.registration_start_number || 1,
        registration_suffix: data.registration_suffix || null,
        allow_buyers: data.allow_buyers,
        buyer_form_id: data.buyer_form_id || null,
        require_approval: data.require_approval,
        send_confirmation_email: data.send_confirmation_email,
      }

      const response = await fetch("/api/event-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save settings")
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-settings", eventId] })
      toast.success("Settings saved successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save settings")
    },
  })

  // Generate registration ID preview
  const registrationPreview = settings.customize_registration_id
    ? `${settings.registration_prefix || ""}${String(settings.registration_start_number || 1).padStart(4, "0")}${settings.registration_suffix || ""}`
    : `REG-${String(settings.registration_start_number || 1).padStart(6, "0")}`

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attendees & Buyers</h1>
          <p className="text-muted-foreground mt-1">
            Configure registration and buyer settings
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate(settings)}
          disabled={saveMutation.isPending}
          className="gap-2"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>

      {/* Success Message */}
      {saveMutation.isSuccess && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 text-success border border-success/20">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm">Settings saved successfully!</span>
        </div>
      )}

      <div className="space-y-6">
        {/* LOGIN SECTION */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Login</h3>
              <p className="text-sm text-muted-foreground">Attendee login options</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <Switch
              checked={settings.allow_attendee_login ?? false}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, allow_attendee_login: checked })
              }
            />
            <div>
              <p className="font-medium">Allow login of attendees & buyers</p>
              <p className="text-sm text-muted-foreground mt-1">
                If enabled, attendees and buyers can login to view, purchase, cancel or modify their tickets.
              </p>
            </div>
          </div>
        </div>

        {/* ATTENDEES SECTION */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-info" />
            </div>
            <div>
              <h3 className="font-semibold">Attendees</h3>
              <p className="text-sm text-muted-foreground">Configure how attendees register</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Multiple Ticket Types */}
            <div className="flex items-start gap-4">
              <Switch
                checked={settings.allow_multiple_ticket_types ?? false}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, allow_multiple_ticket_types: checked })
                }
              />
              <div>
                <p className="font-medium">Allow selection of multiple ticket types</p>
                <p className="text-sm text-muted-foreground mt-1">
                  If enabled, attendees can purchase various types of tickets
                </p>
                <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-md text-sm">
                  <p className="text-amber-800 dark:text-amber-200">
                    <strong>Note:</strong> This is rarely needed. Usually each person buys only one ticket type.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Multiple Add-on Types */}
            <div className="flex items-start gap-4">
              <Switch
                checked={settings.allow_multiple_addons ?? true}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, allow_multiple_addons: checked })
                }
              />
              <div>
                <p className="font-medium">Allow selection of multiple add-on types</p>
                <p className="text-sm text-muted-foreground mt-1">
                  If enabled, attendees can purchase various types of add-ons
                </p>
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md text-sm">
                  <p className="text-blue-800 dark:text-blue-200">
                    <strong>Example:</strong> Attendee can select Workshop + Accommodation + Gala Dinner together.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Customize Registration ID */}
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <Switch
                  checked={settings.customize_registration_id ?? false}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, customize_registration_id: checked })
                  }
                />
                <div>
                  <p className="font-medium">Customize registration ID</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Customize your Registration ID format to fit your event needs.
                  </p>
                </div>
              </div>

              {/* Registration ID Configuration */}
              <div className="ml-12 space-y-4">
                {/* Preview Box */}
                <div className="inline-flex items-center gap-2 bg-secondary rounded-full px-4 py-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Preview: </span>
                  <span className="font-mono font-medium">{registrationPreview}</span>
                </div>

                {/* Input Fields */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Prefix (optional)</label>
                    <Input
                      placeholder="e.g., FMAS108-"
                      value={settings.registration_prefix || ""}
                      onChange={(e) =>
                        setSettings({ ...settings, registration_prefix: e.target.value })
                      }
                      disabled={!settings.customize_registration_id}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Starting Number</label>
                    <Input
                      type="number"
                      min={1}
                      value={settings.registration_start_number || 1}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          registration_start_number: parseInt(e.target.value) || 1,
                        })
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Suffix (optional)</label>
                    <Input
                      placeholder="e.g., -DEL"
                      value={settings.registration_suffix || ""}
                      onChange={(e) =>
                        setSettings({ ...settings, registration_suffix: e.target.value })
                      }
                      disabled={!settings.customize_registration_id}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Examples */}
                <div className="p-3 bg-secondary/50 rounded-md text-sm">
                  <p className="font-medium text-foreground mb-2">Examples:</p>
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <div>
                      FMAS Skill Course: <code className="bg-background px-1 rounded">FMAS108-0001</code>
                    </div>
                    <div>
                      AMASICON: <code className="bg-background px-1 rounded">AMASI26-1001</code>
                    </div>
                    <div>
                      Convocation: <code className="bg-background px-1 rounded">CONV25-001</code>
                    </div>
                    <div>
                      Workshop: <code className="bg-background px-1 rounded">WS-0001-BLR</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BUYERS SECTION */}
        <div
          className={cn(
            "bg-card border rounded-xl p-6 space-y-6",
            settings.allow_buyers ? "border-primary/50" : "border-border"
          )}
        >
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div
              className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center",
                settings.allow_buyers ? "bg-primary/20" : "bg-warning/10"
              )}
            >
              <Users
                className={cn(
                  "h-5 w-5",
                  settings.allow_buyers ? "text-primary" : "text-warning"
                )}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Buyers</h3>
                {settings.allow_buyers && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    Group Booking Enabled
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">Enable group registration / bulk booking</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <Switch
                checked={settings.allow_buyers ?? false}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, allow_buyers: checked })
                }
              />
              <div className="flex-1">
                <p className="font-medium">Allow Buyers</p>
                <p className="text-sm text-muted-foreground mt-1">
                  A buyer is someone who purchases or registers for one or more tickets on behalf of others.
                  Enabling buyers allows group bookings.
                </p>
              </div>
            </div>

            {/* Detailed Explanation */}
            <div className="ml-12 grid md:grid-cols-2 gap-4">
              {/* When OFF */}
              <div
                className={cn(
                  "p-4 rounded-lg border-2",
                  !settings.allow_buyers
                    ? "border-muted-foreground/30 bg-secondary/50"
                    : "border-border"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={cn(
                      "w-3 h-3 rounded-full",
                      !settings.allow_buyers ? "bg-muted-foreground" : "bg-muted"
                    )}
                  />
                  <p className="font-medium">When OFF (Default)</p>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Only Individual Registration available</li>
                  <li>• Each person registers themselves</li>
                  <li>• One payment = One attendee</li>
                  <li>• Best for: Open public events</li>
                </ul>
              </div>

              {/* When ON */}
              <div
                className={cn(
                  "p-4 rounded-lg border-2",
                  settings.allow_buyers
                    ? "border-primary bg-primary/5"
                    : "border-border"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={cn(
                      "w-3 h-3 rounded-full",
                      settings.allow_buyers ? "bg-primary" : "bg-muted"
                    )}
                  />
                  <p className="font-medium">When ON</p>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Both Individual & Group options shown</li>
                  <li>• Buyer (coordinator) registers multiple people</li>
                  <li>• Single payment for entire group</li>
                  <li>• Best for: Hospital/Institute bookings</li>
                </ul>
              </div>
            </div>

            {/* Buyer Form Selection */}
            {settings.allow_buyers && (
              <div className="ml-12 space-y-3 pt-4 border-t border-border">
                <label className="text-sm font-medium">
                  Select a form to collect buyer details
                </label>
                <Select
                  value={settings.buyer_form_id || "none"}
                  onValueChange={(value) =>
                    setSettings({
                      ...settings,
                      buyer_form_id: value === "none" ? null : value,
                    })
                  }
                >
                  <SelectTrigger className="w-72">
                    <SelectValue placeholder="Choose a Form" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No custom form</SelectItem>
                    {forms?.map((form) => (
                      <SelectItem key={form.id} value={form.id}>
                        {form.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md">
                  <Info className="h-4 w-4 text-blue-500 mt-0.5" />
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    If no form is selected, only <span className="font-semibold">name</span> and{" "}
                    <span className="font-semibold">email address</span> will be collected from the buyer by default.
                  </p>
                </div>

                {/* Use Case Examples */}
                <div className="p-3 bg-secondary/50 rounded-md text-sm">
                  <p className="font-medium text-foreground mb-2">Use cases for Group Booking:</p>
                  <ul className="text-muted-foreground space-y-1">
                    <li>✓ Hospital coordinator registering 10 surgeons for FMAS course</li>
                    <li>✓ Institute admin booking conference passes for faculty</li>
                    <li>✓ Department head registering PG students for workshop</li>
                    <li>✓ Event manager booking for company delegation</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
