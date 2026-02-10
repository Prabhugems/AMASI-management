"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ImageUpload } from "@/components/ui/image-upload"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Settings,
  Calendar,
  MapPin,
  Image,
  Link2,
  Mail,
  Bell,
  Shield,
  Palette,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Users,
  FileText,
  Trash2,
  Blocks,
  BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface EventSettings {
  id: string
  name: string
  short_name: string | null
  slug: string | null
  description: string | null
  event_type: string
  status: string
  start_date: string | null
  end_date: string | null
  venue_name: string | null
  city: string | null
  state: string | null
  country: string
  timezone: string
  is_public: boolean
  registration_open: boolean
  max_attendees: number | null
  contact_email: string | null
  website_url: string | null
  banner_url: string | null
  logo_url: string | null
  primary_color: string | null
  edition: number | null
  scientific_chairman: string | null
  organizing_chairman: string | null
}

export default function SettingsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState<Partial<EventSettings>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [activeSection, setActiveSection] = useState("general")

  // Fetch event settings
  const { data: event, isLoading } = useQuery({
    queryKey: ["event-settings", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single()

      if (error) throw error
      return data as EventSettings
    },
    enabled: !!eventId,
    staleTime: 0,
  })

  // Initialize form data when event loads
  useEffect(() => {
    if (event) {
      setFormData(event)
    }
  }, [event])

  // Track changes
  useEffect(() => {
    if (event && formData.id) {
      const changed = JSON.stringify(event) !== JSON.stringify(formData)
      setHasChanges(changed)
    }
  }, [formData, event])

  // Save settings mutation
  const saveSettings = useMutation({
    mutationFn: async (data: Partial<EventSettings>) => {
      const res = await fetch(`/api/events/${eventId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to save settings")
      }

      return res.json()
    },
    onSuccess: async () => {
      // Reset all event queries to force fresh fetch
      await queryClient.resetQueries({ queryKey: ["event-settings", eventId] })
      await queryClient.resetQueries({ queryKey: ["event", eventId] })
      await queryClient.resetQueries({ queryKey: ["event-details", eventId] })
      // Dispatch custom event to trigger sidebar refetch
      window.dispatchEvent(new CustomEvent("event-settings-saved"))
      setHasChanges(false)
    },
  })

  const updateField = (field: keyof EventSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const sections = [
    { id: "general", label: "General", icon: Settings },
    { id: "datetime", label: "Date & Time", icon: Calendar },
    { id: "location", label: "Location", icon: MapPin },
    { id: "registration", label: "Registration", icon: Users },
    { id: "modules", label: "Modules", icon: Blocks },
    { id: "automation", label: "Automation", icon: Bell },
    { id: "branding", label: "Branding", icon: Palette },
    { id: "links", label: "Links & Contact", icon: Link2 },
    { id: "advanced", label: "Advanced", icon: Shield },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tito-style Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Event Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure your event details and preferences
          </p>
        </div>
        <Button
          onClick={() => saveSettings.mutate(formData)}
          disabled={!hasChanges || saveSettings.isPending}
          className="gap-2"
        >
          {saveSettings.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Success/Error Messages */}
      {saveSettings.isSuccess && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 text-success border border-success/20">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm">Settings saved successfully!</span>
        </div>
      )}

      {saveSettings.isError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Failed to save settings. Please try again.</span>
        </div>
      )}

      {/* Tito-style Two Column Layout */}
      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="w-56 flex-shrink-0">
          <nav className="space-y-1 sticky top-6">
            {sections.map((section) => {
              const Icon = section.icon
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all",
                    activeSection === section.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {section.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-6">
          {/* General Section */}
          {activeSection === "general" && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Settings className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">General Information</h3>
                    <p className="text-sm text-muted-foreground">Basic event details</p>
                  </div>
                </div>

                <div className="grid gap-5">
                  <div>
                    <label className="text-sm font-medium text-foreground">Event Name *</label>
                    <Input
                      value={formData.name || ""}
                      onChange={(e) => updateField("name", e.target.value)}
                      placeholder="AMASI Annual Conference 2026"
                      className="mt-1.5"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground">Short Name</label>
                      <Input
                        value={formData.short_name || ""}
                        onChange={(e) => updateField("short_name", e.target.value)}
                        placeholder="AMASI 2026"
                        className="mt-1.5"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Used in navigation</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Edition</label>
                      <Input
                        type="number"
                        value={formData.edition || ""}
                        onChange={(e) => updateField("edition", e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="42"
                        className="mt-1.5"
                      />
                      <p className="text-xs text-muted-foreground mt-1">e.g., 42nd Annual</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground">URL Slug</label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-sm text-muted-foreground">/register/</span>
                      <Input
                        value={formData.slug || ""}
                        onChange={(e) => updateField("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                        placeholder="amasi-2026"
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(`${window.location.origin}/register/${formData.slug}`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Public registration URL</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground">Description</label>
                    <textarea
                      value={formData.description || ""}
                      onChange={(e) => updateField("description", e.target.value)}
                      placeholder="Describe your event..."
                      rows={3}
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-foreground">Event Type</label>
                        <Select
                          value={['conference', 'workshop', 'seminar', 'webinar', 'symposium', 'meetup', 'summit', 'congress'].includes(formData.event_type || '') ? formData.event_type : 'other'}
                          onValueChange={(value) => {
                            if (value === 'other') {
                              updateField("event_type", "")
                            } else {
                              updateField("event_type", value)
                            }
                          }}
                        >
                          <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="conference">Conference</SelectItem>
                            <SelectItem value="workshop">Workshop</SelectItem>
                            <SelectItem value="seminar">Seminar</SelectItem>
                            <SelectItem value="webinar">Webinar</SelectItem>
                            <SelectItem value="symposium">Symposium</SelectItem>
                            <SelectItem value="summit">Summit</SelectItem>
                            <SelectItem value="congress">Congress</SelectItem>
                            <SelectItem value="meetup">Meetup</SelectItem>
                            <SelectItem value="other">Other...</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground">Status</label>
                        <Select
                          value={formData.status || "planning"}
                          onValueChange={(value) => updateField("status", value)}
                        >
                          <SelectTrigger className="mt-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="planning">Planning</SelectItem>
                            <SelectItem value="ongoing">Ongoing</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Custom Event Type Input - Shows when "Other" is selected or custom value exists */}
                    {(formData.event_type === "" || !['conference', 'workshop', 'seminar', 'webinar', 'symposium', 'meetup', 'summit', 'congress'].includes(formData.event_type || '')) && (
                      <div>
                        <label className="text-sm font-medium text-foreground">Custom Event Type</label>
                        <Input
                          value={formData.event_type || ""}
                          onChange={(e) => updateField("event_type", e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                          placeholder="e.g., training, bootcamp, hackathon"
                          className="mt-1.5"
                          autoFocus
                        />
                        <p className="text-xs text-muted-foreground mt-1">Enter your custom event type (no spaces)</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground">Scientific Chairman</label>
                      <Input
                        value={formData.scientific_chairman || ""}
                        onChange={(e) => updateField("scientific_chairman", e.target.value)}
                        placeholder="Dr. John Doe"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Organizing Chairman</label>
                      <Input
                        value={formData.organizing_chairman || ""}
                        onChange={(e) => updateField("organizing_chairman", e.target.value)}
                        placeholder="Dr. Jane Smith"
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Date & Time Section */}
          {activeSection === "datetime" && (
            <div className="bg-card border border-border rounded-xl p-6 space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-info" />
                </div>
                <div>
                  <h3 className="font-semibold">Date & Time</h3>
                  <p className="text-sm text-muted-foreground">When is your event happening?</p>
                </div>
              </div>

              <div className="grid gap-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Start Date</label>
                    <Input
                      type="date"
                      value={formData.start_date?.split("T")[0] || ""}
                      onChange={(e) => updateField("start_date", e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">End Date</label>
                    <Input
                      type="date"
                      value={formData.end_date?.split("T")[0] || ""}
                      onChange={(e) => updateField("end_date", e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Timezone</label>
                  <Select
                    value={formData.timezone || "Asia/Kolkata"}
                    onValueChange={(value) => updateField("timezone", value)}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Kolkata">India Standard Time (IST)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      <SelectItem value="Europe/London">British Time (GMT/BST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Location Section */}
          {activeSection === "location" && (
            <div className="bg-card border border-border rounded-xl p-6 space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold">Location</h3>
                  <p className="text-sm text-muted-foreground">Where is your event taking place?</p>
                </div>
              </div>

              <div className="grid gap-5">
                <div>
                  <label className="text-sm font-medium text-foreground">Venue Name</label>
                  <Input
                    value={formData.venue_name || ""}
                    onChange={(e) => updateField("venue_name", e.target.value)}
                    placeholder="Grand Convention Center"
                    className="mt-1.5"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">City</label>
                    <Input
                      value={formData.city || ""}
                      onChange={(e) => updateField("city", e.target.value)}
                      placeholder="Chennai"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">State</label>
                    <Input
                      value={formData.state || ""}
                      onChange={(e) => updateField("state", e.target.value)}
                      placeholder="Tamil Nadu"
                      className="mt-1.5"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Country</label>
                  <Select
                    value={formData.country || "India"}
                    onValueChange={(value) => updateField("country", value)}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="India">India</SelectItem>
                      <SelectItem value="United States">United States</SelectItem>
                      <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                      <SelectItem value="Singapore">Singapore</SelectItem>
                      <SelectItem value="UAE">UAE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Registration Section */}
          {activeSection === "registration" && (
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

              <div className="grid gap-5">
                <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-border">
                  <div className="flex-1 pr-4">
                    <p className="font-medium">Public Event</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      When enabled, your event registration page will be visible to anyone with the link.
                      They can browse ticket types and complete registration.
                    </p>
                    <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                      <strong>OFF:</strong> Only admins can access the registration page. Use this for invite-only events.
                    </div>
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
                      Controls whether new registrations are accepted. Turn off to stop accepting new attendees
                      while keeping the event page visible.
                    </p>
                    <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                      <strong>OFF:</strong> Shows "Registration Closed" message. Existing registrations are not affected.
                    </div>
                  </div>
                  <Switch
                    checked={formData.registration_open ?? true}
                    onCheckedChange={(checked) => updateField("registration_open", checked)}
                  />
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
                    Total capacity across all ticket types. Registration will close automatically when this limit is reached.
                    Leave empty for unlimited registrations.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Modules Section */}
          {activeSection === "modules" && (
            <ModulesSection eventId={eventId} />
          )}

          {/* Automation Section */}
          {activeSection === "automation" && (
            <AutomationSection eventId={eventId} />
          )}

          {/* Branding Section */}
          {activeSection === "branding" && (
            <div className="space-y-6">
              {/* Live Preview Card */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-secondary/30">
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Live Preview</h3>
                </div>
                <div
                  className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900"
                  style={{
                    backgroundImage: formData.banner_url ? `url(${formData.banner_url})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  {!formData.banner_url && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">Banner preview will appear here</p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-end gap-4">
                      {formData.logo_url ? (
                        <img
                          src={formData.logo_url}
                          alt="Event logo"
                          className="h-16 w-16 rounded-xl bg-white object-contain shadow-lg border-2 border-white"
                        />
                      ) : (
                        <div
                          className="h-16 w-16 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg"
                          style={{ backgroundColor: formData.primary_color || '#10b981' }}
                        >
                          {(formData.short_name || formData.name || 'E')[0]}
                        </div>
                      )}
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-white drop-shadow-lg">
                          {formData.name || 'Event Name'}
                        </h2>
                        <p className="text-white/80 text-sm">
                          {formData.city ? `${formData.city}, ` : ''}{formData.start_date ? new Date(formData.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date TBD'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="shadow-lg"
                        style={{
                          backgroundColor: formData.primary_color || '#10b981',
                          color: 'white'
                        }}
                      >
                        Register Now
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload Section */}
              <div className="grid grid-cols-2 gap-6">
                {/* Logo Upload */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <Image className="h-4 w-4 text-violet-500" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Event Logo</h4>
                      <p className="text-xs text-muted-foreground">Square, 200×200px</p>
                    </div>
                  </div>
                  <ImageUpload
                    value={formData.logo_url || ""}
                    onChange={(url) => updateField("logo_url", url)}
                    eventId={eventId}
                    folder={`events/${eventId}/logo`}
                    aspectRatio="square"
                  />
                </div>

                {/* Banner Upload */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <Image className="h-4 w-4 text-cyan-500" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Banner Image</h4>
                      <p className="text-xs text-muted-foreground">Wide, 1200×400px</p>
                    </div>
                  </div>
                  <ImageUpload
                    value={formData.banner_url || ""}
                    onChange={(url) => updateField("banner_url", url)}
                    eventId={eventId}
                    folder={`events/${eventId}/banner`}
                    aspectRatio="banner"
                  />
                </div>
              </div>

              {/* Color Settings */}
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border mb-5">
                  <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <Palette className="h-5 w-5 text-violet-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Brand Color</h3>
                    <p className="text-sm text-muted-foreground">Used for buttons and accents</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Preset Colors */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">Quick Select</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { color: '#10b981', name: 'Emerald' },
                        { color: '#3b82f6', name: 'Blue' },
                        { color: '#8b5cf6', name: 'Violet' },
                        { color: '#f59e0b', name: 'Amber' },
                        { color: '#ef4444', name: 'Red' },
                        { color: '#ec4899', name: 'Pink' },
                        { color: '#06b6d4', name: 'Cyan' },
                        { color: '#84cc16', name: 'Lime' },
                        { color: '#f97316', name: 'Orange' },
                        { color: '#6366f1', name: 'Indigo' },
                      ].map((preset) => (
                        <button
                          key={preset.color}
                          onClick={() => updateField("primary_color", preset.color)}
                          className={cn(
                            "h-10 w-10 rounded-lg transition-all hover:scale-110 border-2",
                            formData.primary_color === preset.color
                              ? "border-foreground ring-2 ring-offset-2 ring-offset-background"
                              : "border-transparent"
                          )}
                          style={{ backgroundColor: preset.color }}
                          title={preset.name}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Custom Color */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">Custom Color</label>
                    <div className="flex items-center gap-3">
                      <div
                        className="relative h-12 w-12 rounded-xl overflow-hidden border-2 border-border cursor-pointer group"
                        style={{ backgroundColor: formData.primary_color || '#10b981' }}
                      >
                        <input
                          type="color"
                          value={formData.primary_color || "#10b981"}
                          onChange={(e) => updateField("primary_color", e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity">
                          <Palette className="h-5 w-5 text-white" />
                        </div>
                      </div>
                      <Input
                        value={formData.primary_color || "#10b981"}
                        onChange={(e) => updateField("primary_color", e.target.value)}
                        placeholder="#10b981"
                        className="flex-1 font-mono"
                      />
                      <div
                        className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                        style={{ backgroundColor: formData.primary_color || '#10b981' }}
                      >
                        Preview
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Links & Contact Section */}
          {activeSection === "links" && (
            <div className="bg-card border border-border rounded-xl p-6 space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Link2 className="h-5 w-5 text-cyan-500" />
                </div>
                <div>
                  <h3 className="font-semibold">Links & Contact</h3>
                  <p className="text-sm text-muted-foreground">External links and contact information</p>
                </div>
              </div>

              <div className="grid gap-5">
                <div>
                  <label className="text-sm font-medium text-foreground">Contact Email</label>
                  <Input
                    type="email"
                    value={formData.contact_email || ""}
                    onChange={(e) => updateField("contact_email", e.target.value)}
                    placeholder="contact@example.com"
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Displayed to attendees for support</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Event Website</label>
                  <Input
                    value={formData.website_url || ""}
                    onChange={(e) => updateField("website_url", e.target.value)}
                    placeholder="https://example.com"
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Advanced Section */}
          {activeSection === "advanced" && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Advanced Settings</h3>
                    <p className="text-sm text-muted-foreground">Danger zone - proceed with caution</p>
                  </div>
                </div>

                <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-destructive">Delete Event</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Permanently delete this event and all associated data. This action cannot be undone.
                      </p>
                    </div>
                    <Button variant="destructive" size="sm" className="gap-2">
                      <Trash2 className="h-4 w-4" />
                      Delete Event
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Automation Section Component
function AutomationSection({ eventId }: { eventId: string }) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  // Fetch event settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["event-automation-settings", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_settings")
        .select("auto_send_receipt, auto_generate_badge, auto_email_badge, auto_generate_certificate, auto_email_certificate")
        .eq("event_id", eventId)
        .single()

      if (error && error.code !== "PGRST116") throw error
      return data || {
        auto_send_receipt: true,
        auto_generate_badge: false,
        auto_email_badge: false,
        auto_generate_certificate: false,
        auto_email_certificate: false,
      }
    },
    enabled: !!eventId,
  })

  // Check if default badge template exists
  const { data: hasDefaultBadgeTemplate } = useQuery({
    queryKey: ["default-badge-template", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("badge_templates")
        .select("id")
        .eq("event_id", eventId)
        .eq("is_default", true)
        .single()
      return !!data
    },
    enabled: !!eventId,
  })

  // Check if default certificate template exists
  const { data: hasDefaultCertTemplate } = useQuery({
    queryKey: ["default-certificate-template", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("certificate_templates")
        .select("id")
        .eq("event_id", eventId)
        .eq("is_default", true)
        .single()
      return !!data
    },
    enabled: !!eventId,
  })

  const [formData, setFormData] = useState({
    auto_send_receipt: true,
    auto_generate_badge: false,
    auto_email_badge: false,
    auto_generate_certificate: false,
    auto_email_certificate: false,
  })

  useEffect(() => {
    if (settings) {
      setFormData({
        auto_send_receipt: settings.auto_send_receipt ?? true,
        auto_generate_badge: settings.auto_generate_badge ?? false,
        auto_email_badge: settings.auto_email_badge ?? false,
        auto_generate_certificate: settings.auto_generate_certificate ?? false,
        auto_email_certificate: settings.auto_email_certificate ?? false,
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
    } catch (error) {
      console.error("Failed to save automation settings:", error)
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

      {/* Info Box */}
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
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Recommended</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Sends a confirmation email with registration details immediately after payment is completed.
            </p>
            <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
              <strong>Email contains:</strong> Registration number, attendee name, ticket details, payment summary, and event information.
            </div>
          </div>
          <Switch
            checked={formData.auto_send_receipt}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, auto_send_receipt: checked }))}
          />
        </div>

        {/* Auto Generate Badge */}
        <div className="flex items-start justify-between p-4 bg-secondary/30 rounded-xl border border-border">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">Auto-generate Badge</p>
              {!hasDefaultBadgeTemplate && (
                <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full">
                  Requires default template
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Creates a personalized badge PDF using your default badge template when registration is confirmed.
            </p>
            <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
              <strong>Setup required:</strong> Go to Badges → Templates → Create a template and mark it as "Default".
              {!hasDefaultBadgeTemplate && <span className="text-warning ml-1">No default template found!</span>}
            </div>
          </div>
          <Switch
            checked={formData.auto_generate_badge}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, auto_generate_badge: checked }))}
            disabled={!hasDefaultBadgeTemplate}
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
            <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
              <strong>Tip:</strong> Enable this so attendees can print their badges before arriving at the venue.
            </div>
          </div>
          <Switch
            checked={formData.auto_email_badge}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, auto_email_badge: checked }))}
            disabled={!formData.auto_generate_badge}
          />
        </div>

        {/* Divider */}
        <div className="border-t border-border my-2" />

        {/* Auto Generate Certificate */}
        <div className="flex items-start justify-between p-4 bg-secondary/30 rounded-xl border border-border">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">Auto-generate Certificate</p>
              {!hasDefaultCertTemplate && (
                <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full">
                  Requires default template
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Creates a participation certificate using your default certificate template.
            </p>
            <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
              <strong>Note:</strong> Certificates are usually issued post-event. Enable only if you want instant certificates upon registration.
              {!hasDefaultCertTemplate && <span className="text-warning ml-1">No default template found!</span>}
            </div>
          </div>
          <Switch
            checked={formData.auto_generate_certificate}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, auto_generate_certificate: checked }))}
            disabled={!hasDefaultCertTemplate}
          />
        </div>

        {/* Auto Email Certificate */}
        <div className={cn(
          "flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-border",
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

// Modules Section Component
function ModulesSection({ eventId }: { eventId: string }) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  // Fetch event settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["event-module-settings", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_settings")
        .select("enable_abstracts")
        .eq("event_id", eventId)
        .maybeSingle()

      if (error) throw error
      return data || { enable_abstracts: false }
    },
    enabled: !!eventId,
  })

  const [formData, setFormData] = useState({
    enable_abstracts: false,
  })

  useEffect(() => {
    if (settings) {
      setFormData({
        enable_abstracts: settings.enable_abstracts ?? false,
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
      await queryClient.invalidateQueries({ queryKey: ["event-module-settings", eventId] })
      await queryClient.invalidateQueries({ queryKey: ["event-setup-status", eventId] })
      // Dispatch event to trigger sidebar update
      window.dispatchEvent(new CustomEvent("event-settings-saved"))
    } catch (error) {
      console.error("Failed to save module settings:", error)
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
        <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
          <Blocks className="h-5 w-5 text-violet-500" />
        </div>
        <div>
          <h3 className="font-semibold">Event Modules</h3>
          <p className="text-sm text-muted-foreground">Enable optional features for this event</p>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>About Modules:</strong> Modules are optional features that can be enabled per event.
          When enabled, they appear in the sidebar and provide additional functionality.
        </p>
      </div>

      <div className="grid gap-4">
        {/* Abstract Management Module */}
        <div className="flex items-start justify-between p-4 bg-secondary/30 rounded-xl border border-border">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium">Abstract Management</p>
              {formData.enable_abstracts && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Enabled</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Allow delegates to submit research abstracts, papers, posters, and videos for review.
            </p>
            <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
              <strong>Features include:</strong> Abstract submission form, category management, review workflow,
              accept/reject decisions, presenter assignments, and integration with certificates.
            </div>
          </div>
          <Switch
            checked={formData.enable_abstracts}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enable_abstracts: checked }))}
          />
        </div>

        {/* Future modules placeholder */}
        <div className="p-4 border border-dashed border-border rounded-xl opacity-50">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Blocks className="h-4 w-4" />
            <p className="text-sm font-medium">More modules coming soon</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Sponsorship, Exhibition, Awards, and more modules will be available in future updates.
          </p>
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
              Save Module Settings
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
