"use client"

import { useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Star, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Headshot = {
  url: string
  label?: string
  uploaded_at?: string
  is_primary?: boolean
}

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const
const MAX_BYTES = 10 * 1024 * 1024

export function HeadshotManager({ facultyId }: { facultyId: string }) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const { data: headshots = [], isLoading } = useQuery({
    queryKey: ["headshots", facultyId],
    queryFn: async () => {
      const res = await fetch(`/api/faculty/${facultyId}/headshots`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load headshots")
      return (json.data as Headshot[]) ?? []
    },
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["headshots", facultyId] })
    queryClient.invalidateQueries({ queryKey: ["faculty", facultyId] })
  }

  const setPrimary = useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch(`/api/faculty/${facultyId}/headshots`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primary_url: url }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed")
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch(
        `/api/faculty/${facultyId}/headshots?url=${encodeURIComponent(url)}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error((await res.json()).error || "Failed")
    },
    onSuccess: invalidate,
  })

  const mutationError =
    (setPrimary.error as Error | null)?.message ||
    (remove.error as Error | null)?.message ||
    null

  async function handleFile(file: File) {
    setUploadError(null)
    if (!ALLOWED_MIME.includes(file.type as typeof ALLOWED_MIME[number])) {
      setUploadError(`Only ${ALLOWED_MIME.join(", ")} allowed`)
      return
    }
    if (file.size > MAX_BYTES) {
      setUploadError("File exceeds 10MB limit")
      return
    }

    try {
      const urlRes = await fetch(`/api/faculty/${facultyId}/headshots/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: file.name,
          content_type: file.type,
          size: file.size,
        }),
      })
      const urlJson = await urlRes.json()
      if (!urlRes.ok) throw new Error(urlJson.error || "Failed to get upload URL")

      const putRes = await fetch(urlJson.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      })
      if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`)

      const regRes = await fetch(`/api/faculty/${facultyId}/headshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlJson.publicUrl }),
      })
      if (!regRes.ok) throw new Error((await regRes.json()).error || "Failed to register")

      const url = urlJson.publicUrl as string
      queryClient.setQueryData<Headshot[]>(["headshots", facultyId], (old = []) => [
        ...old.filter((h) => h.url !== url),
        { url, uploaded_at: new Date().toISOString(), is_primary: old.length === 0 },
      ])
      invalidate()
    } catch (err) {
      setUploadError((err as Error).message)
    }
  }

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files)
    if (list.length === 0) return

    setUploading(true)
    try {
      for (let i = 0; i < list.length; i++) {
        setUploadProgress({ current: i + 1, total: list.length })
        await handleFile(list[i])
      }
    } finally {
      setUploading(false)
      setUploadProgress(null)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium">Headshot library</h4>
          <p className="text-xs text-muted-foreground">
            Up to 10 MB · JPG / PNG / WebP / AVIF
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-busy={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {uploading && uploadProgress
            ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}…`
            : "Upload"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED_MIME.join(",")}
          multiple
          aria-label="Upload headshot image"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFiles(e.target.files)
            }
          }}
        />
      </div>

      {uploadError && (
        <p className="text-sm text-destructive">{uploadError}</p>
      )}
      {mutationError && (
        <p className="text-sm text-destructive">{mutationError}</p>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div
          className={cn(
            "rounded-md",
            isDragging && "ring-2 ring-primary ring-offset-2 ring-offset-background"
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleFiles(e.dataTransfer.files)
            }
          }}
        >
          {headshots.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              {isDragging
                ? "Release to upload"
                : "Drop image here or click Upload"}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {headshots.map((h) => (
                <HeadshotCard
                  key={h.url}
                  headshot={h}
                  onSetPrimary={() => setPrimary.mutate(h.url)}
                  onDelete={() => {
                    if (window.confirm("Delete this headshot?")) {
                      remove.mutate(h.url)
                    }
                  }}
                  busy={setPrimary.isPending || remove.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function HeadshotCard({
  headshot,
  onSetPrimary,
  onDelete,
  busy,
}: {
  headshot: Headshot
  onSetPrimary: () => void
  onDelete: () => void
  busy: boolean
}) {
  return (
    <div className="relative group rounded-md overflow-hidden border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={headshot.url}
        alt={headshot.label || "Headshot"}
        loading="lazy"
        className="aspect-square w-full object-cover bg-muted"
      />
      {headshot.is_primary && (
        <Badge className="absolute top-1.5 left-1.5 bg-amber-500 hover:bg-amber-500 text-white">
          <Star className="h-3 w-3 mr-1 fill-current" />
          Primary
        </Badge>
      )}
      <div className="absolute inset-x-0 bottom-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/80 to-transparent p-2 flex gap-2 justify-end">
        {!headshot.is_primary && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 px-2 text-xs"
            onClick={onSetPrimary}
            disabled={busy}
          >
            <Star className="h-3 w-3 mr-1" />
            Set primary
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="h-7 px-2 text-xs"
          onClick={onDelete}
          disabled={busy}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
