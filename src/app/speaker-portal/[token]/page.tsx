"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  Loader2,
  CheckCircle2,
  XCircle,
  User,
  FileText,
  Image,
  Presentation,
  Save,
} from "lucide-react"
import { toast } from "sonner"

type Speaker = {
  id: string
  name: string
  email: string
  designation: string | null
  bio_submitted: boolean
  photo_submitted: boolean
  presentation_submitted: boolean
  bio_text: string
  photo_url: string
  presentation_url: string
}

type Event = {
  id: string
  name: string
  short_name: string | null
  logo_url: string | null
  start_date: string | null
  end_date: string | null
  venue_name: string | null
}

export default function SpeakerPortalPage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [speaker, setSpeaker] = useState<Speaker | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Form state
  const [bioText, setBioText] = useState("")
  const [photoUrl, setPhotoUrl] = useState("")
  const [presentationUrl, setPresentationUrl] = useState("")

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`/api/speaker-portal/${token}`)
        const data = await res.json()

        if (!res.ok || data.error) {
          setError(data.error || "Invalid or expired portal link")
          setLoading(false)
          return
        }

        setSpeaker(data.speaker)
        setEvent(data.event)
        setBioText(data.speaker.bio_text || "")
        setPhotoUrl(data.speaker.photo_url || "")
        setPresentationUrl(data.speaker.presentation_url || "")
      } catch (_err) {
        setError("Failed to load portal")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [token])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/speaker-portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio_text: bioText,
          photo_url: photoUrl,
          presentation_url: presentationUrl,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to save")
      }

      // Update local state
      if (speaker) {
        setSpeaker({
          ...speaker,
          bio_submitted: !!bioText,
          photo_submitted: !!photoUrl,
          presentation_submitted: !!presentationUrl,
          bio_text: bioText,
          photo_url: photoUrl,
          presentation_url: presentationUrl,
        })
      }

      setSaved(true)
      toast.success("Your information has been saved!")
    } catch (_err) {
      toast.error("Failed to save. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !speaker) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <XCircle className="h-16 w-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-600 mb-6">{error || "This portal link is invalid or has expired."}</p>
          <p className="text-sm text-gray-500">
            If you believe this is an error, please contact the event organizers.
          </p>
        </div>
      </div>
    )
  }

  const _isComplete = speaker.bio_submitted && speaker.photo_submitted

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="bg-primary/10 p-6 text-center">
            {event?.logo_url && (
              <img src={event.logo_url} alt="" className="h-16 mx-auto mb-4" />
            )}
            <h1 className="text-2xl font-bold text-gray-900">{event?.name || "Conference"}</h1>
            {event?.venue_name && (
              <p className="text-gray-600 mt-1">{event.venue_name}</p>
            )}
          </div>

          <div className="p-6">
            <h2 className="text-xl font-semibold text-center mb-2">
              Speaker Portal
            </h2>
            <p className="text-center text-gray-600 mb-6">
              Please submit your bio, photo, and presentation
            </p>

            {/* Speaker Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-3 rounded-full">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-lg">{speaker.name}</p>
                  <p className="text-gray-600 text-sm">{speaker.email}</p>
                  {speaker.designation && (
                    <p className="text-gray-500 text-sm">{speaker.designation}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Status Summary */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className={cn(
                "rounded-lg p-3 text-center",
                speaker.bio_submitted ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"
              )}>
                <FileText className={cn(
                  "h-6 w-6 mx-auto mb-1",
                  speaker.bio_submitted ? "text-green-600" : "text-amber-600"
                )} />
                <p className="text-xs font-medium">Bio</p>
                <p className={cn(
                  "text-xs",
                  speaker.bio_submitted ? "text-green-600" : "text-amber-600"
                )}>
                  {speaker.bio_submitted ? "Submitted" : "Pending"}
                </p>
              </div>
              <div className={cn(
                "rounded-lg p-3 text-center",
                speaker.photo_submitted ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"
              )}>
                <Image className={cn(
                  "h-6 w-6 mx-auto mb-1",
                  speaker.photo_submitted ? "text-green-600" : "text-amber-600"
                )} />
                <p className="text-xs font-medium">Photo</p>
                <p className={cn(
                  "text-xs",
                  speaker.photo_submitted ? "text-green-600" : "text-amber-600"
                )}>
                  {speaker.photo_submitted ? "Submitted" : "Pending"}
                </p>
              </div>
              <div className={cn(
                "rounded-lg p-3 text-center",
                speaker.presentation_submitted ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"
              )}>
                <Presentation className={cn(
                  "h-6 w-6 mx-auto mb-1",
                  speaker.presentation_submitted ? "text-green-600" : "text-gray-400"
                )} />
                <p className="text-xs font-medium">Presentation</p>
                <p className={cn(
                  "text-xs",
                  speaker.presentation_submitted ? "text-green-600" : "text-gray-500"
                )}>
                  {speaker.presentation_submitted ? "Submitted" : "Optional"}
                </p>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-6">
              {/* Bio */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  Your Bio <span className="text-red-500">*</span>
                </Label>
                <p className="text-xs text-gray-500">
                  A brief professional biography (150-300 words recommended)
                </p>
                <Textarea
                  value={bioText}
                  onChange={(e) => setBioText(e.target.value)}
                  placeholder="Enter your professional bio here..."
                  rows={6}
                  className="resize-none"
                />
                {bioText && (
                  <p className="text-xs text-gray-500 text-right">
                    {bioText.split(/\s+/).filter(Boolean).length} words
                  </p>
                )}
              </div>

              {/* Photo URL */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Image className="h-4 w-4 text-purple-500" />
                  Photo URL <span className="text-red-500">*</span>
                </Label>
                <p className="text-xs text-gray-500">
                  Link to your professional headshot (Google Drive, Dropbox, etc.)
                </p>
                <Input
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                />
                {photoUrl && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-2">Preview:</p>
                    <img
                      src={photoUrl}
                      alt="Photo preview"
                      className="w-24 h-24 rounded-lg object-cover border"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Presentation URL */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Presentation className="h-4 w-4 text-orange-500" />
                  Presentation URL <span className="text-gray-400">(Optional)</span>
                </Label>
                <p className="text-xs text-gray-500">
                  Link to your presentation file (PowerPoint, PDF, etc.)
                </p>
                <Input
                  value={presentationUrl}
                  onChange={(e) => setPresentationUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-8">
              <Button
                onClick={handleSave}
                disabled={saving || (!bioText && !photoUrl && !presentationUrl)}
                className="w-full"
                size="lg"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Information
                  </>
                )}
              </Button>

              {saved && (
                <div className="mt-4 p-4 bg-green-50 rounded-lg text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-green-700 font-medium">Successfully saved!</p>
                  <p className="text-sm text-green-600">You can update your information anytime.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500">
          Questions? Contact the organizing committee at the event email.
        </p>
      </div>
    </div>
  )
}
