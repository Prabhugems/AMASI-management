"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Settings,
  IndianRupee,
  Percent,
  FileText,
  Save,
  Loader2,
  AlertCircle,
  Globe,
  Clock,
  Shield,
} from "lucide-react"

interface TicketSettings {
  default_tax_percentage: number
  default_currency: string
  default_min_per_order: number
  default_max_per_order: number
  allow_waitlist: boolean
  require_approval_by_default: boolean
  show_remaining_tickets: boolean
  registration_closes_before_event_hours: number
}

const defaultSettings: TicketSettings = {
  default_tax_percentage: 18,
  default_currency: "INR",
  default_min_per_order: 1,
  default_max_per_order: 10,
  allow_waitlist: false,
  require_approval_by_default: false,
  show_remaining_tickets: true,
  registration_closes_before_event_hours: 0,
}

export default function TicketSettingsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [settings, setSettings] = useState<TicketSettings>(defaultSettings)
  const [hasChanges, setHasChanges] = useState(false)

  // Fetch event settings
  const { data: eventSettings, isLoading } = useQuery({
    queryKey: ["event-ticket-settings", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("settings")
        .eq("id", eventId)
        .single() as { data: { settings: Record<string, unknown> | null } | null }
      // Return null instead of undefined to satisfy React Query
      const eventData = data?.settings
      return (eventData?.tickets as TicketSettings) || null
    },
    enabled: !!eventId,
  })

  // Fetch available forms
  const { data: availableForms } = useQuery({
    queryKey: ["available-forms", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("forms")
        .select("id, name, slug, status")
        .or(`event_id.eq.${eventId},event_id.is.null`)
        .eq("status", "published")
        .order("name")
      return data || []
    },
    enabled: !!eventId,
  })

  useEffect(() => {
    if (eventSettings && typeof eventSettings === 'object') {
      setSettings({ ...defaultSettings, ...eventSettings })
    }
  }, [eventSettings])

  const updateSettings = (key: keyof TicketSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // First get current settings
      const { data: event } = await supabase
        .from("events")
        .select("settings")
        .eq("id", eventId)
        .single() as { data: { settings: Record<string, unknown> | null } | null }

      const currentSettings = (event?.settings || {}) as Record<string, unknown>

      // Update with new ticket settings
      const { error } = await (supabase
        .from("events") as ReturnType<typeof supabase.from>)
        .update({
          settings: {
            ...currentSettings,
            tickets: settings,
          },
        })
        .eq("id", eventId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-ticket-settings", eventId] })
      setHasChanges(false)
      toast.success("Settings saved successfully")
    },
    onError: () => {
      toast.error("Failed to save settings")
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Ticket Settings
          </h1>
          <p className="text-muted-foreground mt-1">Configure default settings for ticket creation</p>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!hasChanges || saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      {hasChanges && (
        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">You have unsaved changes</span>
        </div>
      )}

      <div className="space-y-6">
        {/* Pricing Defaults */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IndianRupee className="h-5 w-5" />
              Pricing Defaults
            </CardTitle>
            <CardDescription>Default values when creating new tickets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Default Currency</label>
                <Select
                  value={settings.default_currency}
                  onValueChange={(value) => updateSettings("default_currency", value)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR (Indian Rupee)</SelectItem>
                    <SelectItem value="USD">USD (US Dollar)</SelectItem>
                    <SelectItem value="EUR">EUR (Euro)</SelectItem>
                    <SelectItem value="GBP">GBP (British Pound)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Default GST %
                </label>
                <Input
                  type="number"
                  value={settings.default_tax_percentage}
                  onChange={(e) => updateSettings("default_tax_percentage", parseFloat(e.target.value) || 0)}
                  className="mt-1.5"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quantity Limits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5" />
              Order Limits
            </CardTitle>
            <CardDescription>Default quantity limits per order</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Min per Order</label>
                <Input
                  type="number"
                  value={settings.default_min_per_order}
                  onChange={(e) => updateSettings("default_min_per_order", parseInt(e.target.value) || 1)}
                  min={1}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">Minimum tickets per order</p>
              </div>
              <div>
                <label className="text-sm font-medium">Max per Order</label>
                <Input
                  type="number"
                  value={settings.default_max_per_order}
                  onChange={(e) => updateSettings("default_max_per_order", parseInt(e.target.value) || 10)}
                  min={1}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">Maximum tickets per order</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Registration Behavior */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              Registration Behavior
            </CardTitle>
            <CardDescription>Control how registration works</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Close Registration Before Event</label>
              <div className="flex items-center gap-2 mt-1.5">
                <Input
                  type="number"
                  value={settings.registration_closes_before_event_hours}
                  onChange={(e) => updateSettings("registration_closes_before_event_hours", parseInt(e.target.value) || 0)}
                  min={0}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">hours before event starts</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Set to 0 to allow registration until event starts</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
              <div>
                <p className="font-medium text-sm">Show Remaining Tickets</p>
                <p className="text-xs text-muted-foreground">Display availability on registration page</p>
              </div>
              <Switch
                checked={settings.show_remaining_tickets}
                onCheckedChange={(checked) => updateSettings("show_remaining_tickets", checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
              <div>
                <p className="font-medium text-sm">Enable Waitlist</p>
                <p className="text-xs text-muted-foreground">Allow waitlist when tickets are sold out</p>
              </div>
              <Switch
                checked={settings.allow_waitlist}
                onCheckedChange={(checked) => updateSettings("allow_waitlist", checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Approval Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" />
              Approval Settings
            </CardTitle>
            <CardDescription>Control registration approval workflow</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
              <div>
                <p className="font-medium text-sm">Require Approval by Default</p>
                <p className="text-xs text-muted-foreground">New tickets will require manual approval</p>
              </div>
              <Switch
                checked={settings.require_approval_by_default}
                onCheckedChange={(checked) => updateSettings("require_approval_by_default", checked)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
