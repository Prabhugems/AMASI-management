"use client"

import { useCallback, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
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
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Mic,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { COMPANY_CONFIG } from "@/lib/config"
import { type SectionProps, ordinal } from "./types"

export function GeneralSection({ eventId, formData, updateField, setFormData }: SectionProps) {
  // Slug availability state
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [slugChecking, setSlugChecking] = useState(false)
  const [slugSuggestion, setSlugSuggestion] = useState<string | null>(null)
  const slugCheckTimer = useRef<NodeJS.Timeout>()

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  return (
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
  )
}
