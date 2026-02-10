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
  Settings,
  Save,
  Loader2,
  AlertCircle,
  Package,
  ShoppingCart,
  Eye,
} from "lucide-react"

interface AddonSettings {
  default_max_quantity: number
  show_addons_on_registration: boolean
  allow_addon_only_purchase: boolean
  show_addon_images: boolean
  show_addon_descriptions: boolean
}

const defaultSettings: AddonSettings = {
  default_max_quantity: 5,
  show_addons_on_registration: true,
  allow_addon_only_purchase: false,
  show_addon_images: true,
  show_addon_descriptions: true,
}

export default function AddonSettingsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [settings, setSettings] = useState<AddonSettings>(defaultSettings)
  const [hasChanges, setHasChanges] = useState(false)

  // Fetch event settings
  const { data: eventSettings, isLoading } = useQuery({
    queryKey: ["event-addon-settings", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("settings")
        .eq("id", eventId)
        .single() as { data: { settings: Record<string, unknown> | null } | null }
      const eventData = data?.settings
      return (eventData?.addons as AddonSettings) || null
    },
    enabled: !!eventId,
  })

  useEffect(() => {
    if (eventSettings && typeof eventSettings === 'object') {
      setSettings({ ...defaultSettings, ...eventSettings })
    }
  }, [eventSettings])

  const updateSettings = (key: keyof AddonSettings, value: any) => {
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

      // Update with new addon settings
      const { error } = await (supabase
        .from("events") as ReturnType<typeof supabase.from>)
        .update({
          settings: {
            ...currentSettings,
            addons: settings,
          },
        })
        .eq("id", eventId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-addon-settings", eventId] })
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
            Add-on Settings
          </h1>
          <p className="text-muted-foreground mt-1">Configure default settings for add-ons</p>
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
        {/* Default Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5" />
              Default Settings
            </CardTitle>
            <CardDescription>Default values when creating new add-ons</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Default Max Quantity per Order</label>
              <Input
                type="number"
                value={settings.default_max_quantity}
                onChange={(e) => updateSettings("default_max_quantity", parseInt(e.target.value) || 1)}
                min={1}
                className="mt-1.5 w-32"
              />
              <p className="text-xs text-muted-foreground mt-1">Maximum quantity an attendee can purchase</p>
            </div>
          </CardContent>
        </Card>

        {/* Registration Behavior */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShoppingCart className="h-5 w-5" />
              Registration Behavior
            </CardTitle>
            <CardDescription>Control how add-ons appear during registration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
              <div>
                <p className="font-medium text-sm">Show Add-ons on Registration Page</p>
                <p className="text-xs text-muted-foreground">Display available add-ons during ticket registration</p>
              </div>
              <Switch
                checked={settings.show_addons_on_registration}
                onCheckedChange={(checked) => updateSettings("show_addons_on_registration", checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
              <div>
                <p className="font-medium text-sm">Allow Add-on Only Purchase</p>
                <p className="text-xs text-muted-foreground">Allow purchasing add-ons without a ticket</p>
              </div>
              <Switch
                checked={settings.allow_addon_only_purchase}
                onCheckedChange={(checked) => updateSettings("allow_addon_only_purchase", checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Display Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Eye className="h-5 w-5" />
              Display Settings
            </CardTitle>
            <CardDescription>Configure how add-ons are displayed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
              <div>
                <p className="font-medium text-sm">Show Add-on Images</p>
                <p className="text-xs text-muted-foreground">Display add-on images on registration page</p>
              </div>
              <Switch
                checked={settings.show_addon_images}
                onCheckedChange={(checked) => updateSettings("show_addon_images", checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
              <div>
                <p className="font-medium text-sm">Show Add-on Descriptions</p>
                <p className="text-xs text-muted-foreground">Display descriptions for each add-on</p>
              </div>
              <Switch
                checked={settings.show_addon_descriptions}
                onCheckedChange={(checked) => updateSettings("show_addon_descriptions", checked)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
