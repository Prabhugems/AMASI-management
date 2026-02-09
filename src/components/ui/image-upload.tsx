"use client"

import { useState, useRef } from "react"
import { Upload, X, Link, Loader2, Image as ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface ImageUploadProps {
  value?: string
  onChange: (url: string) => void
  eventId?: string
  folder?: string
  aspectRatio?: "square" | "banner" | "auto"
  placeholder?: string
  className?: string
}

export function ImageUpload({
  value,
  onChange,
  eventId,
  folder = "events",
  aspectRatio = "auto",
  placeholder = "Upload image or paste URL",
  className,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInput, setUrlInput] = useState("")
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError("")
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
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
            disabled={isUploading}
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
