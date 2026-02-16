"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Loader2, Upload, ExternalLink, Trash2 } from "lucide-react"
import { toast } from "sonner"

export function FlightPreferenceUpload({
  token,
  uploadedImages,
  setUploadedImages,
  disabled = false,
}: {
  token: string
  uploadedImages: string[]
  setUploadedImages: (images: string[]) => void
  disabled?: boolean
}) {
  const [isUploading, setIsUploading] = useState(false)
  const _queryClient = useQueryClient()

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a JPG, PNG, or WebP image")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB")
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("bucket", "event-assets")
      formData.append("folder", `speaker-docs/flight-preferences/${token}`)

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const uploadResult = await uploadResponse.json()
      if (!uploadResponse.ok) {
        throw new Error(uploadResult.error)
      }

      const newImages = [...uploadedImages, uploadResult.url]
      setUploadedImages(newImages)

      toast.success("Screenshot uploaded! Click 'Save Travel Requirements' to save.")
    } catch (error: any) {
      toast.error(error.message || "Failed to upload")
    } finally {
      setIsUploading(false)
    }
  }

  const removeImage = (index: number) => {
    const newImages = uploadedImages.filter((_, i) => i !== index)
    setUploadedImages(newImages)
    toast.success("Screenshot removed. Click 'Save Travel Requirements' to save.")
  }

  return (
    <div className="space-y-3">
      {uploadedImages.length > 0 && (
        <div className="space-y-2">
          {uploadedImages.map((url, index) => (
            <div key={index} className="relative group">
              <img
                src={url}
                alt={`Flight preference ${index + 1}`}
                className="w-full rounded-lg border border-white/20"
              />
              <div className="absolute top-2 right-2 flex gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 bg-black/50 hover:bg-black/70"
                  onClick={() => window.open(url, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                {!disabled && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeImage(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!disabled && (
        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-green-500/30 rounded-lg cursor-pointer bg-green-500/5 hover:bg-green-500/10 transition-colors">
          <div className="flex flex-col items-center justify-center">
            {isUploading ? (
              <Loader2 className="h-8 w-8 text-green-400 animate-spin" />
            ) : (
              <>
                <Upload className="h-8 w-8 text-green-400 mb-1" />
                <p className="text-sm text-green-400">Upload flight screenshot</p>
                <p className="text-xs text-white/50">JPG, PNG (max 5MB)</p>
              </>
            )}
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleUpload}
            disabled={isUploading}
          />
        </label>
      )}
    </div>
  )
}
