"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Loader2,
  Save,
  Plus,
  Trash2,
  ExternalLink,
  ScrollText,
  FileText,
  Award,
  Receipt,
  CalendarDays,
  ShoppingCart,
} from "lucide-react"
import { toast } from "sonner"

interface CustomLink {
  name: string
  url: string
}

interface DelegatePortalSettings {
  show_invitation: boolean
  show_badge: boolean
  show_certificate: boolean
  show_receipt: boolean
  show_program_schedule: boolean
  show_addons: boolean
  whatsapp_group_url: string
  custom_links: CustomLink[]
}

const DEFAULTS: DelegatePortalSettings = {
  show_invitation: true,
  show_badge: true,
  show_certificate: true,
  show_receipt: true,
  show_program_schedule: true,
  show_addons: true,
  whatsapp_group_url: "",
  custom_links: [],
}

const TOGGLE_CONFIG = [
  { key: "show_invitation" as const, label: "Invitation Letter", icon: ScrollText, description: "Download invitation letter PDF" },
  { key: "show_badge" as const, label: "Badge Download", icon: FileText, description: "Download name badge PDF" },
  { key: "show_certificate" as const, label: "Certificate Download", icon: Award, description: "Download participation certificate" },
  { key: "show_receipt" as const, label: "Payment Receipt", icon: Receipt, description: "Download payment receipt" },
  { key: "show_program_schedule" as const, label: "Program Schedule", icon: CalendarDays, description: "View event program schedule" },
  { key: "show_addons" as const, label: "Add-ons Store", icon: ShoppingCart, description: "Browse and purchase add-ons" },
]

export default function DelegatePortalSettingsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState<DelegatePortalSettings>(DEFAULTS)
  const [hasChanges, setHasChanges] = useState(false)

  const { data: fetchedData, isLoading } = useQuery({
    queryKey: ["delegate-portal-settings", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/delegate-portal-settings`)
      if (!res.ok) throw new Error("Failed to fetch settings")
      const data = await res.json()
      return data.delegate_portal as DelegatePortalSettings
    },
    enabled: !!eventId,
    staleTime: 0,
  })

  useEffect(() => {
    if (fetchedData) {
      setFormData(fetchedData)
      setHasChanges(false)
    }
  }, [fetchedData])

  const saveMutation = useMutation({
    mutationFn: async (settings: DelegatePortalSettings) => {
      const res = await fetch(`/api/events/${eventId}/delegate-portal-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delegate_portal: settings }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Settings saved")
      setHasChanges(false)
      queryClient.invalidateQueries({ queryKey: ["delegate-portal-settings", eventId] })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const updateField = <K extends keyof DelegatePortalSettings>(key: K, value: DelegatePortalSettings[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const addCustomLink = () => {
    if (formData.custom_links.length >= 5) return
    updateField("custom_links", [...formData.custom_links, { name: "", url: "" }])
  }

  const updateCustomLink = (index: number, field: keyof CustomLink, value: string) => {
    const updated = [...formData.custom_links]
    updated[index] = { ...updated[index], [field]: value }
    updateField("custom_links", updated)
  }

  const removeCustomLink = (index: number) => {
    updateField("custom_links", formData.custom_links.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    saveMutation.mutate(formData)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Portal Settings</h1>
        <p className="text-muted-foreground">
          Control what delegates see in the self-service portal.
        </p>
      </div>

      {/* Section A: Feature Toggles */}
      <section className="space-y-1">
        <h2 className="text-lg font-semibold mb-3">Feature Toggles</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Toggle features on or off for the delegate portal. Disabled features will be hidden from delegates.
        </p>
        <div className="bg-card border rounded-lg divide-y">
          {TOGGLE_CONFIG.map((toggle) => {
            const Icon = toggle.icon
            return (
              <div key={toggle.key} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{toggle.label}</p>
                    <p className="text-xs text-muted-foreground">{toggle.description}</p>
                  </div>
                </div>
                <Switch
                  checked={formData[toggle.key]}
                  onCheckedChange={(checked) => updateField(toggle.key, checked)}
                />
              </div>
            )
          })}
        </div>
      </section>

      {/* Section B: WhatsApp Group */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">WhatsApp Group</h2>
        <p className="text-sm text-muted-foreground">
          When set, a green WhatsApp card appears in the delegate portal linking to this group.
        </p>
        <Input
          placeholder="https://chat.whatsapp.com/..."
          value={formData.whatsapp_group_url}
          onChange={(e) => updateField("whatsapp_group_url", e.target.value)}
        />
      </section>

      {/* Section C: Resource Links */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Resource Links</h2>
            <p className="text-sm text-muted-foreground">
              Add up to 5 custom links (course materials, hotel info, etc.) shown as cards in the portal.
            </p>
          </div>
          {formData.custom_links.length < 5 && (
            <Button variant="outline" size="sm" onClick={addCustomLink}>
              <Plus className="h-4 w-4 mr-1" />
              Add Link
            </Button>
          )}
        </div>

        {formData.custom_links.length === 0 ? (
          <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground">
            <ExternalLink className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No resource links added yet.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={addCustomLink}>
              <Plus className="h-4 w-4 mr-1" />
              Add First Link
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {formData.custom_links.map((link, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Display Name"
                    value={link.name}
                    onChange={(e) => updateCustomLink(index, "name", e.target.value)}
                  />
                  <Input
                    placeholder="https://..."
                    value={link.url}
                    onChange={(e) => updateCustomLink(index, "url", e.target.value)}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
                  onClick={() => removeCustomLink(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section D: Portal Preview */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Portal Preview</h2>
        <p className="text-sm text-muted-foreground">
          Test the delegate portal to see how delegates will experience it.
        </p>
        <a
          href="/my"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ExternalLink className="h-4 w-4" />
          Open Delegate Portal (/my)
        </a>
      </section>

      {/* Sticky Save Bar */}
      {hasChanges && (
        <div className="sticky bottom-0 -mx-6 px-6 py-3 bg-background border-t flex items-center justify-end gap-3">
          <p className="text-sm text-muted-foreground mr-auto">You have unsaved changes</p>
          <Button
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["delegate-portal-settings", eventId] })
              setHasChanges(false)
            }}
          >
            Discard
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
