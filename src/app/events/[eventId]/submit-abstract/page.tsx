"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
  User,
  Mail,
  Plus,
  X,
  Clock,
  BookOpen,
  Upload,
  Video,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Category {
  id: string
  name: string
  description: string | null
  max_submissions: number | null
}

interface AbstractSettings {
  submission_opens_at: string | null
  submission_deadline: string | null
  max_submissions_per_person: number
  max_authors: number
  word_limit: number
  require_registration: boolean
  presentation_types: string[]
  submission_guidelines: string | null
  author_guidelines: string | null
  allowed_file_types: string[]
  max_file_size_mb: number
}

interface CoAuthor {
  name: string
  email: string
  affiliation: string
  is_presenting: boolean
}

export default function SubmitAbstractPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const [step, setStep] = useState<"lookup" | "form" | "success">("lookup")
  const [email, setEmail] = useState("")
  const [registrationInfo, setRegistrationInfo] = useState<any>(null)
  const [lookupError, setLookupError] = useState("")
  const [lookupLoading, setLookupLoading] = useState(false)

  // Form state
  const [title, setTitle] = useState("")
  const [abstractText, setAbstractText] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [presentationType, setPresentationType] = useState("either")
  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState("")
  const [affiliation, setAffiliation] = useState("")
  const [phone, setPhone] = useState("")
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>([])
  const [submittedAbstract, setSubmittedAbstract] = useState<any>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileUploading, setFileUploading] = useState(false)
  const [fileUrl, setFileUrl] = useState("")
  const [fileError, setFileError] = useState("")

  // Fetch event details
  const { data: event } = useQuery({
    queryKey: ["event-public", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/public`)
      if (!res.ok) return null
      return res.json()
    },
  })

  // Fetch module settings
  const { data: moduleSettings, isLoading: moduleLoading } = useQuery({
    queryKey: ["event-module-settings-public", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/event-settings?event_id=${eventId}`)
      if (!res.ok) return null
      return res.json()
    },
  })

  // Fetch abstract settings
  const { data: settings, isLoading: _settingsLoading } = useQuery({
    queryKey: ["abstract-settings-public", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/abstract-settings/${eventId}`)
      if (!res.ok) return null
      return res.json() as Promise<AbstractSettings>
    },
  })

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["abstract-categories-public", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/abstract-categories?event_id=${eventId}&active_only=true`)
      if (!res.ok) return []
      return res.json() as Promise<Category[]>
    },
  })

  // Check submission status
  const isOpen = () => {
    if (!settings) return false
    const now = new Date()
    if (settings.submission_opens_at && new Date(settings.submission_opens_at) > now) return false
    if (settings.submission_deadline && new Date(settings.submission_deadline) < now) return false
    return true
  }

  // Email format validation
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  // Registration lookup
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    if (!isValidEmail(email.trim())) {
      setLookupError("Please enter a valid email address")
      return
    }

    setLookupLoading(true)
    setLookupError("")

    try {
      // Check registration
      const res = await fetch(`/api/my?q=${encodeURIComponent(email.trim().toLowerCase())}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Registration not found")
      }

      // Find registration for this event
      const registration = data.registrations?.find((r: any) => r.event?.id === eventId && r.status === "confirmed")

      if (!registration) {
        if (settings?.require_registration) {
          throw new Error("No confirmed registration found for this event. Please register first.")
        }
        // Allow submission without registration
        setRegistrationInfo({
          attendee_name: "",
          attendee_email: email.trim().toLowerCase(),
        })
      } else {
        setRegistrationInfo(registration)
        setAffiliation(registration.attendee_institution || "")
        setPhone(registration.attendee_phone || "")
      }

      setStep("form")
    } catch (err: any) {
      setLookupError(err.message)
    } finally {
      setLookupLoading(false)
    }
  }

  // Validate form before submission
  const validateForm = (): string | null => {
    if (!title.trim()) return "Title is required"
    if (!abstractText.trim()) return "Abstract text is required"
    if (wordCount > (settings?.word_limit || 300)) return "Abstract exceeds word limit"
    if (categories.length > 0 && !categoryId) return "Please select a category"
    // Validate co-authors have required name field
    for (let i = 0; i < coAuthors.length; i++) {
      if (!coAuthors[i].name.trim()) {
        return `Co-author ${i + 1}: Name is required`
      }
      if (coAuthors[i].email && !isValidEmail(coAuthors[i].email)) {
        return `Co-author ${i + 1}: Invalid email format`
      }
    }
    return null
  }

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const validationError = validateForm()
      if (validationError) throw new Error(validationError)

      const res = await fetch("/api/abstracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          registration_id: registrationInfo?.id || null,
          category_id: categoryId || null,
          title,
          abstract_text: abstractText,
          keywords,
          presentation_type: presentationType,
          presenting_author_name: registrationInfo?.attendee_name || "",
          presenting_author_email: registrationInfo?.attendee_email || email,
          presenting_author_affiliation: affiliation,
          presenting_author_phone: phone,
          authors: coAuthors,
          file_url: fileUrl || null,
          file_name: file?.name || null,
          file_size: file?.size || null,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to submit abstract")
      }

      return res.json()
    },
    onSuccess: (data) => {
      setSubmittedAbstract(data)
      setStep("success")
    },
  })

  const addKeyword = () => {
    const kw = keywordInput.trim()
    if (kw && !keywords.includes(kw) && keywords.length < 5) {
      setKeywords([...keywords, kw])
      setKeywordInput("")
    }
  }

  const addCoAuthor = () => {
    if (coAuthors.length < (settings?.max_authors || 10) - 1) {
      setCoAuthors([...coAuthors, { name: "", email: "", affiliation: "", is_presenting: false }])
    }
  }

  const updateCoAuthor = (index: number, field: keyof CoAuthor, value: any) => {
    const updated = [...coAuthors]
    updated[index] = { ...updated[index], [field]: value }
    setCoAuthors(updated)
  }

  const removeCoAuthor = (index: number) => {
    setCoAuthors(coAuthors.filter((_, i) => i !== index))
  }

  const wordCount = abstractText.trim().split(/\s+/).filter(Boolean).length

  // Check if selected category requires video
  const selectedCategory = categories.find(c => c.id === categoryId)
  const isVideoCategory = selectedCategory?.name?.toLowerCase().includes('video')

  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFileError("")

    // Validate file type
    const allowedTypes = settings?.allowed_file_types || ['pdf', 'mp4', 'mov', 'jpg', 'jpeg']
    const fileExt = selectedFile.name.split('.').pop()?.toLowerCase()
    if (!fileExt || !allowedTypes.includes(fileExt)) {
      setFileError(`Invalid file type. Allowed: ${allowedTypes.join(', ').toUpperCase()}`)
      return
    }

    // Validate file size
    const maxSize = (settings?.max_file_size_mb || 300) * 1024 * 1024
    if (selectedFile.size > maxSize) {
      setFileError(`File too large. Maximum size: ${settings?.max_file_size_mb || 300} MB`)
      return
    }

    setFile(selectedFile)
    setFileUploading(true)

    try {
      // Upload to Supabase storage
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('event_id', eventId)
      formData.append('type', 'abstract')

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Upload failed')
      }

      const data = await res.json()
      setFileUrl(data.url)
    } catch (err: any) {
      setFileError(err.message || 'Failed to upload file')
      setFile(null)
    } finally {
      setFileUploading(false)
    }
  }

  const removeFile = () => {
    setFile(null)
    setFileUrl("")
    setFileError("")
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  // Check if module is enabled
  if (!moduleLoading && !moduleSettings?.enable_abstracts) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">Submissions Not Available</h2>
          <p className="text-muted-foreground">
            Abstract submissions are not enabled for this event.
          </p>
        </div>
      </div>
    )
  }

  // Check if submissions are open
  if (settings && !isOpen()) {
    const now = new Date()
    const opens = settings.submission_opens_at ? new Date(settings.submission_opens_at) : null
    const closes = settings.submission_deadline ? new Date(settings.submission_deadline) : null

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <Clock className="h-12 w-12 mx-auto text-amber-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">
            {opens && now < opens ? "Submissions Not Yet Open" : "Submission Deadline Passed"}
          </h2>
          {opens && now < opens && (
            <p className="text-muted-foreground">
              Submissions open on {formatDate(settings.submission_opens_at!)}
            </p>
          )}
          {closes && now > closes && (
            <p className="text-muted-foreground">
              The deadline was {formatDate(settings.submission_deadline!)}
            </p>
          )}
        </div>
      </div>
    )
  }

  // Success Step
  if (step === "success" && submittedAbstract) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg text-center">
          <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-6" />
          <h2 className="text-2xl font-bold mb-2">Abstract Submitted!</h2>
          <p className="text-muted-foreground mb-6">
            Your abstract has been received and is pending review.
          </p>

          <div className="bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-xl p-6 mb-6">
            <p className="text-xs text-indigo-600 font-medium mb-1">YOUR ABSTRACT NUMBER</p>
            <p className="text-3xl font-mono font-bold text-indigo-700">
              {submittedAbstract.abstract_number}
            </p>
          </div>

          <div className="text-left bg-gray-50 rounded-xl p-4 mb-6">
            <h3 className="font-semibold mb-2">{submittedAbstract.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {submittedAbstract.abstract_text}
            </p>
          </div>

          <p className="text-sm text-muted-foreground mb-6">
            A confirmation email has been sent to {submittedAbstract.presenting_author_email}.
            You can track your submission status in the delegate portal.
          </p>

          <div className="flex gap-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setStep("lookup")
                setTitle("")
                setAbstractText("")
                setCategoryId("")
                setKeywords([])
                setCoAuthors([])
              }}
            >
              Submit Another
            </Button>
            <Link href="/my" className="flex-1">
              <Button className="w-full">View My Submissions</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Lookup Step
  if (step === "lookup") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Submit Abstract</h1>
            <p className="text-white/70">{event?.name || "Conference"}</p>
          </div>

          {/* Deadline Info */}
          {settings?.submission_deadline && (
            <div className="bg-white/10 backdrop-blur rounded-xl p-4 mb-6 text-center">
              <p className="text-white/70 text-sm">Submission Deadline</p>
              <p className="text-white font-semibold">{formatDate(settings.submission_deadline)}</p>
            </div>
          )}

          {/* Lookup Form */}
          <form onSubmit={handleLookup} className="bg-white rounded-2xl shadow-2xl p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter your registered email address
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              className="text-center text-lg py-6 mb-4"
              required
            />

            {lookupError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {lookupError}
              </div>
            )}

            <Button
              type="submit"
              disabled={lookupLoading || !email.trim()}
              className="w-full py-6 text-lg"
            >
              {lookupLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Looking up...
                </>
              ) : (
                "Continue"
              )}
            </Button>

            {!settings?.require_registration && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                Registration is optional but recommended
              </p>
            )}
          </form>
        </div>
      </div>
    )
  }

  // Form Step
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white mb-6">
          <h1 className="text-2xl font-bold mb-1">Submit Abstract</h1>
          <p className="text-white/80">{event?.name}</p>
          <div className="flex items-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {registrationInfo?.attendee_name || "Guest"}
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {registrationInfo?.attendee_email || email}
            </div>
          </div>
        </div>

        {/* Guidelines */}
        {settings?.submission_guidelines && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-blue-800 mb-2">Submission Guidelines</h3>
            <p className="text-sm text-blue-700 whitespace-pre-wrap">{settings.submission_guidelines}</p>
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submitMutation.mutate()
          }}
          className="space-y-6"
        >
          {/* Title */}
          <div className="bg-white rounded-xl border p-6">
            <label className="block text-sm font-medium mb-2">
              Abstract Title *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter your abstract title"
              required
            />
          </div>

          {/* Category & Type */}
          <div className="bg-white rounded-xl border p-6 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Presentation Preference</label>
              <Select value={presentationType} onValueChange={setPresentationType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(settings?.presentation_types || ["oral", "poster"]).includes("oral") && (
                    <SelectItem value="oral">Oral Presentation</SelectItem>
                  )}
                  {(settings?.presentation_types || ["oral", "poster"]).includes("poster") && (
                    <SelectItem value="poster">Poster / ePoster</SelectItem>
                  )}
                  {(settings?.presentation_types || []).includes("video") && (
                    <SelectItem value="video">Video Presentation</SelectItem>
                  )}
                  <SelectItem value="either">No Preference</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Abstract Text */}
          <div className="bg-white rounded-xl border p-6">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">Abstract Text *</label>
              <span className={cn(
                "text-sm",
                wordCount > (settings?.word_limit || 300) ? "text-red-600 font-medium" : "text-muted-foreground"
              )}>
                {wordCount} / {settings?.word_limit || 300} words
              </span>
            </div>
            <textarea
              value={abstractText}
              onChange={(e) => setAbstractText(e.target.value)}
              placeholder="Enter your abstract text..."
              rows={10}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {wordCount > (settings?.word_limit || 300) && (
              <p className="text-sm text-red-600 mt-2">
                Your abstract exceeds the word limit
              </p>
            )}
          </div>

          {/* File Upload - for videos and supplementary material */}
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Video className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">
                {isVideoCategory ? "Video Upload *" : "File Attachment (Optional)"}
              </h3>
            </div>

            {isVideoCategory && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
                <strong>Video Category Selected:</strong> Please upload your video file (MP4 format, max {settings?.max_file_size_mb || 300} MB)
              </div>
            )}

            {file ? (
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {file.type.includes('video') ? (
                    <Video className="h-8 w-8 text-indigo-500" />
                  ) : (
                    <FileText className="h-8 w-8 text-indigo-500" />
                  )}
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {fileUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : fileUrl ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeFile}
                    disabled={fileUploading}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ) : (
              <label className="block">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="font-medium mb-1">
                    {isVideoCategory ? "Upload Video" : "Upload File"}
                  </p>
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag & drop or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supported: {(settings?.allowed_file_types || ['pdf', 'mp4', 'jpg']).join(', ').toUpperCase()}
                    (Max {settings?.max_file_size_mb || 300} MB)
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept={(settings?.allowed_file_types || ['pdf', 'mp4', 'mov', 'jpg', 'jpeg']).map(t => `.${t}`).join(',')}
                  onChange={handleFileChange}
                />
              </label>
            )}

            {fileError && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {fileError}
              </p>
            )}
          </div>

          {/* Keywords */}
          <div className="bg-white rounded-xl border p-6">
            <label className="block text-sm font-medium mb-2">Keywords (up to 5)</label>
            <div className="flex gap-2 mb-3 flex-wrap">
              {keywords.map((kw, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm"
                >
                  {kw}
                  <button type="button" onClick={() => setKeywords(keywords.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            {keywords.length < 5 && (
              <div className="flex gap-2">
                <Input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  placeholder="Add keyword"
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                />
                <Button type="button" variant="outline" onClick={addKeyword}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Author Info */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Presenting Author
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <Input
                  value={registrationInfo?.attendee_name || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <Input
                  value={registrationInfo?.attendee_email || email}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Affiliation / Institution</label>
                <Input
                  value={affiliation}
                  onChange={(e) => setAffiliation(e.target.value)}
                  placeholder="Your institution"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Phone</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Contact number"
                />
              </div>
            </div>
          </div>

          {/* Co-Authors */}
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Co-Authors
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCoAuthor}
                disabled={coAuthors.length >= (settings?.max_authors || 10) - 1}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            {settings?.author_guidelines && (
              <p className="text-sm text-muted-foreground mb-4">{settings.author_guidelines}</p>
            )}

            {coAuthors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No co-authors added. Click &quot;Add&quot; to include co-authors.
              </p>
            ) : (
              <div className="space-y-4">
                {coAuthors.map((author, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg relative">
                    <button
                      type="button"
                      onClick={() => removeCoAuthor(index)}
                      className="absolute top-2 right-2 p-1 hover:bg-gray-200 rounded"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="grid grid-cols-3 gap-4 mb-2">
                      <Input
                        value={author.name}
                        onChange={(e) => updateCoAuthor(index, "name", e.target.value)}
                        placeholder="Name *"
                        required
                      />
                      <Input
                        type="email"
                        value={author.email}
                        onChange={(e) => updateCoAuthor(index, "email", e.target.value)}
                        placeholder="Email"
                      />
                      <Input
                        value={author.affiliation}
                        onChange={(e) => updateCoAuthor(index, "affiliation", e.target.value)}
                        placeholder="Affiliation"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="bg-white rounded-xl border p-6">
            {submitMutation.isError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span>{submitMutation.error.message}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={submitMutation.isPending || !title || !abstractText || wordCount > (settings?.word_limit || 300) || (categories.length > 0 && !categoryId)}
              className="w-full py-6 text-lg"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5 mr-2" />
                  Submit Abstract
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground mt-4">
              By submitting, you confirm that this abstract has not been published elsewhere
              and all authors have approved the submission.
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
