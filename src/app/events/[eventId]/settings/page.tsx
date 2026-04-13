"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
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
  ChevronLeft,
  GraduationCap,
  Mic,
  Phone,
  Globe,
  Search,
  Clock,
  Download,
  Upload,
  History,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { COMPANY_CONFIG } from "@/lib/config"

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
  venue_address: string | null
  city: string | null
  state: string | null
  country: string
  timezone: string
  is_public: boolean
  registration_open: boolean
  max_attendees: number | null
  contact_email: string | null
  contact_phone: string | null
  website_url: string | null
  banner_url: string | null
  logo_url: string | null
  primary_color: string | null
  edition: number | null
  scientific_chairman: string | null
  organizing_chairman: string | null
  organized_by: string | null
  signatory_title: string | null
  signature_image_url: string | null
  registration_deadline: string | null
  venue_map_url: string | null
  favicon_url: string | null
  social_twitter: string | null
  social_instagram: string | null
  social_linkedin: string | null
  seo_title: string | null
  seo_description: string | null
  settings: {
    speaker_invitation?: {
      signer_name: string
      signer_title: string
      signature_url: string
    }
    [key: string]: any
  } | null
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export default function SettingsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState<Partial<EventSettings>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [activeSection, setActiveSection] = useState("general")

  // Slug availability state
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [slugChecking, setSlugChecking] = useState(false)
  const [slugSuggestion, setSlugSuggestion] = useState<string | null>(null)
  const slugCheckTimer = useRef<NodeJS.Timeout>()

  // Delete confirmation state
  const [deleteInput, setDeleteInput] = useState("")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Clone state
  const [cloning, setCloning] = useState(false)
  const [showCloneDialog, setShowCloneDialog] = useState(false)
  const [cloneData, setCloneData] = useState({ name: "", start_date: "", end_date: "" })

  // Fetch event settings
  const { data: event, isLoading } = useQuery({
    queryKey: ["event-settings", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .maybeSingle()

      if (error) throw error
      return (data ?? null) as EventSettings | null
    },
    enabled: !!eventId,
    staleTime: 0,
  })

  // Fetch registration count for capacity bar
  const { data: regCount } = useQuery({
    queryKey: ["registration-count", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/registrations?count_only=true`)
      if (!res.ok) {
        // Fallback: try direct count
        const { count } = await supabase
          .from("registrations")
          .select("*", { count: "exact", head: true })
          .eq("event_id", eventId)
        return count || 0
      }
      const data = await res.json()
      return data.count || 0
    },
    enabled: !!eventId && !!formData.max_attendees,
  })

  // Fetch settings changelog
  const { data: changelog } = useQuery({
    queryKey: ["settings-changelog", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("event_settings_log" as any)
        .select("*")
        .eq("event_id", eventId)
        .order("changed_at", { ascending: false })
        .limit(20)
      return (data || []) as any[]
    },
    enabled: !!eventId && activeSection === "advanced",
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

  // Navigation guard - warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [hasChanges])

  // Slug availability check with debounce
  const checkSlug = useCallback((slug: string) => {
    clearTimeout(slugCheckTimer.current)
    setSlugSuggestion(null)
    if (!slug) {
      setSlugAvailable(null)
      setSlugChecking(false)
      return
    }
    setSlugChecking(true)
    slugCheckTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/events/check-slug?slug=${slug}&exclude_id=${eventId}`)
        const data = await res.json()
        setSlugAvailable(data.available)
        if (!data.available && data.suggestion) {
          setSlugSuggestion(data.suggestion)
        }
      } catch {
        setSlugAvailable(null)
      }
      setSlugChecking(false)
    }, 500)
  }, [eventId])

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
      await queryClient.resetQueries({ queryKey: ["event-settings", eventId] })
      await queryClient.resetQueries({ queryKey: ["event", eventId] })
      await queryClient.resetQueries({ queryKey: ["event-details", eventId] })
      await queryClient.invalidateQueries({ queryKey: ["settings-changelog", eventId] })
      window.dispatchEvent(new CustomEvent("event-settings-saved"))
      setHasChanges(false)
      toast.success("Settings saved successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save settings")
    },
  })

  const updateField = (field: keyof EventSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  const handleSectionChange = (sectionId: string) => {
    if (hasChanges) {
      const confirmed = window.confirm("You have unsaved changes. Discard them?")
      if (!confirmed) return
      if (event) setFormData(event)
    }
    setActiveSection(sectionId)
  }

  // Clone event handler
  const handleClone = async () => {
    setCloning(true)
    try {
      const res = await fetch(`/api/events/${eventId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cloneData),
      })
      if (!res.ok) throw new Error("Failed to clone event")
      const data = await res.json()
      toast.success("Event cloned successfully!")
      setShowCloneDialog(false)
      if (data.event?.id) {
        router.push(`/events/${data.event.id}/settings`)
      }
    } catch {
      toast.error("Failed to clone event")
    }
    setCloning(false)
  }

  // Export settings as JSON
  const exportSettings = () => {
    const exportData = { ...formData }
    delete (exportData as any).id
    delete (exportData as any).created_at
    delete (exportData as any).updated_at
    delete (exportData as any).created_by
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `event-settings-${formData.slug || eventId}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Settings exported")
  }

  // Import settings from JSON
  const importSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target?.result as string)
        // Merge imported settings but keep id and meta fields
        setFormData((prev) => ({
          ...prev,
          ...imported,
          id: prev.id,
        }))
        toast.success("Settings imported — review and save")
      } catch {
        toast.error("Invalid JSON file")
      }
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  const sectionLabels: Record<string, string> = {
    general: "General",
    datetime: "Date & Time",
    location: "Location",
    registration: "Registration",
    modules: "Modules",
    automation: "Automation",
    branding: "Branding",
    links: "Links & Contact",
    advanced: "Advanced",
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
    <div className="space-y-6 pb-20">
      {/* Back Button */}
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Event Settings</h1>
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

      {/* Sticky Save Bar */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-6 py-3">
          <div className="flex items-center justify-between max-w-screen-xl mx-auto">
            <p className="text-sm text-muted-foreground">
              Unsaved changes in <strong>{sectionLabels[activeSection]}</strong>
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { if (event) setFormData(event) }}
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={() => saveSettings.mutate(formData)}
                disabled={saveSettings.isPending}
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
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="w-56 flex-shrink-0">
          <nav className="space-y-1 sticky top-6">
            {sections.map((section) => {
              const Icon = section.icon
              return (
                <button
                  key={section.id}
                  onClick={() => handleSectionChange(section.id)}
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

          {/* ==================== GENERAL SECTION ==================== */}
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
                      placeholder={`${COMPANY_CONFIG.name} Annual Conference 2026`}
                      maxLength={120}
                      className="mt-1.5"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground">Short Name</label>
                      <Input
                        value={formData.short_name || ""}
                        onChange={(e) => updateField("short_name", e.target.value)}
                        placeholder={`${COMPANY_CONFIG.name} 2026`}
                        maxLength={40}
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
                      <p className="text-xs text-muted-foreground mt-1">
                        {formData.edition ? `${ordinal(formData.edition)} Annual` : "e.g., 42nd Annual"}
                      </p>
                    </div>
                  </div>

                  {/* Slug with live availability check */}
                  <div>
                    <label className="text-sm font-medium text-foreground">URL Slug</label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-sm text-muted-foreground">/register/</span>
                      <div className="relative flex-1">
                        <Input
                          value={formData.slug || ""}
                          onChange={(e) => {
                            const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-")
                            updateField("slug", slug)
                            checkSlug(slug)
                          }}
                          placeholder="amasi-2026"
                          className={cn(
                            "pr-8",
                            slugAvailable === true && "border-green-500 focus-visible:ring-green-500",
                            slugAvailable === false && "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                          {slugChecking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                          {!slugChecking && slugAvailable === true && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                          {!slugChecking && slugAvailable === false && <AlertCircle className="h-4 w-4 text-destructive" />}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(`${window.location.origin}/register/${formData.slug}`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground">
                        {formData.slug ? `${window.location.origin}/register/${formData.slug}` : "Public registration URL"}
                      </p>
                      {slugAvailable === false && slugSuggestion && (
                        <button
                          className="text-xs text-primary hover:underline"
                          onClick={() => {
                            updateField("slug", slugSuggestion)
                            checkSlug(slugSuggestion)
                          }}
                        >
                          Try &quot;{slugSuggestion}&quot;
                        </button>
                      )}
                    </div>
                    {slugAvailable === false && (
                      <p className="text-xs text-destructive mt-0.5">This URL is already taken</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground">Description</label>
                    <textarea
                      value={formData.description || ""}
                      onChange={(e) => updateField("description", e.target.value)}
                      placeholder="Describe your event..."
                      rows={3}
                      maxLength={1000}
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {(formData.description || "").length}/1000 characters
                    </p>
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

                  <div>
                    <label className="text-sm font-medium text-foreground">Organized By</label>
                    <Input
                      value={formData.organized_by || ""}
                      onChange={(e) => updateField("organized_by", e.target.value)}
                      placeholder={`${COMPANY_CONFIG.name}, Department of Surgery, BJ Medical College`}
                      maxLength={120}
                      className="mt-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Used in invitation letters as &quot;organized by ...&quot;</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground">Scientific Chairman</label>
                      <Input
                        value={formData.scientific_chairman || ""}
                        onChange={(e) => updateField("scientific_chairman", e.target.value)}
                        placeholder="Dr. John Doe"
                        maxLength={100}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Organizing Chairman</label>
                      <Input
                        value={formData.organizing_chairman || ""}
                        onChange={(e) => updateField("organizing_chairman", e.target.value)}
                        placeholder="Dr. Jane Smith"
                        maxLength={100}
                        className="mt-1.5"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground">Signatory Title</label>
                    <Input
                      value={formData.signatory_title || ""}
                      onChange={(e) => updateField("signatory_title", e.target.value)}
                      placeholder="Course Convenor"
                      maxLength={80}
                      className="mt-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Title shown below the signatory name in invitations (e.g., Course Convenor, Organizing Secretary)</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground">Signature Image</label>
                    <p className="text-xs text-muted-foreground mt-1 mb-2">Upload a PNG/JPG of the convenor&apos;s signature. Rendered above the name in invitation letters.</p>
                    <ImageUpload
                      value={formData.signature_image_url || ""}
                      onChange={(url) => updateField("signature_image_url", url)}
                      eventId={eventId}
                      folder={`events/${eventId}/signature`}
                      aspectRatio="banner"
                    />
                  </div>
                </div>
              </div>

              {/* Speaker Invitation Signature */}
              <div className="bg-card border border-border rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Mic className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Speaker Invitation</h3>
                    <p className="text-sm text-muted-foreground">Override signer details for speaker invitation letters. If not set, the default signatory above is used.</p>
                  </div>
                </div>

                <div className="grid gap-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground">Signer Name</label>
                      <Input
                        value={formData.settings?.speaker_invitation?.signer_name || ""}
                        onChange={(e) => {
                          const current = formData.settings || {}
                          const currentSpeaker = current.speaker_invitation || { signer_name: "", signer_title: "", signature_url: "" }
                          setFormData((prev) => ({
                            ...prev,
                            settings: {
                              ...current,
                              speaker_invitation: {
                                ...currentSpeaker,
                                signer_name: e.target.value,
                              },
                            },
                          }))
                        }}
                        placeholder="Dr. Roshan Shetty A"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Signer Title</label>
                      <Input
                        value={formData.settings?.speaker_invitation?.signer_title || ""}
                        onChange={(e) => {
                          const current = formData.settings || {}
                          const currentSpeaker = current.speaker_invitation || { signer_name: "", signer_title: "", signature_url: "" }
                          setFormData((prev) => ({
                            ...prev,
                            settings: {
                              ...current,
                              speaker_invitation: {
                                ...currentSpeaker,
                                signer_title: e.target.value,
                              },
                            },
                          }))
                        }}
                        placeholder="Secretary"
                        className="mt-1.5"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground">Signature Image</label>
                    <p className="text-xs text-muted-foreground mt-1 mb-2">Upload a signature image for speaker invitation letters.</p>
                    <ImageUpload
                      value={formData.settings?.speaker_invitation?.signature_url || ""}
                      onChange={(url) => {
                        const current = formData.settings || {}
                        const currentSpeaker = current.speaker_invitation || { signer_name: "", signer_title: "", signature_url: "" }
                        setFormData((prev) => ({
                          ...prev,
                          settings: {
                            ...current,
                            speaker_invitation: {
                              ...currentSpeaker,
                              signature_url: url,
                            },
                          },
                        }))
                      }}
                      eventId={eventId}
                      folder={`events/${eventId}/speaker-signature`}
                      aspectRatio="banner"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== DATE & TIME SECTION ==================== */}
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
                    {formData.end_date && formData.start_date && formData.end_date < formData.start_date && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        End date must be after start date
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Registration Deadline</label>
                  <Input
                    type="datetime-local"
                    value={formData.registration_deadline?.slice(0, 16) || ""}
                    onChange={(e) => updateField("registration_deadline", e.target.value ? new Date(e.target.value).toISOString() : null)}
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Optional. Registration auto-closes at this date/time regardless of the Registration Open toggle.
                  </p>
                  {formData.registration_deadline && new Date(formData.registration_deadline) < new Date() && (
                    <p className="text-xs text-warning mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Deadline has already passed — registration is effectively closed
                    </p>
                  )}
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
                      <SelectItem value="Asia/Kolkata">India Standard Time (IST, UTC+5:30)</SelectItem>
                      <SelectItem value="Asia/Singapore">Singapore Time (SGT, UTC+8:00)</SelectItem>
                      <SelectItem value="Asia/Dubai">Gulf Standard Time (GST, UTC+4:00)</SelectItem>
                      <SelectItem value="Asia/Colombo">Sri Lanka Time (SLST, UTC+5:30)</SelectItem>
                      <SelectItem value="Asia/Kuala_Lumpur">Malaysia Time (MYT, UTC+8:00)</SelectItem>
                      <SelectItem value="Asia/Bangkok">Indochina Time (ICT, UTC+7:00)</SelectItem>
                      <SelectItem value="Australia/Sydney">Australian Eastern (AEST, UTC+10:00)</SelectItem>
                      <SelectItem value="Europe/London">British Time (GMT/BST)</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* ==================== LOCATION SECTION ==================== */}
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

                <div>
                  <label className="text-sm font-medium text-foreground">Venue Address</label>
                  <Input
                    value={formData.venue_address || ""}
                    onChange={(e) => updateField("venue_address", e.target.value)}
                    placeholder="123 Main Street, Near City Mall"
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Street address used in travel emails and invitation letters</p>
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
                    <label className="text-sm font-medium text-foreground">State / Province</label>
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
                    value={
                      ["India", "United States", "United Kingdom", "Singapore", "UAE", "Malaysia", "Sri Lanka", "Bangladesh", "Nepal", "Thailand", "Australia", "Canada", "Germany", "France"].includes(formData.country || "")
                        ? formData.country
                        : formData.country ? "Other" : "India"
                    }
                    onValueChange={(value) => {
                      if (value === "Other") {
                        updateField("country", "")
                      } else {
                        updateField("country", value)
                      }
                    }}
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
                      <SelectItem value="Malaysia">Malaysia</SelectItem>
                      <SelectItem value="Sri Lanka">Sri Lanka</SelectItem>
                      <SelectItem value="Bangladesh">Bangladesh</SelectItem>
                      <SelectItem value="Nepal">Nepal</SelectItem>
                      <SelectItem value="Thailand">Thailand</SelectItem>
                      <SelectItem value="Australia">Australia</SelectItem>
                      <SelectItem value="Canada">Canada</SelectItem>
                      <SelectItem value="Germany">Germany</SelectItem>
                      <SelectItem value="France">France</SelectItem>
                      <SelectItem value="Other">Other...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom country input when Other is selected */}
                {formData.country !== undefined && !["India", "United States", "United Kingdom", "Singapore", "UAE", "Malaysia", "Sri Lanka", "Bangladesh", "Nepal", "Thailand", "Australia", "Canada", "Germany", "France"].includes(formData.country || "India") && (
                  <div>
                    <label className="text-sm font-medium text-foreground">Country Name</label>
                    <Input
                      value={formData.country || ""}
                      onChange={(e) => updateField("country", e.target.value)}
                      placeholder="Enter country name"
                      className="mt-1.5"
                      autoFocus
                    />
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-foreground">Google Maps URL</label>
                  <Input
                    type="url"
                    value={formData.venue_map_url || ""}
                    onChange={(e) => updateField("venue_map_url", e.target.value)}
                    placeholder="https://maps.google.com/..."
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Paste a Google Maps share link. Shown on registration page and in emails.</p>
                </div>
              </div>
            </div>
          )}

          {/* ==================== REGISTRATION SECTION ==================== */}
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

              {/* Conflict warning */}
              {!(formData.is_public ?? true) && (formData.registration_open ?? true) && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Event is private but registration is open. Only users with a direct link can register.
                  </p>
                </div>
              )}

              <div className="grid gap-5">
                <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-border">
                  <div className="flex-1 pr-4">
                    <p className="font-medium">Public Event</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      When enabled, your event registration page will be visible to anyone with the link.
                    </p>
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
                      Controls whether new registrations are accepted.
                    </p>
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
                    Registration will close automatically when this limit is reached.
                  </p>

                  {/* Capacity bar */}
                  {formData.max_attendees && formData.max_attendees > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {(() => {
                        const count = regCount || 0
                        const max = formData.max_attendees!
                        const pct = Math.min(Math.round((count / max) * 100), 100)
                        const color = pct >= 95 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-green-500"
                        return (
                          <>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">
                                {count.toLocaleString()} / {max.toLocaleString()} registered
                              </span>
                              <span className={cn(
                                "font-medium",
                                pct >= 95 ? "text-red-600" : pct >= 80 ? "text-amber-600" : "text-green-600"
                              )}>
                                {pct}% capacity
                              </span>
                            </div>
                            <div className="h-2 bg-secondary rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
                            </div>
                            {pct >= 100 && (
                              <p className="text-xs text-red-600 font-medium">Registration closed — limit reached</p>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== MODULES SECTION ==================== */}
          {activeSection === "modules" && (
            <ModulesSection eventId={eventId} />
          )}

          {/* ==================== AUTOMATION SECTION ==================== */}
          {activeSection === "automation" && (
            <AutomationSection eventId={eventId} />
          )}

          {/* ==================== BRANDING SECTION ==================== */}
          {activeSection === "branding" && (
            <div className="space-y-6">
              {/* Live Preview Card */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-secondary/30">
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Live Preview — Registration Page</h3>
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
              <div className="grid grid-cols-3 gap-6">
                {/* Logo Upload */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <Image className="h-4 w-4 text-violet-500" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Event Logo</h4>
                      <p className="text-xs text-muted-foreground">Square, 200x200px</p>
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
                      <p className="text-xs text-muted-foreground">Wide, 1200x400px</p>
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

                {/* Favicon Upload */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <Globe className="h-4 w-4 text-orange-500" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Favicon</h4>
                      <p className="text-xs text-muted-foreground">Square, 32x32px ICO/PNG</p>
                    </div>
                  </div>
                  <ImageUpload
                    value={formData.favicon_url || ""}
                    onChange={(url) => updateField("favicon_url", url)}
                    eventId={eventId}
                    folder={`events/${eventId}/favicon`}
                    aspectRatio="square"
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

          {/* ==================== LINKS & CONTACT SECTION ==================== */}
          {activeSection === "links" && (
            <div className="space-y-6">
              {/* Contact Info */}
              <div className="bg-card border border-border rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <Link2 className="h-5 w-5 text-cyan-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Contact Information</h3>
                    <p className="text-sm text-muted-foreground">Displayed to attendees on registration page</p>
                  </div>
                </div>

                <div className="grid gap-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground">Contact Email</label>
                      <Input
                        type="email"
                        value={formData.contact_email || ""}
                        onChange={(e) => updateField("contact_email", e.target.value)}
                        placeholder="contact@example.com"
                        className="mt-1.5"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Also used as reply-to in automated emails</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Contact Phone</label>
                      <Input
                        type="tel"
                        value={formData.contact_phone || ""}
                        onChange={(e) => updateField("contact_phone", e.target.value)}
                        placeholder="+91 98765 43210"
                        className="mt-1.5"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground">Event Website</label>
                    <Input
                      type="url"
                      value={formData.website_url || ""}
                      onChange={(e) => updateField("website_url", e.target.value)}
                      placeholder="https://example.com"
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div className="bg-card border border-border rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <div className="h-10 w-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
                    <Globe className="h-5 w-5 text-pink-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Social Media</h3>
                    <p className="text-sm text-muted-foreground">Linked from registration page footer and emails</p>
                  </div>
                </div>

                <div className="grid gap-5">
                  <div>
                    <label className="text-sm font-medium text-foreground">Twitter / X</label>
                    <Input
                      type="url"
                      value={formData.social_twitter || ""}
                      onChange={(e) => updateField("social_twitter", e.target.value)}
                      placeholder="https://twitter.com/yourhandle"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Instagram</label>
                    <Input
                      type="url"
                      value={formData.social_instagram || ""}
                      onChange={(e) => updateField("social_instagram", e.target.value)}
                      placeholder="https://instagram.com/yourhandle"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">LinkedIn</label>
                    <Input
                      type="url"
                      value={formData.social_linkedin || ""}
                      onChange={(e) => updateField("social_linkedin", e.target.value)}
                      placeholder="https://linkedin.com/company/yourorg"
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>

              {/* SEO */}
              <div className="bg-card border border-border rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Search className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">SEO & Social Sharing</h3>
                    <p className="text-sm text-muted-foreground">Controls how your event appears in search results and social media cards</p>
                  </div>
                </div>

                <div className="grid gap-5">
                  <div>
                    <label className="text-sm font-medium text-foreground">SEO Title</label>
                    <Input
                      value={formData.seo_title || ""}
                      onChange={(e) => updateField("seo_title", e.target.value)}
                      placeholder={formData.name || "Event name (defaults to event name)"}
                      maxLength={70}
                      className="mt-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {(formData.seo_title || "").length}/70 — Browser tab title and og:title
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">SEO Description</label>
                    <textarea
                      value={formData.seo_description || ""}
                      onChange={(e) => updateField("seo_description", e.target.value)}
                      placeholder="Brief description for search engines and social sharing cards"
                      maxLength={160}
                      rows={2}
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {(formData.seo_description || "").length}/160 — Meta description for search engines
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== ADVANCED SECTION ==================== */}
          {activeSection === "advanced" && (
            <div className="space-y-6">
              {/* Clone Event */}
              <div className="bg-card border border-border rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Copy className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Clone Event</h3>
                    <p className="text-sm text-muted-foreground">Create a copy with all settings but no registrations or financial data</p>
                  </div>
                </div>

                {!showCloneDialog ? (
                  <Button variant="outline" onClick={() => {
                    setCloneData({
                      name: `${event?.name || ""} (Copy)`,
                      start_date: "",
                      end_date: "",
                    })
                    setShowCloneDialog(true)
                  }}>
                    <Copy className="h-4 w-4 mr-2" />
                    Clone This Event
                  </Button>
                ) : (
                  <div className="space-y-4 p-4 bg-secondary/30 rounded-xl border border-border">
                    <div>
                      <label className="text-sm font-medium">New Event Name</label>
                      <Input
                        value={cloneData.name}
                        onChange={(e) => setCloneData(prev => ({ ...prev, name: e.target.value }))}
                        className="mt-1.5"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Start Date</label>
                        <Input
                          type="date"
                          value={cloneData.start_date}
                          onChange={(e) => setCloneData(prev => ({ ...prev, start_date: e.target.value }))}
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">End Date</label>
                        <Input
                          type="date"
                          value={cloneData.end_date}
                          onChange={(e) => setCloneData(prev => ({ ...prev, end_date: e.target.value }))}
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleClone} disabled={cloning || !cloneData.name} className="gap-2">
                        {cloning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                        {cloning ? "Cloning..." : "Create Clone"}
                      </Button>
                      <Button variant="outline" onClick={() => setShowCloneDialog(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Export / Import Settings */}
              <div className="bg-card border border-border rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-violet-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Export / Import Settings</h3>
                    <p className="text-sm text-muted-foreground">Download or apply settings as JSON</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={exportSettings} className="gap-2">
                    <Download className="h-4 w-4" />
                    Export Settings
                  </Button>
                  <div className="relative">
                    <Button variant="outline" className="gap-2" onClick={() => document.getElementById('import-settings')?.click()}>
                      <Upload className="h-4 w-4" />
                      Import Settings
                    </Button>
                    <input
                      id="import-settings"
                      type="file"
                      accept=".json"
                      onChange={importSettings}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Settings Changelog */}
              <div className="bg-card border border-border rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <History className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Settings Changelog</h3>
                    <p className="text-sm text-muted-foreground">Recent changes to event settings</p>
                  </div>
                </div>

                {changelog && changelog.length > 0 ? (
                  <div className="space-y-2">
                    {changelog.map((entry: any) => (
                      <div key={entry.id} className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg text-sm">
                        <History className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{entry.summary}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {entry.section} section &middot; {new Date(entry.changed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No settings changes recorded yet.</p>
                )}
              </div>

              {/* Danger Zone - Delete Event */}
              <div className="bg-card border border-border rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Danger Zone</h3>
                    <p className="text-sm text-muted-foreground">Irreversible actions</p>
                  </div>
                </div>

                <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-xl space-y-4">
                  <div>
                    <h4 className="font-medium text-destructive">Delete Event</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Permanently delete this event and all associated data. This action cannot be undone.
                    </p>
                  </div>
                  {!showDeleteDialog ? (
                    <Button variant="destructive" size="sm" className="gap-2" onClick={() => setShowDeleteDialog(true)}>
                      <Trash2 className="h-4 w-4" />
                      Delete Event
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm">Type <strong>&quot;{event?.name}&quot;</strong> to confirm:</p>
                      <Input
                        value={deleteInput}
                        onChange={(e) => setDeleteInput(e.target.value)}
                        placeholder={event?.name || ""}
                        className="border-destructive/50"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={deleteInput !== event?.name}
                          className="gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Permanently Delete
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setShowDeleteDialog(false); setDeleteInput("") }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== AUTOMATION SECTION ====================
function AutomationSection({ eventId }: { eventId: string }) {
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

// ==================== MODULE DEFINITIONS ====================
const MODULE_DEFS = [
  { category: "Event Operations", modules: [
    { key: "enable_speakers", label: "Speakers", icon: "Mic", description: "Manage speakers, invitations, portal links, travel & accommodation", defaultOn: true },
    { key: "enable_program", label: "Program", icon: "Calendar", description: "Build event schedule with sessions, tracks, and speaker assignments", defaultOn: true },
    { key: "enable_checkin", label: "Checkin Hub", icon: "QrCode", description: "QR-based check-in, session tracking, and attendance reports", defaultOn: true },
    { key: "enable_badges", label: "Badges", icon: "BadgeCheck", description: "Design and print attendee badges with templates", defaultOn: true, dependsOn: "enable_checkin" },
    { key: "enable_certificates", label: "Certificates", icon: "Award", description: "Generate and email certificates to attendees", defaultOn: true },
    { key: "enable_print_station", label: "Print Station", icon: "Printer", description: "Kiosk mode for on-site badge printing", defaultOn: true, dependsOn: "enable_badges" },
  ]},
  { category: "Registration & Forms", modules: [
    { key: "enable_addons", label: "Addons", icon: "Package", description: "Optional add-on items for registration (meals, kits, etc.)", defaultOn: true },
    { key: "enable_waitlist", label: "Waitlist", icon: "ListOrdered", description: "Manage waitlist when tickets are sold out", defaultOn: true },
    { key: "enable_forms", label: "Forms", icon: "FileText", description: "Custom form builder for collecting additional data", defaultOn: true },
    { key: "enable_delegate_portal", label: "Delegate Portal", icon: "BarChart3", description: "Self-service portal for attendees to manage their registration", defaultOn: true },
    { key: "enable_surveys", label: "Surveys", icon: "ClipboardList", description: "Post-event feedback and surveys", defaultOn: true },
    { key: "enable_leads", label: "Leads", icon: "UserPlus", description: "Capture and manage potential attendee leads", defaultOn: true },
  ]},
  { category: "Travel & Logistics", modules: [
    { key: "enable_travel", label: "Travel", icon: "Plane", description: "Manage flight bookings and transfers for speakers/delegates", defaultOn: true },
    { key: "enable_accommodation", label: "Accommodation", icon: "Hotel", description: "Manage hotel bookings and room allocations", defaultOn: true },
    { key: "enable_meals", label: "Meals", icon: "UtensilsCrossed", description: "Meal preferences, dietary requirements, and meal tracking", defaultOn: true },
    { key: "enable_visa", label: "Visa Letters", icon: "Stamp", description: "Generate visa invitation letters for international delegates", defaultOn: true },
  ]},
  { category: "Finance & Sponsors", modules: [
    { key: "enable_sponsors", label: "Sponsors", icon: "Building2", description: "Manage event sponsors, tiers, and sponsorship packages", defaultOn: true },
    { key: "enable_budget", label: "Budget", icon: "IndianRupee", description: "Track event budget, expenses, and financial reports", defaultOn: true },
  ]},
  { category: "Advanced Modules", modules: [
    { key: "enable_abstracts", label: "Abstract Management", icon: "BookOpen", description: "Abstract submission, review workflow, accept/reject decisions", defaultOn: false },
    { key: "enable_examination", label: "Examination (FMAS / MMAS)", icon: "GraduationCap", description: "Marks entry, results, convocation numbering, address collection", defaultOn: false },
  ]},
] as const

// Dependency map: if you disable a key, dependents should also be disabled
const MODULE_DEPS: Record<string, string[]> = {
  enable_checkin: ["enable_badges", "enable_print_station"],
  enable_badges: ["enable_print_station"],
}

// ==================== MODULES SECTION ====================
function ModulesSection({ eventId }: { eventId: string }) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  const ALL_MODULE_KEYS = MODULE_DEFS.flatMap(c => c.modules.map(m => m.key))
  const MODULE_FIELDS = ALL_MODULE_KEYS.join(", ")

  const { data: settings, isLoading } = useQuery({
    queryKey: ["event-module-settings", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_settings")
        .select(MODULE_FIELDS)
        .eq("event_id", eventId)
        .maybeSingle()

      if (error) throw error
      return data as Record<string, boolean> | null
    },
    enabled: !!eventId,
  })

  const getDefault = (key: string) => {
    for (const cat of MODULE_DEFS) {
      const mod = cat.modules.find(m => m.key === key)
      if (mod) return mod.defaultOn
    }
    return true
  }

  const [formData, setFormData] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const initial: Record<string, boolean> = {}
    for (const key of ALL_MODULE_KEYS) {
      initial[key] = settings?.[key] ?? getDefault(key)
    }
    setFormData(initial)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  const handleSaveAll = async () => {
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
      window.dispatchEvent(new CustomEvent("event-settings-saved"))
      toast.success("All modules saved")
    } catch (error) {
      console.error("Failed to save module settings:", error)
      toast.error("Failed to save modules")
    }
    setSaving(false)
  }

  const toggleModule = (key: string) => {
    const newVal = !formData[key]
    const updates: Record<string, boolean> = { [key]: newVal }

    // If disabling, also disable dependents
    if (!newVal && MODULE_DEPS[key]) {
      for (const dep of MODULE_DEPS[key]) {
        updates[dep] = false
      }
    }

    setFormData(prev => ({ ...prev, ...updates }))

    // Show toast about cascaded disables
    if (!newVal && MODULE_DEPS[key]) {
      const disabledDeps = MODULE_DEPS[key].filter(d => formData[d])
      if (disabledDeps.length > 0) {
        const labels = disabledDeps.map(d => {
          for (const cat of MODULE_DEFS) {
            const mod = cat.modules.find(m => m.key === d)
            if (mod) return mod.label
          }
          return d
        })
        toast.info(`Also disabled: ${labels.join(", ")} (dependency)`)
      }
    }
  }

  const enableAll = () => {
    const updated: Record<string, boolean> = {}
    for (const key of ALL_MODULE_KEYS) updated[key] = true
    setFormData(updated)
  }

  const disableOptional = () => {
    const updated: Record<string, boolean> = {}
    for (const key of ALL_MODULE_KEYS) updated[key] = false
    setFormData(updated)
  }

  const enabledCount = Object.values(formData).filter(Boolean).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Blocks className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h3 className="font-semibold">Event Modules</h3>
            <p className="text-sm text-muted-foreground">
              {enabledCount} of {ALL_MODULE_KEYS.length} modules enabled
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={enableAll}>Enable All</Button>
          <Button variant="outline" size="sm" onClick={disableOptional}>Disable All</Button>
        </div>
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Toggle modules to show or hide them from the sidebar. Core items like Dashboard, Tickets,
          Attendees, Orders, Team, Communications, and Settings are always visible.
        </p>
      </div>

      {MODULE_DEFS.map((category) => {
        const categoryEnabledCount = category.modules.filter(m => formData[m.key] ?? m.defaultOn).length
        return (
          <div key={category.category} className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {category.category}
                <span className="ml-2 text-xs font-normal normal-case">
                  ({categoryEnabledCount}/{category.modules.length})
                </span>
              </h4>
            </div>

            {category.category === "Advanced Modules" && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  These modules are specialized. Enable only if your event requires abstract submission or examination components.
                </p>
              </div>
            )}

            <div className="grid gap-2">
              {category.modules.map((mod) => {
                const isEnabled = formData[mod.key] ?? mod.defaultOn
                // Check if this module's dependency is disabled
                const dep = (mod as any).dependsOn as string | undefined
                const depDisabled = dep ? !(formData[dep] ?? true) : false

                return (
                  <div
                    key={mod.key}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer",
                      isEnabled
                        ? "bg-secondary/30 border-border"
                        : "bg-muted/20 border-dashed border-border opacity-60"
                    )}
                    onClick={() => toggleModule(mod.key)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        isEnabled ? "bg-primary/10" : "bg-muted"
                      )}>
                        <Blocks className={cn("h-4 w-4", isEnabled ? "text-primary" : "text-muted-foreground")} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{mod.label}</p>
                          {isEnabled && (
                            <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded-full">On</span>
                          )}
                          {depDisabled && isEnabled && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                              Requires {dep?.replace("enable_", "")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{mod.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => toggleModule(mod.key)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="flex justify-end pt-4 border-t border-border">
        <Button onClick={handleSaveAll} disabled={saving} className="gap-2">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Modules
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
