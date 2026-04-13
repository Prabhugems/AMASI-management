"use client"

import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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
  CreditCard,
  Mail,
  MessageCircle,
  Loader2,
  Save,
  AlertTriangle,
  CheckCircle2,
  Plug,
} from "lucide-react"
import { toast } from "sonner"

interface IntegrationsSectionProps {
  eventId: string
}

interface RazorpayConfig {
  key_id: string
  key_secret: string
  payment_mode: "test" | "live"
}

interface EmailConfig {
  from_name: string
  from_email: string
  reply_to_email: string
}

interface WhatsAppConfig {
  enabled: boolean
  api_key: string
  from_number: string
}

interface IntegrationsData {
  razorpay: RazorpayConfig
  email: EmailConfig
  whatsapp: WhatsAppConfig
}

const DEFAULT_INTEGRATIONS: IntegrationsData = {
  razorpay: { key_id: "", key_secret: "", payment_mode: "test" },
  email: { from_name: "", from_email: "", reply_to_email: "" },
  whatsapp: { enabled: false, api_key: "", from_number: "" },
}

// Placeholder shown when a secret is stored but not returned from API
const SECRET_PLACEHOLDER = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"

export function IntegrationsSection({ eventId }: IntegrationsSectionProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  const { data: storedIntegrations, isLoading } = useQuery({
    queryKey: ["event-integrations", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_settings")
        .select("integrations")
        .eq("event_id", eventId)
        .maybeSingle()

      if (error) throw error
      return (data?.integrations as Partial<IntegrationsData>) || {}
    },
    enabled: !!eventId,
  })

  const [formData, setFormData] = useState<IntegrationsData>(DEFAULT_INTEGRATIONS)

  // Track whether secrets were originally configured (so we can show "Configured" badge)
  const [secretsConfigured, setSecretsConfigured] = useState({
    razorpay_secret: false,
    gallabox_api_key: false,
  })

  // Track whether the user has typed into secret fields (so we only send new values)
  const [secretsDirty, setSecretsDirty] = useState({
    razorpay_secret: false,
    gallabox_api_key: false,
  })

  useEffect(() => {
    if (storedIntegrations) {
      const rz = storedIntegrations.razorpay || DEFAULT_INTEGRATIONS.razorpay
      const em = storedIntegrations.email || DEFAULT_INTEGRATIONS.email
      const wa = storedIntegrations.whatsapp || DEFAULT_INTEGRATIONS.whatsapp

      setFormData({
        razorpay: {
          key_id: rz.key_id || "",
          key_secret: "", // never populate actual secret
          payment_mode: rz.payment_mode || "test",
        },
        email: {
          from_name: em.from_name || "",
          from_email: em.from_email || "",
          reply_to_email: em.reply_to_email || "",
        },
        whatsapp: {
          enabled: wa.enabled ?? false,
          api_key: "", // never populate actual secret
          from_number: wa.from_number || "",
        },
      })

      setSecretsConfigured({
        razorpay_secret: !!rz.key_secret,
        gallabox_api_key: !!wa.api_key,
      })

      setSecretsDirty({
        razorpay_secret: false,
        gallabox_api_key: false,
      })
    }
  }, [storedIntegrations])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: any = {
        razorpay: {
          key_id: formData.razorpay.key_id,
          payment_mode: formData.razorpay.payment_mode,
        },
        email: { ...formData.email },
        whatsapp: {
          enabled: formData.whatsapp.enabled,
          from_number: formData.whatsapp.from_number,
        },
      }

      // Only send secret if user typed a new value
      if (secretsDirty.razorpay_secret) {
        payload.razorpay.key_secret = formData.razorpay.key_secret
      } else if (secretsConfigured.razorpay_secret) {
        // Preserve existing secret by signaling to backend
        payload.razorpay.key_secret = "__KEEP__"
      }

      if (secretsDirty.gallabox_api_key) {
        payload.whatsapp.api_key = formData.whatsapp.api_key
      } else if (secretsConfigured.gallabox_api_key) {
        payload.whatsapp.api_key = "__KEEP__"
      }

      const res = await fetch("/api/event-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, integrations: payload }),
      })
      if (!res.ok) throw new Error("Failed to save")
      await queryClient.invalidateQueries({ queryKey: ["event-integrations", eventId] })
      toast.success("Integration settings saved")
    } catch (error) {
      console.error("Failed to save integration settings:", error)
      toast.error("Failed to save integration settings")
    }
    setSaving(false)
  }

  const razorpayConfigured = !!(formData.razorpay.key_id && (secretsConfigured.razorpay_secret || secretsDirty.razorpay_secret))

  const maskValue = (value: string) => {
    if (!value || value.length <= 4) return value
    return "\u2022".repeat(value.length - 4) + value.slice(-4)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Main Header */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Plug className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-semibold">Integration Settings</h3>
            <p className="text-sm text-muted-foreground">Configure payment, email, and messaging integrations for this event</p>
          </div>
        </div>

        {/* Razorpay Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-500" />
              <h4 className="font-medium">Payment &mdash; Razorpay</h4>
            </div>
            {razorpayConfigured ? (
              <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="h-3 w-3" />
                Configured
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 px-2.5 py-1 rounded-full">
                Not configured
              </span>
            )}
          </div>

          {formData.razorpay.payment_mode === "test" && (
            <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
              <p className="text-sm text-orange-700 dark:text-orange-300">
                <strong>TEST MODE</strong> &mdash; no real payments will be processed
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Razorpay Key ID</label>
              <Input
                value={formData.razorpay.key_id}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  razorpay: { ...prev.razorpay, key_id: e.target.value },
                }))}
                placeholder="rzp_test_..."
              />
              {formData.razorpay.key_id && (
                <p className="text-xs text-muted-foreground">
                  Showing: {maskValue(formData.razorpay.key_id)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Razorpay Key Secret</label>
              <Input
                type="password"
                value={formData.razorpay.key_secret}
                onChange={(e) => {
                  setFormData(prev => ({
                    ...prev,
                    razorpay: { ...prev.razorpay, key_secret: e.target.value },
                  }))
                  setSecretsDirty(prev => ({ ...prev, razorpay_secret: true }))
                }}
                placeholder={secretsConfigured.razorpay_secret ? SECRET_PLACEHOLDER : "Enter key secret"}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Mode</label>
              <Select
                value={formData.razorpay.payment_mode}
                onValueChange={(value: "test" | "live") => setFormData(prev => ({
                  ...prev,
                  razorpay: { ...prev.razorpay, payment_mode: value },
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="test">Test</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Email Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-violet-500" />
            <h4 className="font-medium">Email &mdash; ZeptoMail / SMTP</h4>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">From Name</label>
              <Input
                value={formData.email.from_name}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  email: { ...prev.email, from_name: e.target.value },
                }))}
                placeholder="e.g. AMASICON 2026"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">From Email</label>
              <Input
                type="email"
                value={formData.email.from_email}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  email: { ...prev.email, from_email: e.target.value },
                }))}
                placeholder="noreply@yourdomain.com"
              />
              <p className="text-xs text-muted-foreground">Must be a verified sender address</p>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Reply-to Email</label>
              <Input
                type="email"
                value={formData.email.reply_to_email}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  email: { ...prev.email, reply_to_email: e.target.value },
                }))}
                placeholder="Defaults to event contact email if empty"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* WhatsApp Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            <h4 className="font-medium">WhatsApp &mdash; GallaBox</h4>
          </div>

          <div className="flex items-start justify-between p-4 bg-secondary/30 rounded-xl border border-border">
            <div className="flex-1 pr-4">
              <p className="font-medium">WhatsApp Enabled</p>
              <p className="text-sm text-muted-foreground mt-1">
                Enable WhatsApp messaging for this event via GallaBox
              </p>
            </div>
            <Switch
              checked={formData.whatsapp.enabled}
              onCheckedChange={(checked) => setFormData(prev => ({
                ...prev,
                whatsapp: { ...prev.whatsapp, enabled: checked },
              }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">GallaBox API Key</label>
              <Input
                type="password"
                value={formData.whatsapp.api_key}
                onChange={(e) => {
                  setFormData(prev => ({
                    ...prev,
                    whatsapp: { ...prev.whatsapp, api_key: e.target.value },
                  }))
                  setSecretsDirty(prev => ({ ...prev, gallabox_api_key: true }))
                }}
                placeholder={secretsConfigured.gallabox_api_key ? SECRET_PLACEHOLDER : "Enter API key"}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">WhatsApp From Number</label>
              <Input
                value={formData.whatsapp.from_number}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  whatsapp: { ...prev.whatsapp, from_number: e.target.value },
                }))}
                placeholder="+919876543210"
              />
              <p className="text-xs text-muted-foreground">E.164 format (e.g. +919876543210)</p>
            </div>
          </div>
        </div>

        {/* Save Button */}
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
                Save Integration Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
