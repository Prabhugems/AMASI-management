"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import {
  User,
  FileText,
  Users,
  Tag,
  Upload,
  CheckSquare,
  ArrowLeft,
  ArrowRight,
  Save,
  Send,
  Loader2,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  MapPin,
  Info,
  X,
  Video,
  Link2,
  ExternalLink,
} from "lucide-react"

interface Author {
  name: string
  email: string
  affiliation: string
  is_presenting: boolean
}

interface Category {
  id: string
  name: string
  description: string
  is_award_category: boolean
  award_name: string
}

interface FormData {
  // Step 1: Author
  presenting_author_name: string
  presenting_author_email: string
  presenting_author_phone: string
  presenting_author_affiliation: string
  amasi_membership_number: string

  // Step 2: Abstract
  title: string
  abstract_text: string
  keywords: string[]

  // Step 3: Co-authors
  authors: Author[]

  // Step 4: Speciality & Category
  category_id: string // This is actually speciality_id (Bariatric, Robotic, etc.)
  presentation_type: string // Category: paper, video, poster
  competition_type: string // best (award) or free (certificate only)

  // Step 5: File or Video URL
  file_url: string
  file_name: string
  file_size: number
  video_url: string
  video_platform: string

  // Step 6: Declarations
  declarations_accepted: boolean
  ethics_confirmed: boolean
  originality_confirmed: boolean
  consent_confirmed: boolean
}

const initialFormData: FormData = {
  presenting_author_name: "",
  presenting_author_email: "",
  presenting_author_phone: "",
  presenting_author_affiliation: "",
  amasi_membership_number: "",
  title: "",
  abstract_text: "",
  keywords: [],
  authors: [],
  category_id: "",
  presentation_type: "paper", // paper, video, poster
  competition_type: "free", // best (award) or free (certificate)
  file_url: "",
  file_name: "",
  file_size: 0,
  video_url: "",
  video_platform: "",
  declarations_accepted: false,
  ethics_confirmed: false,
  originality_confirmed: false,
  consent_confirmed: false,
}

const steps = [
  { id: 1, name: "Author", icon: User },
  { id: 2, name: "Abstract", icon: FileText },
  { id: 3, name: "Co-Authors", icon: Users },
  { id: 4, name: "Speciality", icon: Tag },
  { id: 5, name: "Upload", icon: Upload },
  { id: 6, name: "Submit", icon: CheckSquare },
]

export default function SubmitAbstractPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string

  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)

  const [event, setEvent] = useState<{ name: string; dates: string; venue: string; city: string } | null>(null)
  const [settings, setSettings] = useState<{
    submission_deadline: string
    max_submissions_per_person: number
    max_authors: number
    word_limit: number
    require_registration: boolean
    presentation_types: string[]
    allowed_file_types: string[]
    max_file_size_mb: number
    submission_guidelines: string
    author_guidelines: string
    allow_video_url: boolean
    allowed_video_platforms: string[]
  } | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [submissionStatus, setSubmissionStatus] = useState<string>("open")
  const [statusMessage, setStatusMessage] = useState<string>("")
  const [remainingSubmissions, setRemainingSubmissions] = useState<number | null>(null)

  const [keywordInput, setKeywordInput] = useState("")
  const [showGuidelinesDialog, setShowGuidelinesDialog] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submittedAbstract, setSubmittedAbstract] = useState<{ abstract_number: string; title: string } | null>(null)
  const [uploadMode, setUploadMode] = useState<"file" | "video">("file")

  // Fetch settings and categories
  useEffect(() => {
    fetchSettings()
  }, [eventId])

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (!formData.presenting_author_email || submitted) return

    const interval = setInterval(() => {
      saveDraft()
    }, 30000)

    return () => clearInterval(interval)
  }, [formData, submitted])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const email = formData.presenting_author_email || ""
      const res = await fetch(`/api/submit-abstract/${eventId}?email=${encodeURIComponent(email)}`)

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to load")
      }

      const data = await res.json()
      setEvent(data.event)
      setSettings(data.settings)
      setCategories(data.categories || [])
      setSubmissionStatus(data.submission_status)
      setStatusMessage(data.status_message)
      setRemainingSubmissions(data.remaining_submissions)

      // Load saved draft if exists
      if (data.saved_draft?.draft_data) {
        setFormData(prev => ({ ...prev, ...data.saved_draft.draft_data }))
        toast.info("Draft restored from previous session")
      }
    } catch (error) {
      console.error("Error loading settings:", error)
      toast.error(error instanceof Error ? error.message : "Failed to load submission form")
    } finally {
      setLoading(false)
    }
  }

  const saveDraft = useCallback(async () => {
    if (!formData.presenting_author_email) return

    try {
      setSavingDraft(true)
      await fetch(`/api/submit-abstract/${eventId}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.presenting_author_email,
          draft_data: formData,
        }),
      })
    } catch (error) {
      console.error("Error saving draft:", error)
    } finally {
      setSavingDraft(false)
    }
  }, [eventId, formData])

  const updateFormData = (field: keyof FormData, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const addKeyword = () => {
    if (!keywordInput.trim()) return
    if (formData.keywords.length >= 5) {
      toast.error("Maximum 5 keywords allowed")
      return
    }
    if (!formData.keywords.includes(keywordInput.trim())) {
      updateFormData("keywords", [...formData.keywords, keywordInput.trim()])
    }
    setKeywordInput("")
  }

  const removeKeyword = (keyword: string) => {
    updateFormData("keywords", formData.keywords.filter(k => k !== keyword))
  }

  const addAuthor = () => {
    if (settings?.max_authors && formData.authors.length >= settings.max_authors - 1) {
      toast.error(`Maximum ${settings.max_authors} authors allowed`)
      return
    }
    updateFormData("authors", [
      ...formData.authors,
      { name: "", email: "", affiliation: "", is_presenting: false },
    ])
  }

  const updateAuthor = (index: number, field: keyof Author, value: string | boolean) => {
    const updated = [...formData.authors]
    updated[index] = { ...updated[index], [field]: value }
    updateFormData("authors", updated)
  }

  const removeAuthor = (index: number) => {
    updateFormData("authors", formData.authors.filter((_, i) => i !== index))
  }

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.presenting_author_name.trim()) {
          toast.error("Please enter your name")
          return false
        }
        if (!formData.presenting_author_email.trim()) {
          toast.error("Please enter your email")
          return false
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.presenting_author_email)) {
          toast.error("Please enter a valid email")
          return false
        }
        return true

      case 2:
        if (!formData.title.trim()) {
          toast.error("Please enter abstract title")
          return false
        }
        if (!formData.abstract_text.trim()) {
          toast.error("Please enter abstract text")
          return false
        }
        if (settings?.word_limit) {
          const wordCount = formData.abstract_text.trim().split(/\s+/).length
          if (wordCount > settings.word_limit) {
            toast.error(`Abstract exceeds ${settings.word_limit} word limit`)
            return false
          }
        }
        if (formData.keywords.length < 3) {
          toast.error("Please add at least 3 keywords")
          return false
        }
        return true

      case 3:
        // Co-authors are optional
        for (let i = 0; i < formData.authors.length; i++) {
          if (!formData.authors[i].name.trim()) {
            toast.error(`Please enter name for author ${i + 2}`)
            return false
          }
        }
        return true

      case 4:
        if (!formData.category_id) {
          toast.error("Please select a speciality")
          return false
        }
        if (!formData.presentation_type) {
          toast.error("Please select a category (Paper/Video/Poster)")
          return false
        }
        if (!formData.competition_type) {
          toast.error("Please select competition type (Best or Free)")
          return false
        }
        return true

      case 5:
        // File is REQUIRED for Best category submissions (full manuscript)
        if (formData.competition_type === "best" && !formData.file_url && !formData.video_url) {
          toast.error("Full manuscript/video is required for Best category submissions")
          return false
        }
        return true

      case 6:
        if (!formData.ethics_confirmed || !formData.originality_confirmed || !formData.consent_confirmed) {
          toast.error("Please confirm all declarations")
          return false
        }
        if (!formData.declarations_accepted) {
          toast.error("Please accept the terms to submit")
          return false
        }
        return true

      default:
        return true
    }
  }

  const goToStep = (step: number) => {
    if (step < currentStep || validateStep(currentStep)) {
      setCurrentStep(step)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 6) {
        setCurrentStep(currentStep + 1)
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const handleSubmit = async () => {
    if (!validateStep(6)) return

    try {
      setSubmitting(true)

      const res = await fetch(`/api/submit-abstract/${eventId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Submission failed")
      }

      const result = await res.json()
      setSubmittedAbstract(result.abstract)
      setSubmitted(true)
      toast.success("Abstract submitted successfully!")
    } catch (error) {
      console.error("Submission error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to submit")
    } finally {
      setSubmitting(false)
    }
  }

  const wordCount = formData.abstract_text.trim().split(/\s+/).filter(Boolean).length

  // Video URL validation and platform detection
  const videoUrlPatterns: Record<string, RegExp> = {
    youtube: /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+/i,
    vimeo: /^(https?:\/\/)?(www\.)?vimeo\.com\/\d+/i,
    google_drive: /^(https?:\/\/)?(drive\.google\.com\/(file\/d\/|open\?id=)|docs\.google\.com\/)/i,
    dropbox: /^(https?:\/\/)?(www\.)?dropbox\.com\/(s\/|sh\/)/i,
  }

  const detectVideoPlatform = (url: string): string | null => {
    for (const [platform, pattern] of Object.entries(videoUrlPatterns)) {
      if (pattern.test(url)) {
        return platform
      }
    }
    return null
  }

  const validateVideoUrl = (url: string): { valid: boolean; platform: string | null; error?: string } => {
    if (!url.trim()) {
      return { valid: false, platform: null, error: "Please enter a video URL" }
    }

    const platform = detectVideoPlatform(url)
    if (!platform) {
      return { valid: false, platform: null, error: "Please enter a valid YouTube, Vimeo, Google Drive, or Dropbox URL" }
    }

    const allowedPlatforms = settings?.allowed_video_platforms || ["youtube", "vimeo"]
    if (!allowedPlatforms.includes(platform)) {
      const platformNames: Record<string, string> = {
        youtube: "YouTube",
        vimeo: "Vimeo",
        google_drive: "Google Drive",
        dropbox: "Dropbox",
      }
      return {
        valid: false,
        platform,
        error: `${platformNames[platform]} is not allowed. Allowed platforms: ${allowedPlatforms.map(p => platformNames[p]).join(", ")}`,
      }
    }

    return { valid: true, platform }
  }

  const handleVideoUrlChange = (url: string) => {
    updateFormData("video_url", url)
    const detection = detectVideoPlatform(url)
    updateFormData("video_platform", detection || "")
  }

  const getVideoPlatformInfo = (platform: string) => {
    const platformInfo: Record<string, { name: string; icon: string; color: string }> = {
      youtube: { name: "YouTube", icon: "🎬", color: "text-red-500" },
      vimeo: { name: "Vimeo", icon: "▶️", color: "text-blue-500" },
      google_drive: { name: "Google Drive", icon: "📁", color: "text-yellow-500" },
      dropbox: { name: "Dropbox", icon: "📦", color: "text-blue-600" },
    }
    return platformInfo[platform] || { name: platform, icon: "🔗", color: "text-gray-500" }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (submissionStatus !== "open") {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container max-w-2xl mx-auto px-4">
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Submissions {submissionStatus === "closed" ? "Closed" : "Not Yet Open"}</h2>
              <p className="text-muted-foreground mb-6">{statusMessage}</p>
              {event && (
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium">{event.name}</p>
                  <p>{event.dates}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (submitted && submittedAbstract) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container max-w-2xl mx-auto px-4">
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Abstract Submitted Successfully!</h2>
              <p className="text-muted-foreground mb-6">
                Your abstract has been received and is under review.
              </p>

              <div className="bg-gray-100 rounded-lg p-6 text-left mb-6">
                <div className="grid gap-3">
                  <div>
                    <span className="text-sm text-muted-foreground">Abstract Number</span>
                    <p className="font-mono font-bold text-lg">{submittedAbstract.abstract_number}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Title</span>
                    <p className="font-medium">{submittedAbstract.title}</p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-6">
                A confirmation email has been sent to <strong>{formData.presenting_author_email}</strong>
              </p>

              <div className="flex gap-4 justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFormData(initialFormData)
                    setSubmitted(false)
                    setSubmittedAbstract(null)
                    setCurrentStep(1)
                  }}
                >
                  Submit Another Abstract
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Submit Abstract</h1>
          {event && (
            <div className="text-muted-foreground">
              <p className="font-medium text-lg">{event.name}</p>
              <div className="flex items-center justify-center gap-4 mt-2 text-sm">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {event.dates}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {event.venue}, {event.city}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Deadline Banner */}
        {settings?.submission_deadline && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <Clock className="h-5 w-5 text-yellow-600" />
            <div>
              <span className="font-medium text-yellow-800">Submission Deadline: </span>
              <span className="text-yellow-700">
                {new Date(settings.submission_deadline).toLocaleDateString('en-IN', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        )}

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = currentStep === step.id
              const isCompleted = currentStep > step.id

              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => goToStep(step.id)}
                    className={`flex flex-col items-center ${
                      isActive ? "text-primary" : isCompleted ? "text-green-600" : "text-muted-foreground"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 ${
                        isActive
                          ? "bg-primary text-white"
                          : isCompleted
                          ? "bg-green-100 text-green-600"
                          : "bg-gray-100"
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <span className="text-xs hidden sm:block">{step.name}</span>
                  </button>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-12 sm:w-20 h-1 mx-2 ${
                        currentStep > step.id ? "bg-green-400" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
          <Progress value={(currentStep / 6) * 100} className="h-2" />
        </div>

        {/* Auto-save indicator */}
        {savingDraft && (
          <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg px-4 py-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving draft...
          </div>
        )}

        {/* Form Steps */}
        <Card>
          <CardContent className="pt-6">
            {/* Step 1: Author Information */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Presenting Author Information</h2>
                  <p className="text-sm text-muted-foreground">
                    Enter the details of the presenting author
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      placeholder="Dr. John Smith"
                      value={formData.presenting_author_name}
                      onChange={(e) => updateFormData("presenting_author_name", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john.smith@hospital.org"
                      value={formData.presenting_author_email}
                      onChange={(e) => updateFormData("presenting_author_email", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      placeholder="+91 98765 43210"
                      value={formData.presenting_author_phone}
                      onChange={(e) => updateFormData("presenting_author_phone", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="affiliation">Institution / Affiliation *</Label>
                    <Input
                      id="affiliation"
                      placeholder="ABC Medical College & Hospital"
                      value={formData.presenting_author_affiliation}
                      onChange={(e) => updateFormData("presenting_author_affiliation", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="membership">AMASI Membership Number (if applicable)</Label>
                    <Input
                      id="membership"
                      placeholder="AMASI-XXXX"
                      value={formData.amasi_membership_number}
                      onChange={(e) => updateFormData("amasi_membership_number", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      AMASI members may be eligible for reduced submission fees
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Abstract Content */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Abstract Content</h2>
                  <p className="text-sm text-muted-foreground">
                    Enter your abstract title and content
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Abstract Title *</Label>
                    <Input
                      id="title"
                      placeholder="Enter your abstract title"
                      value={formData.title}
                      onChange={(e) => updateFormData("title", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="abstract">Abstract Text *</Label>
                      <span className={`text-sm ${
                        settings?.word_limit && wordCount > settings.word_limit
                          ? "text-red-500 font-medium"
                          : "text-muted-foreground"
                      }`}>
                        {wordCount} / {settings?.word_limit || 300} words
                      </span>
                    </div>
                    <Textarea
                      id="abstract"
                      placeholder="Enter your abstract text here. Include background, methods, results, and conclusions."
                      value={formData.abstract_text}
                      onChange={(e) => updateFormData("abstract_text", e.target.value)}
                      rows={12}
                      className="resize-none"
                    />
                    {settings?.submission_guidelines && (
                      <Button
                        variant="link"
                        className="p-0 h-auto text-sm"
                        onClick={() => setShowGuidelinesDialog(true)}
                      >
                        <Info className="h-4 w-4 mr-1" />
                        View submission guidelines
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Keywords * (3-5 keywords)</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a keyword"
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            addKeyword()
                          }
                        }}
                      />
                      <Button type="button" onClick={addKeyword} variant="outline">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.keywords.map((keyword) => (
                        <Badge key={keyword} variant="secondary" className="px-3 py-1">
                          {keyword}
                          <button
                            type="button"
                            onClick={() => removeKeyword(keyword)}
                            className="ml-2 hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Co-Authors */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Co-Authors</h2>
                  <p className="text-sm text-muted-foreground">
                    Add co-authors if applicable (maximum {settings?.max_authors || 10} total authors)
                  </p>
                </div>

                {/* Presenting author preview */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge>1st Author (Presenting)</Badge>
                  </div>
                  <p className="font-medium">{formData.presenting_author_name}</p>
                  <p className="text-sm text-muted-foreground">{formData.presenting_author_affiliation}</p>
                </div>

                {/* Co-authors list */}
                <div className="space-y-4">
                  {formData.authors.map((author, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <Badge variant="outline">Author {index + 2}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAuthor(index)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Name *</Label>
                          <Input
                            placeholder="Dr. Jane Doe"
                            value={author.name}
                            onChange={(e) => updateAuthor(index, "name", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            type="email"
                            placeholder="jane.doe@hospital.org"
                            value={author.email}
                            onChange={(e) => updateAuthor(index, "email", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label>Affiliation</Label>
                          <Input
                            placeholder="Institution name"
                            value={author.affiliation}
                            onChange={(e) => updateAuthor(index, "affiliation", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addAuthor}
                    className="w-full"
                    disabled={settings?.max_authors ? formData.authors.length >= settings.max_authors - 1 : false}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Co-Author
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Speciality, Category & Competition Type */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Speciality & Category</h2>
                  <p className="text-sm text-muted-foreground">
                    Select your speciality, presentation category, and competition type
                  </p>
                </div>

                <div className="space-y-6">
                  {/* Speciality Selection */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">1. Select Speciality *</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Choose the medical speciality that best fits your abstract
                    </p>
                    <RadioGroup
                      value={formData.category_id}
                      onValueChange={(value) => updateFormData("category_id", value)}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {categories.map((category) => (
                          <div
                            key={category.id}
                            className={`flex items-center space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                              formData.category_id === category.id ? "border-primary bg-primary/5 ring-1 ring-primary" : ""
                            }`}
                            onClick={() => updateFormData("category_id", category.id)}
                          >
                            <RadioGroupItem value={category.id} id={category.id} />
                            <Label htmlFor={category.id} className="cursor-pointer font-medium flex-1">
                              {category.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                  </div>

                  <Separator />

                  {/* Category Selection (Paper/Video/Poster) */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">2. Select Category *</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Choose how you want to present your work
                    </p>
                    <RadioGroup
                      value={formData.presentation_type}
                      onValueChange={(value) => updateFormData("presentation_type", value)}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div
                          className={`flex flex-col items-center justify-center border rounded-xl p-6 cursor-pointer hover:bg-gray-50 transition-all ${
                            formData.presentation_type === "paper" ? "border-primary bg-primary/5 ring-2 ring-primary" : ""
                          }`}
                          onClick={() => updateFormData("presentation_type", "paper")}
                        >
                          <RadioGroupItem value="paper" id="paper" className="sr-only" />
                          <FileText className="h-10 w-10 mb-3 text-blue-600" />
                          <Label htmlFor="paper" className="cursor-pointer font-semibold text-lg">
                            Paper
                          </Label>
                          <p className="text-sm text-muted-foreground text-center mt-1">
                            Oral presentation (7-10 min)
                          </p>
                        </div>

                        <div
                          className={`flex flex-col items-center justify-center border rounded-xl p-6 cursor-pointer hover:bg-gray-50 transition-all ${
                            formData.presentation_type === "video" ? "border-primary bg-primary/5 ring-2 ring-primary" : ""
                          }`}
                          onClick={() => updateFormData("presentation_type", "video")}
                        >
                          <RadioGroupItem value="video" id="video" className="sr-only" />
                          <Video className="h-10 w-10 mb-3 text-red-600" />
                          <Label htmlFor="video" className="cursor-pointer font-semibold text-lg">
                            Video
                          </Label>
                          <p className="text-sm text-muted-foreground text-center mt-1">
                            Pre-recorded video (max 10 min)
                          </p>
                        </div>

                        <div
                          className={`flex flex-col items-center justify-center border rounded-xl p-6 cursor-pointer hover:bg-gray-50 transition-all ${
                            formData.presentation_type === "poster" ? "border-primary bg-primary/5 ring-2 ring-primary" : ""
                          }`}
                          onClick={() => updateFormData("presentation_type", "poster")}
                        >
                          <RadioGroupItem value="poster" id="poster" className="sr-only" />
                          <MapPin className="h-10 w-10 mb-3 text-green-600" />
                          <Label htmlFor="poster" className="cursor-pointer font-semibold text-lg">
                            Poster
                          </Label>
                          <p className="text-sm text-muted-foreground text-center mt-1">
                            Poster display session
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  <Separator />

                  {/* Competition Type Selection (Best/Free) */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">3. Competition Type *</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Are you submitting for the Best Award competition or just for presentation?
                    </p>
                    <RadioGroup
                      value={formData.competition_type}
                      onValueChange={(value) => updateFormData("competition_type", value)}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div
                          className={`flex items-start space-x-3 border rounded-xl p-5 cursor-pointer hover:bg-gray-50 transition-all ${
                            formData.competition_type === "best" ? "border-yellow-500 bg-yellow-50 ring-2 ring-yellow-500" : ""
                          }`}
                          onClick={() => updateFormData("competition_type", "best")}
                        >
                          <RadioGroupItem value="best" id="best" className="mt-1" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Label htmlFor="best" className="cursor-pointer font-semibold text-lg">
                                Best {formData.presentation_type === "paper" ? "Paper" : formData.presentation_type === "video" ? "Video" : "Poster"}
                              </Label>
                              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                                Award Competition
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">
                              Compete for the Best {formData.presentation_type === "paper" ? "Paper" : formData.presentation_type === "video" ? "Video" : "Poster"} Award. Your abstract will be judged and ranked.
                            </p>
                          </div>
                        </div>

                        <div
                          className={`flex items-start space-x-3 border rounded-xl p-5 cursor-pointer hover:bg-gray-50 transition-all ${
                            formData.competition_type === "free" ? "border-primary bg-primary/5 ring-2 ring-primary" : ""
                          }`}
                          onClick={() => updateFormData("competition_type", "free")}
                        >
                          <RadioGroupItem value="free" id="free" className="mt-1" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Label htmlFor="free" className="cursor-pointer font-semibold text-lg">
                                Free {formData.presentation_type === "paper" ? "Paper" : formData.presentation_type === "video" ? "Video" : "Poster"}
                              </Label>
                              <Badge variant="outline">
                                Certificate Only
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">
                              Present your work and receive a participation certificate. Not competing for awards.
                            </p>
                          </div>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: File Upload or Video URL */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-1">
                    {formData.competition_type === "best" ? "Upload Manuscript/Video *" : "Supporting Documents"}
                  </h2>
                  {formData.competition_type === "best" ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
                      <p className="text-sm text-yellow-800 font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Full manuscript/video is REQUIRED for Best {formData.presentation_type} submissions
                      </p>
                      <p className="text-xs text-yellow-700 mt-1">
                        Please upload your complete manuscript (PDF) or video for the award competition.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Upload a file or provide a video link (optional for Free category)
                    </p>
                  )}
                </div>

                {/* Upload Mode Toggle - only show if video URLs are allowed */}
                {settings?.allow_video_url && (
                  <div className="flex rounded-lg border p-1 bg-gray-50 w-fit">
                    <button
                      type="button"
                      onClick={() => setUploadMode("file")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        uploadMode === "file"
                          ? "bg-white text-primary shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Upload className="h-4 w-4" />
                      Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode("video")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        uploadMode === "video"
                          ? "bg-white text-primary shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Video className="h-4 w-4" />
                      Video URL
                    </button>
                  </div>
                )}

                {/* File Upload Section */}
                {uploadMode === "file" && (
                  <>
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-2">
                        Drag and drop your file here, or click to browse
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        Accepted formats: {settings?.allowed_file_types?.join(", ").toUpperCase() || "PDF"}
                        (Max {settings?.max_file_size_mb || 5}MB)
                      </p>
                      <Input
                        type="file"
                        className="hidden"
                        id="file-upload"
                        accept={settings?.allowed_file_types?.map(t => `.${t}`).join(",") || ".pdf"}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return

                          // Validate file size
                          const maxSize = (settings?.max_file_size_mb || 5) * 1024 * 1024
                          if (file.size > maxSize) {
                            toast.error(`File size exceeds ${settings?.max_file_size_mb || 5}MB limit`)
                            return
                          }

                          // Clear video URL if switching to file
                          updateFormData("video_url", "")
                          updateFormData("video_platform", "")

                          // TODO: Upload to storage
                          toast.info("File upload functionality - integrate with Supabase Storage")
                          updateFormData("file_name", file.name)
                          updateFormData("file_size", file.size)
                        }}
                      />
                      <Button variant="outline" onClick={() => document.getElementById("file-upload")?.click()}>
                        Select File
                      </Button>
                    </div>

                    {formData.file_name && (
                      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <FileText className="h-8 w-8 text-primary" />
                          <div>
                            <p className="font-medium">{formData.file_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {(formData.file_size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            updateFormData("file_url", "")
                            updateFormData("file_name", "")
                            updateFormData("file_size", 0)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {/* Video URL Section */}
                {uploadMode === "video" && settings?.allow_video_url && (
                  <>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="video-url">Video URL</Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="video-url"
                              placeholder="https://www.youtube.com/watch?v=..."
                              value={formData.video_url}
                              onChange={(e) => handleVideoUrlChange(e.target.value)}
                              className="pl-10"
                            />
                          </div>
                          {formData.video_url && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => window.open(formData.video_url, "_blank")}
                              title="Open video in new tab"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Allowed platforms info */}
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs text-muted-foreground">Supported platforms:</span>
                        {(settings.allowed_video_platforms || ["youtube", "vimeo"]).map((platform) => {
                          const info = getVideoPlatformInfo(platform)
                          return (
                            <Badge key={platform} variant="secondary" className="text-xs">
                              {info.icon} {info.name}
                            </Badge>
                          )
                        })}
                      </div>

                      {/* Show detected platform */}
                      {formData.video_url && (
                        <div className="space-y-2">
                          {(() => {
                            const validation = validateVideoUrl(formData.video_url)
                            if (validation.valid && validation.platform) {
                              const info = getVideoPlatformInfo(validation.platform)
                              return (
                                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                                  <span className="text-sm text-green-800">
                                    {info.icon} {info.name} video detected
                                  </span>
                                </div>
                              )
                            } else if (validation.error) {
                              return (
                                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                  <AlertTriangle className="h-5 w-5 text-red-600" />
                                  <span className="text-sm text-red-800">{validation.error}</span>
                                </div>
                              )
                            }
                            return null
                          })()}
                        </div>
                      )}

                      {/* Video preview for YouTube */}
                      {formData.video_platform === "youtube" && formData.video_url && (
                        <div className="mt-4">
                          <Label className="text-sm text-muted-foreground mb-2 block">Preview</Label>
                          <div className="aspect-video rounded-lg overflow-hidden bg-black">
                            <iframe
                              width="100%"
                              height="100%"
                              src={formData.video_url
                                .replace("watch?v=", "embed/")
                                .replace("youtu.be/", "youtube.com/embed/")
                                .split("&")[0]}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              className="border-0"
                            />
                          </div>
                        </div>
                      )}

                      {/* Clear video URL */}
                      {formData.video_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            updateFormData("video_url", "")
                            updateFormData("video_platform", "")
                          }}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Clear Video URL
                        </Button>
                      )}
                    </div>
                  </>
                )}

                <p className="text-sm text-muted-foreground">
                  You can skip this step and add supporting materials later if needed.
                </p>
              </div>
            )}

            {/* Step 6: Declarations & Submit */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Declarations & Submit</h2>
                  <p className="text-sm text-muted-foreground">
                    Review your submission and confirm the declarations
                  </p>
                </div>

                {/* Summary */}
                <Accordion type="single" collapsible defaultValue="summary">
                  <AccordionItem value="summary">
                    <AccordionTrigger>Review Your Submission</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Title:</span>
                          <p className="font-medium">{formData.title}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Presenting Author:</span>
                          <p className="font-medium">{formData.presenting_author_name}</p>
                          <p className="text-muted-foreground">{formData.presenting_author_email}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Speciality:</span>
                          <p className="font-medium">
                            {categories.find(c => c.id === formData.category_id)?.name}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Category:</span>
                          <p className="font-medium capitalize">{formData.presentation_type}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Competition Type:</span>
                          <p className="font-medium">
                            {formData.competition_type === "best" ? (
                              <Badge className="bg-yellow-100 text-yellow-800">Best {formData.presentation_type} (Award Competition)</Badge>
                            ) : (
                              <Badge variant="outline">Free {formData.presentation_type} (Certificate Only)</Badge>
                            )}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Authors:</span>
                          <p className="font-medium">
                            {formData.presenting_author_name}
                            {formData.authors.length > 0 && `, ${formData.authors.map(a => a.name).join(", ")}`}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Keywords:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {formData.keywords.map(k => (
                              <Badge key={k} variant="secondary" className="text-xs">{k}</Badge>
                            ))}
                          </div>
                        </div>
                        {(formData.file_name || formData.video_url) && (
                          <div>
                            <span className="text-muted-foreground">Attachment:</span>
                            {formData.file_name ? (
                              <div className="flex items-center gap-2 mt-1">
                                <FileText className="h-4 w-4 text-primary" />
                                <span className="font-medium">{formData.file_name}</span>
                              </div>
                            ) : formData.video_url ? (
                              <div className="flex items-center gap-2 mt-1">
                                <Video className="h-4 w-4 text-primary" />
                                <span className="font-medium">
                                  {getVideoPlatformInfo(formData.video_platform).name} Video
                                </span>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Declarations */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Declarations</h3>

                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="ethics"
                        checked={formData.ethics_confirmed}
                        onCheckedChange={(checked) => updateFormData("ethics_confirmed", checked)}
                      />
                      <Label htmlFor="ethics" className="text-sm leading-relaxed cursor-pointer">
                        I confirm that this research was conducted in accordance with ethical standards
                        and has received appropriate ethical approval where required.
                      </Label>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="originality"
                        checked={formData.originality_confirmed}
                        onCheckedChange={(checked) => updateFormData("originality_confirmed", checked)}
                      />
                      <Label htmlFor="originality" className="text-sm leading-relaxed cursor-pointer">
                        I confirm that this abstract is original work and has not been previously
                        published or is not under consideration for publication elsewhere.
                      </Label>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="consent"
                        checked={formData.consent_confirmed}
                        onCheckedChange={(checked) => updateFormData("consent_confirmed", checked)}
                      />
                      <Label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
                        I confirm that all co-authors have reviewed and approved this submission,
                        and consent to their names being included.
                      </Label>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-start space-x-3 bg-primary/5 p-4 rounded-lg">
                    <Checkbox
                      id="declarations"
                      checked={formData.declarations_accepted}
                      onCheckedChange={(checked) => updateFormData("declarations_accepted", checked)}
                    />
                    <Label htmlFor="declarations" className="text-sm leading-relaxed cursor-pointer">
                      <span className="font-medium">I accept all the above declarations</span> and understand
                      that providing false information may result in rejection of my abstract and potential
                      disqualification from future submissions.
                    </Label>
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          {/* Navigation */}
          <CardFooter className="flex justify-between border-t pt-6">
            <div>
              {currentStep > 1 && (
                <Button variant="outline" onClick={prevStep}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={saveDraft}
                disabled={!formData.presenting_author_email || savingDraft}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>

              {currentStep < 6 ? (
                <Button onClick={nextStep}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !formData.declarations_accepted}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Submit Abstract
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>

        {/* Remaining submissions notice */}
        {remainingSubmissions !== null && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            You can submit {remainingSubmissions} more abstract{remainingSubmissions !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Guidelines Dialog */}
      <AlertDialog open={showGuidelinesDialog} onOpenChange={setShowGuidelinesDialog}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Submission Guidelines</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-left whitespace-pre-wrap">
                {settings?.submission_guidelines || "No guidelines available."}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
