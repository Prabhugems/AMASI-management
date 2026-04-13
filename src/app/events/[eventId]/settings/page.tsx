"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Settings,
  Calendar,
  MapPin,
  Link2,
  Bell,
  Shield,
  Palette,
  Save,
  Loader2,
  Users,
  Blocks,
  ChevronLeft,
  Plug,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { type EventSettings } from "./types"

// Section components
import { GeneralSection } from "./general-section"
import { DatetimeSection } from "./datetime-section"
import { LocationSection } from "./location-section"
import { RegistrationSection } from "./registration-section"
import { BrandingSection } from "./branding-section"
import { LinksSection } from "./links-section"
import { AdvancedSection } from "./advanced-section"
import { ModulesSection } from "./modules-section"
import { AutomationSection } from "./automation-section"
import { IntegrationsSection } from "./integrations-section"
import { TeamSection } from "./team-section"

export default function SettingsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState<Partial<EventSettings>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [activeSection, setActiveSection] = useState("general")

  // Clone state
  const [cloning, setCloning] = useState(false)

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

  // Save settings mutation
  const saveSettings = useMutation({
    mutationFn: async (data: Partial<EventSettings>) => {
      // Pre-save slug validation: check if slug changed and is available
      if (data.slug && data.slug !== event?.slug) {
        const slugRes = await fetch(`/api/events/check-slug?slug=${data.slug}&exclude_id=${eventId}`)
        const slugData = await slugRes.json()
        if (!slugData.available) {
          throw new Error(`URL slug "${data.slug}" is already taken`)
        }
      }

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

  const handleSectionChange = (sectionId: string) => {
    if (hasChanges) {
      const confirmed = window.confirm("You have unsaved changes. Discard them?")
      if (!confirmed) return
      if (event) setFormData(event)
    }
    setActiveSection(sectionId)
  }

  // Clone event handler
  const handleClone = async (cloneData: { name: string; start_date: string; end_date: string }) => {
    setCloning(true)
    try {
      const res = await fetch(`/api/events/${eventId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cloneData),
      })
      if (!res.ok) throw new Error("Failed to clone event")
      const data = await res.json()
      toast.success(`Event "${cloneData.name}" cloned successfully!`)
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
    team: "Team",
    automation: "Automation",
    integrations: "Integrations",
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
    { id: "team", label: "Team", icon: Users },
    { id: "automation", label: "Automation", icon: Bell },
    { id: "integrations", label: "Integrations", icon: Plug },
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
          {activeSection === "general" && (
            <GeneralSection eventId={eventId} formData={formData} updateField={updateField} setFormData={setFormData} />
          )}

          {activeSection === "datetime" && (
            <DatetimeSection eventId={eventId} formData={formData} updateField={updateField} setFormData={setFormData} />
          )}

          {activeSection === "location" && (
            <LocationSection eventId={eventId} formData={formData} updateField={updateField} setFormData={setFormData} />
          )}

          {activeSection === "registration" && (
            <RegistrationSection eventId={eventId} formData={formData} updateField={updateField} setFormData={setFormData} regCount={regCount} />
          )}

          {activeSection === "modules" && (
            <ModulesSection eventId={eventId} />
          )}

          {activeSection === "team" && (
            <TeamSection eventId={eventId} />
          )}

          {activeSection === "automation" && (
            <AutomationSection eventId={eventId} />
          )}

          {activeSection === "integrations" && (
            <IntegrationsSection eventId={eventId} />
          )}

          {activeSection === "branding" && (
            <BrandingSection eventId={eventId} formData={formData} updateField={updateField} setFormData={setFormData} />
          )}

          {activeSection === "links" && (
            <LinksSection eventId={eventId} formData={formData} updateField={updateField} setFormData={setFormData} />
          )}

          {activeSection === "advanced" && (
            <AdvancedSection
              eventId={eventId}
              event={event}
              formData={formData}
              setFormData={setFormData}
              changelog={changelog}
              onClone={handleClone}
              cloning={cloning}
              onExport={exportSettings}
              onImport={importSettings}
            />
          )}
        </div>
      </div>
    </div>
  )
}
