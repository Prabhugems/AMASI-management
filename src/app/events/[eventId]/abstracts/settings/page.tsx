"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  FileText,
  Users,
  Settings,
  Bell,
  Eye,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AbstractSettings {
  event_id: string
  submission_opens_at: string | null
  submission_deadline: string | null
  revision_deadline: string | null
  notification_date: string | null
  max_submissions_per_person: number
  max_authors: number
  word_limit: number
  require_registration: boolean
  require_addon_id: string | null
  allowed_file_types: string[]
  max_file_size_mb: number
  presentation_types: string[]
  review_enabled: boolean
  reviewers_per_abstract: number
  blind_review: boolean
  submission_guidelines: string | null
  author_guidelines: string | null
  notify_on_submission: boolean
  notify_on_decision: boolean
}

const presentationTypeOptions = [
  { value: "oral", label: "Oral Presentation" },
  { value: "poster", label: "Poster / ePoster" },
  { value: "video", label: "Video Presentation" },
]

export default function AbstractSettingsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState<Partial<AbstractSettings>>({})
  const [hasChanges, setHasChanges] = useState(false)

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["abstract-settings", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/abstract-settings/${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch settings")
      return res.json() as Promise<AbstractSettings>
    },
  })

  // Initialize form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData(settings)
    }
  }, [settings])

  // Track changes
  useEffect(() => {
    if (settings && formData.event_id) {
      const changed = JSON.stringify(settings) !== JSON.stringify(formData)
      setHasChanges(changed)
    }
  }, [formData, settings])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<AbstractSettings>) => {
      const res = await fetch(`/api/abstract-settings/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to save settings")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstract-settings", eventId] })
      setHasChanges(false)
    },
  })

  const updateField = (field: keyof AbstractSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const togglePresentationType = (type: string) => {
    const current = formData.presentation_types || []
    if (current.includes(type)) {
      updateField("presentation_types", current.filter((t) => t !== type))
    } else {
      updateField("presentation_types", [...current, type])
    }
  }

  const formatDateTimeLocal = (isoString: string | null) => {
    if (!isoString) return ""
    const date = new Date(isoString)
    return date.toISOString().slice(0, 16)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Abstract Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure deadlines, limits, and submission guidelines
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate(formData)}
          disabled={!hasChanges || saveMutation.isPending}
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
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Success/Error Messages */}
      {saveMutation.isSuccess && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 text-success border border-success/20">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm">Settings saved successfully!</span>
        </div>
      )}

      {saveMutation.isError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{saveMutation.error.message}</span>
        </div>
      )}

      <div className="grid gap-6">
        {/* Deadlines Section */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold">Deadlines</h3>
              <p className="text-sm text-muted-foreground">Set submission and revision deadlines</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Submission Opens</label>
              <Input
                type="datetime-local"
                value={formatDateTimeLocal(formData.submission_opens_at || null)}
                onChange={(e) => updateField("submission_opens_at", e.target.value ? new Date(e.target.value).toISOString() : null)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">When authors can start submitting</p>
            </div>
            <div>
              <label className="text-sm font-medium">Submission Deadline</label>
              <Input
                type="datetime-local"
                value={formatDateTimeLocal(formData.submission_deadline || null)}
                onChange={(e) => updateField("submission_deadline", e.target.value ? new Date(e.target.value).toISOString() : null)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Final deadline for submissions</p>
            </div>
            <div>
              <label className="text-sm font-medium">Revision Deadline</label>
              <Input
                type="datetime-local"
                value={formatDateTimeLocal(formData.revision_deadline || null)}
                onChange={(e) => updateField("revision_deadline", e.target.value ? new Date(e.target.value).toISOString() : null)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Deadline for revisions after "revision requested"</p>
            </div>
            <div>
              <label className="text-sm font-medium">Notification Date</label>
              <Input
                type="datetime-local"
                value={formatDateTimeLocal(formData.notification_date || null)}
                onChange={(e) => updateField("notification_date", e.target.value ? new Date(e.target.value).toISOString() : null)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Expected date of acceptance notification</p>
            </div>
          </div>
        </div>

        {/* Limits Section */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h3 className="font-semibold">Submission Limits</h3>
              <p className="text-sm text-muted-foreground">Control word counts, file sizes, and submission limits</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Max Submissions per Author</label>
              <Input
                type="number"
                value={formData.max_submissions_per_person || ""}
                onChange={(e) => updateField("max_submissions_per_person", parseInt(e.target.value) || 3)}
                className="mt-1"
                min={1}
                max={20}
              />
              <p className="text-xs text-muted-foreground mt-1">Per presenting author</p>
            </div>
            <div>
              <label className="text-sm font-medium">Max Co-Authors</label>
              <Input
                type="number"
                value={formData.max_authors || ""}
                onChange={(e) => updateField("max_authors", parseInt(e.target.value) || 10)}
                className="mt-1"
                min={1}
                max={50}
              />
              <p className="text-xs text-muted-foreground mt-1">Maximum authors per abstract</p>
            </div>
            <div>
              <label className="text-sm font-medium">Word Limit</label>
              <Input
                type="number"
                value={formData.word_limit || ""}
                onChange={(e) => updateField("word_limit", parseInt(e.target.value) || 300)}
                className="mt-1"
                min={100}
                max={1000}
              />
              <p className="text-xs text-muted-foreground mt-1">Abstract body word limit</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Allowed File Types</label>
              <Input
                value={(formData.allowed_file_types || []).join(", ")}
                onChange={(e) => updateField("allowed_file_types", e.target.value.split(",").map((t) => t.trim().toLowerCase()))}
                className="mt-1"
                placeholder="pdf, docx"
              />
              <p className="text-xs text-muted-foreground mt-1">Comma-separated file extensions</p>
            </div>
            <div>
              <label className="text-sm font-medium">Max File Size (MB)</label>
              <Input
                type="number"
                value={formData.max_file_size_mb || ""}
                onChange={(e) => updateField("max_file_size_mb", parseInt(e.target.value) || 5)}
                className="mt-1"
                min={1}
                max={100}
              />
              <p className="text-xs text-muted-foreground mt-1">For videos, consider higher limits</p>
            </div>
          </div>
        </div>

        {/* Presentation Types Section */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold">Presentation Types</h3>
              <p className="text-sm text-muted-foreground">Select allowed presentation formats</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {presentationTypeOptions.map((option) => (
              <div
                key={option.value}
                onClick={() => togglePresentationType(option.value)}
                className={cn(
                  "p-4 rounded-xl border-2 cursor-pointer transition-all",
                  (formData.presentation_types || []).includes(option.value)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                      (formData.presentation_types || []).includes(option.value)
                        ? "border-primary bg-primary"
                        : "border-muted-foreground"
                    )}
                  >
                    {(formData.presentation_types || []).includes(option.value) && (
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <span className="font-medium">{option.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Requirements Section */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Settings className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <h3 className="font-semibold">Requirements</h3>
              <p className="text-sm text-muted-foreground">Configure submission requirements</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-border">
              <div className="flex-1 pr-4">
                <p className="font-medium">Require Registration</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Authors must have a confirmed registration to submit abstracts
                </p>
              </div>
              <Switch
                checked={formData.require_registration ?? true}
                onCheckedChange={(checked) => updateField("require_registration", checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-border">
              <div className="flex-1 pr-4">
                <p className="font-medium">Enable Review Workflow</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Enable peer review scoring before acceptance decisions
                </p>
              </div>
              <Switch
                checked={formData.review_enabled ?? false}
                onCheckedChange={(checked) => updateField("review_enabled", checked)}
              />
            </div>

            {formData.review_enabled && (
              <>
                <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-border ml-6">
                  <div className="flex-1 pr-4">
                    <p className="font-medium">Blind Review</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Hide author information from reviewers
                    </p>
                  </div>
                  <Switch
                    checked={formData.blind_review ?? true}
                    onCheckedChange={(checked) => updateField("blind_review", checked)}
                  />
                </div>

                <div className="ml-6">
                  <label className="text-sm font-medium">Reviewers per Abstract</label>
                  <Input
                    type="number"
                    value={formData.reviewers_per_abstract || ""}
                    onChange={(e) => updateField("reviewers_per_abstract", parseInt(e.target.value) || 2)}
                    className="mt-1 w-32"
                    min={1}
                    max={5}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Notifications Section */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="h-10 w-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
              <Bell className="h-5 w-5 text-pink-500" />
            </div>
            <div>
              <h3 className="font-semibold">Notifications</h3>
              <p className="text-sm text-muted-foreground">Email notification settings</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-border">
              <div className="flex-1 pr-4">
                <p className="font-medium">Notify on Submission</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Send confirmation email to authors when they submit
                </p>
              </div>
              <Switch
                checked={formData.notify_on_submission ?? true}
                onCheckedChange={(checked) => updateField("notify_on_submission", checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-border">
              <div className="flex-1 pr-4">
                <p className="font-medium">Notify on Decision</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Send email when abstract is accepted or rejected
                </p>
              </div>
              <Switch
                checked={formData.notify_on_decision ?? true}
                onCheckedChange={(checked) => updateField("notify_on_decision", checked)}
              />
            </div>
          </div>
        </div>

        {/* Guidelines Section */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Eye className="h-5 w-5 text-cyan-500" />
            </div>
            <div>
              <h3 className="font-semibold">Guidelines</h3>
              <p className="text-sm text-muted-foreground">Instructions shown to authors</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Submission Guidelines</label>
              <textarea
                value={formData.submission_guidelines || ""}
                onChange={(e) => updateField("submission_guidelines", e.target.value)}
                placeholder="Enter guidelines for abstract submission..."
                rows={6}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Displayed on the submission page
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Author Guidelines</label>
              <textarea
                value={formData.author_guidelines || ""}
                onChange={(e) => updateField("author_guidelines", e.target.value)}
                placeholder="Enter guidelines for authors and co-authors..."
                rows={4}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Instructions for adding co-authors
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
