"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  X,
  Video,
  Presentation,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

export default function UploadPresentationPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const abstractId = params.abstractId as string
  const email = searchParams.get("email") || ""

  const [loading, setLoading] = useState(true)
  const [abstract, setAbstract] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [presentationType, setPresentationType] = useState<"slides" | "video" | "poster">("slides")

  const supabase = createClient()

  // Fetch abstract details
  useEffect(() => {
    const fetchAbstract = async () => {
      if (!abstractId || !email) {
        setError("Missing abstract ID or email")
        setLoading(false)
        return
      }

      try {
        const res = await fetch(
          `/api/abstracts/${abstractId}?email=${encodeURIComponent(email.toLowerCase())}`
        )
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || "Failed to load abstract")
          setLoading(false)
          return
        }

        if (data.status !== "accepted") {
          setError("Only accepted abstracts can upload presentations")
          setLoading(false)
          return
        }

        // Verify email matches
        if (data.presenting_author_email?.toLowerCase() !== email.toLowerCase()) {
          setError("You are not authorized to upload for this abstract")
          setLoading(false)
          return
        }

        setAbstract(data)
      } catch (err) {
        setError("Failed to load abstract details")
      } finally {
        setLoading(false)
      }
    }

    fetchAbstract()
  }, [abstractId, email])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "video/mp4",
      "video/webm",
      "image/jpeg",
      "image/png",
    ]

    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Allowed: PDF, PPT, PPTX, MP4, WEBM, JPG, PNG")
      return
    }

    // Max 100MB
    if (file.size > 100 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 100MB")
      return
    }

    setSelectedFile(file)

    // Auto-detect presentation type
    if (file.type.startsWith("video/")) {
      setPresentationType("video")
    } else if (file.type.startsWith("image/")) {
      setPresentationType("poster")
    } else {
      setPresentationType("slides")
    }
  }, [])

  const handleUpload = async () => {
    if (!selectedFile || !abstract) return

    setUploading(true)
    setUploadProgress(0)

    try {
      // Upload to Supabase storage
      const fileExt = selectedFile.name.split(".").pop()
      const fileName = `presentations/${abstract.event_id}/${abstract.id}/${Date.now()}.${fileExt}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("abstracts")
        .upload(fileName, selectedFile, {
          cacheControl: "3600",
          upsert: true,
        })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      setUploadProgress(50)

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("abstracts")
        .getPublicUrl(fileName)

      setUploadProgress(75)

      // Update abstract with presentation URL
      const res = await fetch("/api/my/abstracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          abstract_id: abstract.id,
          email: email,
          action: "upload_presentation",
          presentation_url: urlData.publicUrl,
          presentation_name: selectedFile.name,
          presentation_type: presentationType,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || "Failed to save presentation")
      }

      setUploadProgress(100)
      toast.success("Presentation uploaded successfully!")

      // Redirect back after short delay
      setTimeout(() => {
        router.push(`/my?q=${encodeURIComponent(email)}`)
      }, 1500)
    } catch (err: any) {
      toast.error(err.message || "Upload failed")
      setUploadProgress(0)
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to My Page
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Upload Presentation</h1>
          <p className="text-gray-600">Upload your presentation file for your accepted abstract</p>
        </div>

        {/* Abstract Info */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
              <Presentation className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono text-blue-600 mb-1">{abstract.abstract_number}</p>
              <h2 className="font-semibold text-gray-900 line-clamp-2">{abstract.title}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {abstract.presenting_author_name} • {abstract.accepted_as || "Presentation"}
              </p>
            </div>
          </div>

          {abstract.presentation_url && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Presentation already uploaded</span>
              </div>
              <p className="text-xs text-green-600 mt-1">
                {abstract.presentation_name || "Uploaded file"}
              </p>
            </div>
          )}
        </div>

        {/* Upload Section */}
        {!abstract.presentation_url && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Select File</h3>

            {/* File Type Selection */}
            <div className="mb-4">
              <Label className="text-sm text-gray-700 mb-2 block">Presentation Type</Label>
              <div className="flex gap-2">
                {[
                  { value: "slides", label: "Slides", icon: FileText },
                  { value: "video", label: "Video", icon: Video },
                  { value: "poster", label: "Poster", icon: Presentation },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setPresentationType(value as any)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                      presentationType === value
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* File Input */}
            <div className="mb-6">
              <Label htmlFor="file" className="text-sm text-gray-700 mb-2 block">
                Upload File
              </Label>
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  selectedFile
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="w-8 h-8 text-blue-600" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="ml-4 p-1 hover:bg-gray-200 rounded"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 mb-2">Click or drag to upload</p>
                    <p className="text-xs text-gray-500">
                      PDF, PPT, PPTX, MP4, WEBM, JPG, PNG (Max 100MB)
                    </p>
                  </>
                )}
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.ppt,.pptx,.mp4,.webm,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  style={{ position: "absolute" }}
                />
              </div>
            </div>

            {/* Progress Bar */}
            {uploading && (
              <div className="mb-4">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1 text-center">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Presentation
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
