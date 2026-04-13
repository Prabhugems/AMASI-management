"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Upload, X, Link, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface ImageUploadProps {
  value?: string
  onChange: (url: string) => void
  eventId?: string
  folder?: string
  aspectRatio?: "square" | "banner" | "auto"
  placeholder?: string
  className?: string
}

const ASPECT_RATIOS: Record<string, number> = {
  square: 1,
  banner: 3,
}

const RATIO_TOLERANCE = 0.1

function cropToAspectRatio(
  img: HTMLImageElement,
  targetRatio: number
): Promise<Blob> {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!

  const imgRatio = img.width / img.height
  let sx = 0,
    sy = 0,
    sw = img.width,
    sh = img.height

  if (imgRatio > targetRatio) {
    // Image is wider - crop sides
    sw = img.height * targetRatio
    sx = (img.width - sw) / 2
  } else {
    // Image is taller - crop top/bottom
    sh = img.width / targetRatio
    sy = (img.height - sh) / 2
  }

  // Output at reasonable size
  const maxWidth = 1200
  canvas.width = Math.min(sw, maxWidth)
  canvas.height = canvas.width / targetRatio

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.9)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export function ImageUpload({
  value,
  onChange,
  eventId,
  folder = "events",
  aspectRatio = "auto",
  placeholder: _placeholder = "Upload image or paste URL",
  className,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInput, setUrlInput] = useState("")
  const [error, setError] = useState("")
  const [cropPreview, setCropPreview] = useState<{
    file: File
    url: string
    img: HTMLImageElement
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (cropPreview) {
        URL.revokeObjectURL(cropPreview.url)
      }
    }
  }, [cropPreview])

  const uploadFile = useCallback(
    async (fileOrBlob: File | Blob, fileName?: string) => {
      setIsUploading(true)
      setError("")

      try {
        const formData = new FormData()
        formData.append(
          "file",
          fileOrBlob,
          fileName || (fileOrBlob instanceof File ? fileOrBlob.name : "image.jpg")
        )
        if (eventId) {
          formData.append("event_id", eventId)
        }
        formData.append("type", folder)

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || "Upload failed")
        }

        onChange(data.url)
      } catch (err: any) {
        setError(err.message || "Upload failed")
      } finally {
        setIsUploading(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    },
    [eventId, folder, onChange]
  )

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError("")

    // If aspect ratio is "auto", upload immediately (no crop check)
    if (aspectRatio === "auto") {
      await uploadFile(file)
      return
    }

    // Load the image to check its aspect ratio
    const objectUrl = URL.createObjectURL(file)
    try {
      const img = await loadImage(objectUrl)
      const targetRatio = ASPECT_RATIOS[aspectRatio]
      const imgRatio = img.width / img.height
      const ratioDiff = Math.abs(imgRatio - targetRatio) / targetRatio

      if (ratioDiff <= RATIO_TOLERANCE) {
        // Close enough to target ratio, upload directly
        URL.revokeObjectURL(objectUrl)
        await uploadFile(file)
      } else {
        // Show crop preview dialog
        setCropPreview({ file, url: objectUrl, img })
      }
    } catch {
      URL.revokeObjectURL(objectUrl)
      setError("Failed to load image")
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleCropAndUpload = async () => {
    if (!cropPreview) return

    const targetRatio = ASPECT_RATIOS[aspectRatio]
    try {
      const blob = await cropToAspectRatio(cropPreview.img, targetRatio)
      const fileName = cropPreview.file.name.replace(/\.[^.]+$/, ".jpg")
      URL.revokeObjectURL(cropPreview.url)
      setCropPreview(null)
      await uploadFile(blob, fileName)
    } catch {
      setError("Failed to resize image")
    }
  }

  const handleUploadAsIs = async () => {
    if (!cropPreview) return

    const file = cropPreview.file
    URL.revokeObjectURL(cropPreview.url)
    setCropPreview(null)
    await uploadFile(file)
  }

  const handleCancelCrop = () => {
    if (cropPreview) {
      URL.revokeObjectURL(cropPreview.url)
      setCropPreview(null)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim())
      setUrlInput("")
      setShowUrlInput(false)
    }
  }

  const handleRemove = () => {
    onChange("")
    setError("")
  }

  const aspectClasses = {
    square: "aspect-square",
    banner: "aspect-[3/1]",
    auto: "min-h-[120px]",
  }

  return (
    <div className={cn("space-y-2", className)}>
      {value ? (
        <div className={cn("relative rounded-lg overflow-hidden border bg-gray-50", aspectClasses[aspectRatio])}>
          <img
            src={value}
            alt="Uploaded"
            className="w-full h-full object-contain"
            onError={() => setError("Failed to load image")}
          />
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg transition-colors",
            "hover:border-emerald-400 hover:bg-emerald-50/50",
            isUploading ? "border-emerald-400 bg-emerald-50/50" : "border-gray-300",
            aspectClasses[aspectRatio]
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            disabled={isUploading || !!cropPreview}
          />

          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            {isUploading ? (
              <>
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-2" />
                <p className="text-sm text-gray-500">Uploading...</p>
              </>
            ) : (
              <>
                <div className="p-3 bg-gray-100 rounded-full mb-2">
                  <Upload className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-600 font-medium">Click to upload</p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF up to 5MB</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Crop Preview Dialog */}
      {cropPreview && (
        <div className="mt-3 p-3 border border-border rounded-lg bg-secondary/30 space-y-3">
          <img
            src={cropPreview.url}
            alt="Preview"
            className="max-h-40 rounded object-contain mx-auto"
          />
          <p className="text-xs text-muted-foreground text-center">
            This image will be resized to fit{" "}
            {aspectRatio === "square" ? "1:1" : "3:1"} ratio
          </p>
          <div className="flex gap-2 justify-center">
            <Button size="sm" onClick={handleCropAndUpload}>
              Resize &amp; Upload
            </Button>
            <Button size="sm" variant="outline" onClick={handleUploadAsIs}>
              Upload As-Is
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancelCrop}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* URL Input Option */}
      {!value && (
        <div className="flex items-center gap-2">
          {showUrlInput ? (
            <div className="flex-1 flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
              />
              <button
                onClick={handleUrlSubmit}
                disabled={!urlInput.trim()}
                className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => setShowUrlInput(false)}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowUrlInput(true)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-emerald-600 transition-colors"
            >
              <Link className="w-4 h-4" />
              Or paste image URL
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}
