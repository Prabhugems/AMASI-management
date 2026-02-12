"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Settings,
  Loader2,
  Save,
  Plus,
  Trash2,
  Layers,
  FileText,
  HelpCircle,
  GripVertical,
  Palette,
  Sun,
  Moon,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"

type Track = {
  id: string
  name: string
  color: "blue" | "pink" | "purple" | "green" | "orange" | "amber"
  description: string
}

type ExamComponent = {
  id: string
  name: string
  marks: number
}

type FAQ = {
  id: string
  question: string
  answer: string
}

type PublicPageSettings = {
  theme: "modern" | "classic" | "dark" | "minimal"
  show_tracks: boolean
  tracks: Track[]
  show_exam_details: boolean
  exam_theory: {
    questions: number
    marks: number
    duration_minutes: number
    negative_marking: boolean
  }
  exam_practical: ExamComponent[]
  show_faq: boolean
  faqs: FAQ[]
  footer_text: string
}

const THEMES = [
  {
    value: "modern",
    label: "Modern",
    description: "Gradient header, clean cards, professional look",
    icon: Sparkles,
    preview: "bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900",
  },
  {
    value: "classic",
    label: "Classic",
    description: "Cream/sepia background with teal accents",
    icon: Sun,
    preview: "bg-gradient-to-r from-[#1B6B93] to-[#14919B]",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Dark mode with high contrast",
    icon: Moon,
    preview: "bg-gradient-to-r from-gray-900 to-gray-800",
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Clean white design, simple and elegant",
    icon: Palette,
    preview: "bg-gradient-to-r from-gray-100 to-white",
  },
]

const DEFAULT_SETTINGS: PublicPageSettings = {
  theme: "modern",
  show_tracks: false,
  tracks: [],
  show_exam_details: false,
  exam_theory: {
    questions: 60,
    marks: 60,
    duration_minutes: 45,
    negative_marking: false,
  },
  exam_practical: [],
  show_faq: false,
  faqs: [],
  footer_text: "",
}

const TRACK_COLORS = [
  { value: "blue", label: "Blue", bg: "bg-blue-600" },
  { value: "pink", label: "Pink", bg: "bg-pink-600" },
  { value: "purple", label: "Purple", bg: "bg-purple-600" },
  { value: "green", label: "Green", bg: "bg-green-600" },
  { value: "orange", label: "Orange", bg: "bg-orange-600" },
  { value: "amber", label: "Amber", bg: "bg-amber-600" },
]

export default function PublicPageSettingsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [settings, setSettings] = useState<PublicPageSettings>(DEFAULT_SETTINGS)

  // Fetch event settings
  const { data: event, isLoading } = useQuery({
    queryKey: ["event-public-settings", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, settings")
        .eq("id", eventId)
        .single()
      return data as { id: string; name: string; settings?: { public_page?: PublicPageSettings } } | null
    },
  })

  // Load settings when event data is fetched
  useEffect(() => {
    if (event?.settings?.public_page) {
      setSettings({ ...DEFAULT_SETTINGS, ...event.settings.public_page })
    }
  }, [event])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const currentSettings = event?.settings || {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("events")
        .update({
          settings: {
            ...currentSettings,
            public_page: settings,
          },
        })
        .eq("id", eventId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-public-settings", eventId] })
      toast.success("Public page settings saved")
    },
    onError: () => {
      toast.error("Failed to save settings")
    },
  })

  // Track management
  const addTrack = () => {
    setSettings({
      ...settings,
      tracks: [
        ...settings.tracks,
        { id: crypto.randomUUID(), name: "", color: "blue", description: "" },
      ],
    })
  }

  const updateTrack = (id: string, updates: Partial<Track>) => {
    setSettings({
      ...settings,
      tracks: settings.tracks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })
  }

  const removeTrack = (id: string) => {
    setSettings({
      ...settings,
      tracks: settings.tracks.filter((t) => t.id !== id),
    })
  }

  // Exam component management
  const addExamComponent = () => {
    setSettings({
      ...settings,
      exam_practical: [
        ...settings.exam_practical,
        { id: crypto.randomUUID(), name: "", marks: 0 },
      ],
    })
  }

  const updateExamComponent = (id: string, updates: Partial<ExamComponent>) => {
    setSettings({
      ...settings,
      exam_practical: settings.exam_practical.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })
  }

  const removeExamComponent = (id: string) => {
    setSettings({
      ...settings,
      exam_practical: settings.exam_practical.filter((c) => c.id !== id),
    })
  }

  // FAQ management
  const addFAQ = () => {
    setSettings({
      ...settings,
      faqs: [...settings.faqs, { id: crypto.randomUUID(), question: "", answer: "" }],
    })
  }

  const updateFAQ = (id: string, updates: Partial<FAQ>) => {
    setSettings({
      ...settings,
      faqs: settings.faqs.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    })
  }

  const removeFAQ = (id: string) => {
    setSettings({
      ...settings,
      faqs: settings.faqs.filter((f) => f.id !== id),
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Public Page Settings</h1>
          <p className="text-muted-foreground">
            Configure what appears on the public program page
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>

      {/* Theme Selection */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Program Theme</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Choose a visual theme for the public and delegate program pages
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {THEMES.map((theme) => {
            const Icon = theme.icon
            const isSelected = settings.theme === theme.value
            return (
              <button
                key={theme.value}
                onClick={() =>
                  setSettings({ ...settings, theme: theme.value as PublicPageSettings["theme"] })
                }
                className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-transparent bg-muted/50 hover:bg-muted"
                }`}
              >
                <div className={`w-12 h-8 rounded ${theme.preview} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{theme.label}</span>
                    {isSelected && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{theme.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tracks Section */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Program Tracks</h3>
          </div>
          <Switch
            checked={settings.show_tracks}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, show_tracks: checked })
            }
          />
        </div>

        {settings.show_tracks && (
          <div className="space-y-4">
            {settings.tracks.map((track) => (
              <div
                key={track.id}
                className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
              >
                <GripVertical className="h-5 w-5 text-muted-foreground mt-2 cursor-move" />
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Track Name</Label>
                    <Input
                      value={track.name}
                      onChange={(e) => updateTrack(track.id, { name: e.target.value })}
                      placeholder="e.g., Surgery Track"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Color</Label>
                    <Select
                      value={track.color}
                      onValueChange={(value: Track["color"]) =>
                        updateTrack(track.id, { color: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRACK_COLORS.map((color) => (
                          <SelectItem key={color.value} value={color.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded ${color.bg}`} />
                              {color.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3">
                    <Label className="text-xs">Description</Label>
                    <Textarea
                      value={track.description}
                      onChange={(e) =>
                        updateTrack(track.id, { description: e.target.value })
                      }
                      placeholder="Brief description of this track..."
                      rows={2}
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeTrack(track.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addTrack}>
              <Plus className="h-4 w-4 mr-2" />
              Add Track
            </Button>
          </div>
        )}
      </div>

      {/* Examination Section */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Examination Details</h3>
          </div>
          <Switch
            checked={settings.show_exam_details}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, show_exam_details: checked })
            }
          />
        </div>

        {settings.show_exam_details && (
          <div className="space-y-6">
            {/* Theory Exam */}
            <div>
              <h4 className="font-medium text-sm mb-3">Theory Examination</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Questions</Label>
                  <Input
                    type="number"
                    value={settings.exam_theory.questions}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        exam_theory: {
                          ...settings.exam_theory,
                          questions: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Total Marks</Label>
                  <Input
                    type="number"
                    value={settings.exam_theory.marks}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        exam_theory: {
                          ...settings.exam_theory,
                          marks: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Duration (mins)</Label>
                  <Input
                    type="number"
                    value={settings.exam_theory.duration_minutes}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        exam_theory: {
                          ...settings.exam_theory,
                          duration_minutes: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                  />
                </div>
                <div className="flex items-end pb-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={settings.exam_theory.negative_marking}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          exam_theory: {
                            ...settings.exam_theory,
                            negative_marking: checked,
                          },
                        })
                      }
                    />
                    <Label className="text-xs">Negative Marking</Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Practical Components */}
            <div>
              <h4 className="font-medium text-sm mb-3">Practical Assessment Components</h4>
              <div className="space-y-2">
                {settings.exam_practical.map((component) => (
                  <div key={component.id} className="flex items-center gap-3">
                    <Input
                      value={component.name}
                      onChange={(e) =>
                        updateExamComponent(component.id, { name: e.target.value })
                      }
                      placeholder="Component name (e.g., Viva)"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={component.marks}
                      onChange={(e) =>
                        updateExamComponent(component.id, {
                          marks: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="Marks"
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">marks</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeExamComponent(component.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addExamComponent}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Component
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FAQ Section */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Frequently Asked Questions</h3>
          </div>
          <Switch
            checked={settings.show_faq}
            onCheckedChange={(checked) => setSettings({ ...settings, show_faq: checked })}
          />
        </div>

        {settings.show_faq && (
          <div className="space-y-4">
            {settings.faqs.map((faq, index) => (
              <div key={faq.id} className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Q{index + 1}.
                  </span>
                  <div className="flex-1">
                    <Input
                      value={faq.question}
                      onChange={(e) => updateFAQ(faq.id, { question: e.target.value })}
                      placeholder="Question..."
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeFAQ(faq.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="pl-6">
                  <Textarea
                    value={faq.answer}
                    onChange={(e) => updateFAQ(faq.id, { answer: e.target.value })}
                    placeholder="Answer..."
                    rows={2}
                  />
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addFAQ}>
              <Plus className="h-4 w-4 mr-2" />
              Add FAQ
            </Button>
          </div>
        )}
      </div>

      {/* Footer Text */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Footer Text</h3>
        </div>
        <Textarea
          value={settings.footer_text}
          onChange={(e) => setSettings({ ...settings, footer_text: e.target.value })}
          placeholder="e.g., Organized by AMASI (Association of Minimal Access Surgeons of India)"
          rows={2}
        />
        <p className="text-xs text-muted-foreground mt-1">
          This text appears at the bottom of the public program page
        </p>
      </div>
    </div>
  )
}
