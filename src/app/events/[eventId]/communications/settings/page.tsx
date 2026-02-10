"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Mail,
  MessageSquare,
  Phone,
  Webhook,
  Loader2,
  Eye,
  EyeOff,
  Save,
  TestTube,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type ChannelsEnabled = {
  email: boolean
  whatsapp: boolean
  sms: boolean
  webhook: boolean
}

type Settings = {
  email_provider: string
  email_api_key: string | null
  email_from_address: string | null
  email_from_name: string | null
  whatsapp_provider: string | null
  whatsapp_api_key: string | null
  whatsapp_phone_number_id: string | null
  whatsapp_business_account_id: string | null
  whatsapp_access_token: string | null
  sms_provider: string | null
  sms_api_key: string | null
  sms_sender_id: string | null
  sms_auth_token: string | null
  twilio_account_sid: string | null
  twilio_auth_token: string | null
  twilio_phone_number: string | null
  webhook_enabled: boolean
  webhook_url: string | null
  webhook_secret: string | null
  webhook_headers: Record<string, string>
  channels_enabled: ChannelsEnabled
}

const defaultSettings: Settings = {
  email_provider: "default",
  email_api_key: null,
  email_from_address: null,
  email_from_name: null,
  whatsapp_provider: null,
  whatsapp_api_key: null,
  whatsapp_phone_number_id: null,
  whatsapp_business_account_id: null,
  whatsapp_access_token: null,
  sms_provider: null,
  sms_api_key: null,
  sms_sender_id: null,
  sms_auth_token: null,
  twilio_account_sid: null,
  twilio_auth_token: null,
  twilio_phone_number: null,
  webhook_enabled: false,
  webhook_url: null,
  webhook_secret: null,
  webhook_headers: {},
  channels_enabled: { email: true, whatsapp: false, sms: false, webhook: false },
}

export default function CommunicationsSettingsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<"email" | "whatsapp" | "sms" | "webhook">("email")
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [showSecrets, setShowSecrets] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)

  // Fetch settings
  const { data, isLoading } = useQuery({
    queryKey: ["communication-settings", eventId],
    queryFn: async () => {
      const response = await fetch(`/api/communications/settings?event_id=${eventId}`)
      const result = await response.json()
      return result.settings ? { ...defaultSettings, ...result.settings } : defaultSettings
    },
  })

  useEffect(() => {
    if (data) {
      setSettings(data)
    }
  }, [data])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Settings) => {
      const response = await fetch("/api/communications/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, ...data }),
      })
      if (!response.ok) throw new Error("Failed to save")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communication-settings", eventId] })
      toast.success("Settings saved successfully")
    },
    onError: () => {
      toast.error("Failed to save settings")
    },
  })

  const handleSave = () => {
    saveMutation.mutate(settings)
  }

  const testConnection = async (channel: string) => {
    setTesting(channel)
    try {
      const credentials: Record<string, any> = {}

      if (channel === "email") {
        credentials.api_key = settings.email_api_key
      } else if (channel === "whatsapp") {
        if (settings.whatsapp_provider === "twilio") {
          credentials.account_sid = settings.twilio_account_sid
          credentials.auth_token = settings.twilio_auth_token
        } else if (settings.whatsapp_provider === "meta") {
          credentials.access_token = settings.whatsapp_access_token
        }
      } else if (channel === "webhook") {
        credentials.url = settings.webhook_url
        credentials.headers = settings.webhook_headers
      }

      const response = await fetch("/api/communications/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          provider: channel === "email" ? settings.email_provider :
                    channel === "whatsapp" ? settings.whatsapp_provider :
                    channel === "sms" ? settings.sms_provider : "custom",
          credentials,
          event_id: eventId,
        }),
      })

      const result = await response.json()
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error("Test failed")
    } finally {
      setTesting(null)
    }
  }

  const updateChannel = (channel: keyof ChannelsEnabled, enabled: boolean) => {
    setSettings({
      ...settings,
      channels_enabled: { ...settings.channels_enabled, [channel]: enabled },
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const tabs = [
    { id: "email" as const, label: "Email", icon: Mail, color: "text-blue-500" },
    { id: "whatsapp" as const, label: "WhatsApp", icon: MessageSquare, color: "text-green-500" },
    { id: "sms" as const, label: "SMS", icon: Phone, color: "text-purple-500" },
    { id: "webhook" as const, label: "Webhooks", icon: Webhook, color: "text-orange-500" },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Communication Settings</h1>
          <p className="text-muted-foreground">Configure email, WhatsApp, SMS and webhook integrations</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setShowSecrets(!showSecrets)}>
            {showSecrets ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showSecrets ? "Hide" : "Show"} Secrets
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Channel Toggles */}
      <div className="grid grid-cols-4 gap-4">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isEnabled = settings.channels_enabled[tab.id]
          return (
            <div
              key={tab.id}
              className={cn(
                "bg-card rounded-lg border p-4 cursor-pointer transition-all",
                activeTab === tab.id && "ring-2 ring-primary"
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-5 w-5", tab.color)} />
                  <span className="font-medium">{tab.label}</span>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => updateChannel(tab.id, checked)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <Badge variant={isEnabled ? "default" : "secondary"} className="text-xs">
                {isEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          )
        })}
      </div>

      {/* Settings Content */}
      <div className="bg-card rounded-lg border p-6">
        {/* Email Settings */}
        {activeTab === "email" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b">
              <Mail className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold">Email Configuration</h3>
              <Badge variant="outline" className="ml-auto">
                {settings.email_provider === "default" ? "Using Global Settings" : settings.email_provider}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email Provider</Label>
                <Select
                  value={settings.email_provider}
                  onValueChange={(value) => setSettings({ ...settings, email_provider: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Use Global Default</SelectItem>
                    <SelectItem value="resend">Resend</SelectItem>
                    <SelectItem value="blastable">Blastable</SelectItem>
                    <SelectItem value="sendgrid">SendGrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {settings.email_provider !== "default" && (
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type={showSecrets ? "text" : "password"}
                    placeholder="Enter API key"
                    value={settings.email_api_key || ""}
                    onChange={(e) => setSettings({ ...settings, email_api_key: e.target.value })}
                  />
                </div>
              )}
            </div>

            {settings.email_provider !== "default" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Name</Label>
                  <Input
                    placeholder="AMASI Events"
                    value={settings.email_from_name || ""}
                    onChange={(e) => setSettings({ ...settings, email_from_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>From Email</Label>
                  <Input
                    type="email"
                    placeholder="noreply@example.com"
                    value={settings.email_from_address || ""}
                    onChange={(e) => setSettings({ ...settings, email_from_address: e.target.value })}
                  />
                </div>
              </div>
            )}

            {settings.email_provider !== "default" && (
              <Button variant="outline" onClick={() => testConnection("email")} disabled={testing === "email"}>
                {testing === "email" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
                Test Connection
              </Button>
            )}
          </div>
        )}

        {/* WhatsApp Settings */}
        {activeTab === "whatsapp" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b">
              <MessageSquare className="h-5 w-5 text-green-500" />
              <h3 className="font-semibold">WhatsApp Configuration</h3>
            </div>

            <div className="space-y-2">
              <Label>WhatsApp Provider</Label>
              <Select
                value={settings.whatsapp_provider || ""}
                onValueChange={(value) => setSettings({ ...settings, whatsapp_provider: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meta">Meta Business API (Official)</SelectItem>
                  <SelectItem value="twilio">Twilio</SelectItem>
                  <SelectItem value="interakt">Interakt</SelectItem>
                  <SelectItem value="wati">Wati</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {settings.whatsapp_provider === "meta" && (
              <div className="space-y-4 p-4 rounded-lg bg-secondary/30">
                <h4 className="font-medium text-sm">Meta WhatsApp Business API</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone Number ID</Label>
                    <Input
                      placeholder="Enter Phone Number ID"
                      value={settings.whatsapp_phone_number_id || ""}
                      onChange={(e) => setSettings({ ...settings, whatsapp_phone_number_id: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Business Account ID</Label>
                    <Input
                      placeholder="Enter Business Account ID"
                      value={settings.whatsapp_business_account_id || ""}
                      onChange={(e) => setSettings({ ...settings, whatsapp_business_account_id: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Access Token</Label>
                  <Input
                    type={showSecrets ? "text" : "password"}
                    placeholder="Enter Access Token"
                    value={settings.whatsapp_access_token || ""}
                    onChange={(e) => setSettings({ ...settings, whatsapp_access_token: e.target.value })}
                  />
                </div>
              </div>
            )}

            {settings.whatsapp_provider === "twilio" && (
              <div className="space-y-4 p-4 rounded-lg bg-secondary/30">
                <h4 className="font-medium text-sm">Twilio WhatsApp</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Account SID</Label>
                    <Input
                      type={showSecrets ? "text" : "password"}
                      placeholder="ACxxxxxxxxxxxxxxx"
                      value={settings.twilio_account_sid || ""}
                      onChange={(e) => setSettings({ ...settings, twilio_account_sid: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Auth Token</Label>
                    <Input
                      type={showSecrets ? "text" : "password"}
                      placeholder="Enter Auth Token"
                      value={settings.twilio_auth_token || ""}
                      onChange={(e) => setSettings({ ...settings, twilio_auth_token: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp Phone Number</Label>
                  <Input
                    placeholder="+1234567890"
                    value={settings.twilio_phone_number || ""}
                    onChange={(e) => setSettings({ ...settings, twilio_phone_number: e.target.value })}
                  />
                </div>
              </div>
            )}

            {(settings.whatsapp_provider === "interakt" || settings.whatsapp_provider === "wati") && (
              <div className="space-y-4 p-4 rounded-lg bg-secondary/30">
                <h4 className="font-medium text-sm">{settings.whatsapp_provider === "interakt" ? "Interakt" : "Wati"}</h4>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type={showSecrets ? "text" : "password"}
                    placeholder="Enter API Key"
                    value={settings.whatsapp_api_key || ""}
                    onChange={(e) => setSettings({ ...settings, whatsapp_api_key: e.target.value })}
                  />
                </div>
              </div>
            )}

            {settings.whatsapp_provider && (
              <Button variant="outline" onClick={() => testConnection("whatsapp")} disabled={testing === "whatsapp"}>
                {testing === "whatsapp" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
                Test Connection
              </Button>
            )}
          </div>
        )}

        {/* SMS Settings */}
        {activeTab === "sms" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b">
              <Phone className="h-5 w-5 text-purple-500" />
              <h3 className="font-semibold">SMS Configuration</h3>
            </div>

            <div className="space-y-2">
              <Label>SMS Provider</Label>
              <Select
                value={settings.sms_provider || ""}
                onValueChange={(value) => setSettings({ ...settings, sms_provider: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="twilio">Twilio</SelectItem>
                  <SelectItem value="msg91">MSG91</SelectItem>
                  <SelectItem value="textlocal">TextLocal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {settings.sms_provider === "twilio" && (
              <div className="space-y-4 p-4 rounded-lg bg-secondary/30">
                <h4 className="font-medium text-sm">Twilio SMS</h4>
                <p className="text-xs text-muted-foreground">Uses same credentials as WhatsApp if configured above</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Account SID</Label>
                    <Input
                      type={showSecrets ? "text" : "password"}
                      placeholder="ACxxxxxxxxxxxxxxx"
                      value={settings.twilio_account_sid || ""}
                      onChange={(e) => setSettings({ ...settings, twilio_account_sid: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Auth Token</Label>
                    <Input
                      type={showSecrets ? "text" : "password"}
                      placeholder="Enter Auth Token"
                      value={settings.twilio_auth_token || ""}
                      onChange={(e) => setSettings({ ...settings, twilio_auth_token: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>SMS Phone Number</Label>
                  <Input
                    placeholder="+1234567890"
                    value={settings.twilio_phone_number || ""}
                    onChange={(e) => setSettings({ ...settings, twilio_phone_number: e.target.value })}
                  />
                </div>
              </div>
            )}

            {(settings.sms_provider === "msg91" || settings.sms_provider === "textlocal") && (
              <div className="space-y-4 p-4 rounded-lg bg-secondary/30">
                <h4 className="font-medium text-sm">{settings.sms_provider === "msg91" ? "MSG91" : "TextLocal"}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>API Key / Auth Key</Label>
                    <Input
                      type={showSecrets ? "text" : "password"}
                      placeholder="Enter API Key"
                      value={settings.sms_api_key || ""}
                      onChange={(e) => setSettings({ ...settings, sms_api_key: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sender ID</Label>
                    <Input
                      placeholder="AMASI"
                      value={settings.sms_sender_id || ""}
                      onChange={(e) => setSettings({ ...settings, sms_sender_id: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {settings.sms_provider && (
              <Button variant="outline" onClick={() => testConnection("sms")} disabled={testing === "sms"}>
                {testing === "sms" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
                Test Connection
              </Button>
            )}
          </div>
        )}

        {/* Webhook Settings */}
        {activeTab === "webhook" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b">
              <Webhook className="h-5 w-5 text-orange-500" />
              <h3 className="font-semibold">Webhook Configuration</h3>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
              <div>
                <p className="font-medium">Enable Webhooks</p>
                <p className="text-sm text-muted-foreground">Send message events to external URLs</p>
              </div>
              <Switch
                checked={settings.webhook_enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, webhook_enabled: checked })}
              />
            </div>

            {settings.webhook_enabled && (
              <>
                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <Input
                    type="url"
                    placeholder="https://your-api.com/webhook"
                    value={settings.webhook_url || ""}
                    onChange={(e) => setSettings({ ...settings, webhook_url: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Webhook Secret (for signature verification)</Label>
                  <Input
                    type={showSecrets ? "text" : "password"}
                    placeholder="Enter secret key"
                    value={settings.webhook_secret || ""}
                    onChange={(e) => setSettings({ ...settings, webhook_secret: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    We'll send X-Webhook-Signature header with HMAC-SHA256 of the payload
                  </p>
                </div>

                <Button variant="outline" onClick={() => testConnection("webhook")} disabled={testing === "webhook"}>
                  {testing === "webhook" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
                  Test Webhook
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
