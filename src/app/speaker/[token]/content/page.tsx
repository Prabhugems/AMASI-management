"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Mic,
  Replace,
  Trash2,
  Upload,
  Video,
  FileArchive,
  FileType,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils"

type ContentType = "slides" | "handout" | "video" | "poster" | "supplementary"

type Assignment = {
  id: string
  session_id: string | null
  session_name: string | null
  session_date: string | null
  start_time: string | null
  end_time: string | null
  hall: string | null
  role: string
  topic_title: string | null
  status: string
}

type ContentRow = {
  id: string
  faculty_assignment_id: string
  content_type: ContentType
  storage_path: string
  public_url: string | null
  original_filename: string | null
  file_size_bytes: number | null
  mime_type: string | null
  version: number
  notes: string | null
  uploaded_at: string
}

type ContentResponse = {
  assignments: Assignment[]
  content: ContentRow[]
  deadline: string | null
  deadline_passed: boolean
}

const CONTENT_SLOTS: { type: ContentType; label: string; accept: string }[] = [
  {
    type: "slides",
    label: "Slides",
    accept: ".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
  {
    type: "handout",
    label: "Handout",
    accept: ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  {
    type: "video",
    label: "Video",
    accept: ".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm",
  },
  {
    type: "poster",
    label: "Poster",
    accept: ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp",
  },
  {
    type: "supplementary",
    label: "Supplementary materials",
    accept: ".pdf,.zip,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/zip,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp",
  },
]

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/zip",
  "application/x-zip-compressed",
])

const MAX_BYTES = 100 * 1024 * 1024 // 100 MB

export default function SpeakerContentPage() {
  const params = useParams()
  const token = params.token as string
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery<ContentResponse>({
    queryKey: ["speaker-content", token],
    queryFn: async () => {
      const res = await fetch(`/api/speaker/${token}/content`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load content")
      return json as ContentResponse
    },
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["speaker-content", token] })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="max-w-4xl mx-auto py-8 space-y-4" role="status" aria-label="Loading content">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white/10 backdrop-blur border-white/20">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-amber-400" />
            <h2 className="text-xl font-semibold text-white mb-2">Unable to load</h2>
            <p className="text-white/70 text-sm">{(error as Error).message}</p>
            <Link
              href={`/speaker/${token}`}
              className="mt-4 inline-block text-sm text-white/80 hover:text-white underline"
            >
              Back to portal
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const assignments = data?.assignments ?? []
  const content = data?.content ?? []
  const deadline = data?.deadline ?? null
  const deadlinePassed = !!data?.deadline_passed

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Toaster richColors position="top-right" />
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Link
              href={`/speaker/${token}`}
              className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to speaker portal
            </Link>
            <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">
              Your content for this event
            </h1>
            <p className="text-sm text-white/70 mt-1">
              Upload slides, handouts and supporting materials for each of your sessions.
            </p>
          </div>
        </div>

        <DeadlineBanner deadline={deadline} deadlinePassed={deadlinePassed} />

        {assignments.length === 0 ? (
          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardContent className="py-10">
              <EmptyState
                icon={Mic}
                title="No sessions assigned yet"
                description="Your organizer hasn't booked you for anything in this event."
                className="text-white [&_h3]:text-white [&_p]:text-white/70 [&>div:first-child]:bg-white/10"
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {assignments.map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                token={token}
                assignment={assignment}
                content={content.filter((c) => c.faculty_assignment_id === assignment.id)}
                deadlinePassed={deadlinePassed}
                onChange={invalidate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DeadlineBanner({
  deadline,
  deadlinePassed,
}: {
  deadline: string | null
  deadlinePassed: boolean
}) {
  if (!deadline) return null

  const date = new Date(deadline)
  const formattedDate = date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

  if (deadlinePassed) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-base font-semibold text-red-200">
            Upload window closed on {formattedDate}
          </p>
          <p className="text-sm text-red-200/80 mt-0.5">
            Please contact your organizer if you still need to submit content.
          </p>
        </div>
      </div>
    )
  }

  const now = Date.now()
  const diffMs = date.getTime() - now
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)))
  const diffDays = Math.floor(diffHours / 24)
  const urgent = diffHours < 72

  if (urgent) {
    const countdown =
      diffHours < 24
        ? `${diffHours} hour${diffHours === 1 ? "" : "s"}`
        : `${diffDays} day${diffDays === 1 ? "" : "s"}`
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3">
        <Clock className="h-5 w-5 text-amber-300 mt-0.5 shrink-0" />
        <div>
          <p className="text-base font-semibold text-amber-200">
            Deadline in {countdown}
          </p>
          <p className="text-sm text-amber-200/80 mt-0.5">
            Uploads close on {formattedDate}.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-white/15 bg-white/5 p-4 flex items-start gap-3">
      <Calendar className="h-5 w-5 text-white/70 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-medium text-white/90">
          Upload deadline: {formattedDate}
        </p>
      </div>
    </div>
  )
}

function AssignmentCard({
  token,
  assignment,
  content,
  deadlinePassed,
  onChange,
}: {
  token: string
  assignment: Assignment
  content: ContentRow[]
  deadlinePassed: boolean
  onChange: () => void
}) {
  return (
    <Card className="bg-white/10 backdrop-blur border-white/20 print:hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-white text-base sm:text-lg">
              {assignment.topic_title || assignment.session_name || "Untitled session"}
            </CardTitle>
            {assignment.topic_title && assignment.session_name && (
              <p className="text-sm text-white/60 mt-0.5">{assignment.session_name}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
              {assignment.session_date && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(assignment.session_date)}
                </span>
              )}
              {assignment.start_time && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {assignment.start_time}
                  {assignment.end_time ? `–${assignment.end_time}` : ""}
                </span>
              )}
              {assignment.hall && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {assignment.hall}
                </span>
              )}
            </div>
          </div>
          <Badge variant="outline" className="capitalize text-white/80 border-white/30 bg-transparent shrink-0">
            {assignment.role}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {CONTENT_SLOTS.map((slot) => {
          const existing = content.find((c) => c.content_type === slot.type)
          return (
            <ContentSlot
              key={slot.type}
              token={token}
              assignmentId={assignment.id}
              slot={slot}
              existing={existing}
              deadlinePassed={deadlinePassed}
              onChange={onChange}
            />
          )
        })}
      </CardContent>
    </Card>
  )
}

function ContentSlot({
  token,
  assignmentId,
  slot,
  existing,
  deadlinePassed,
  onChange,
}: {
  token: string
  assignmentId: string
  slot: { type: ContentType; label: string; accept: string }
  existing: ContentRow | undefined
  deadlinePassed: boolean
  onChange: () => void
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/speaker/${token}/content/${id}`, {
        method: "DELETE",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to delete")
      return json
    },
    onSuccess: () => {
      toast.success(`${slot.label} deleted`)
      queryClient.invalidateQueries({ queryKey: ["speaker-content", token] })
      onChange()
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error(`File exceeds 100 MB limit (${formatBytes(file.size)})`)
      return
    }
    const mime = file.type || guessMimeFromName(file.name)
    if (!ALLOWED_MIMES.has(mime)) {
      toast.error(`File type not allowed: ${mime || "unknown"}`)
      return
    }

    setUploading(true)
    try {
      // Step 1: request signed URL
      const urlRes = await fetch(`/api/speaker/${token}/content/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faculty_assignment_id: assignmentId,
          content_type: slot.type,
          file_name: file.name,
          content_type_mime: mime,
          size: file.size,
        }),
      })
      const urlJson = await urlRes.json()
      if (!urlRes.ok) throw new Error(urlJson.error || "Failed to get upload URL")

      // Step 2: PUT to signed URL
      const putRes = await fetch(urlJson.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": mime },
        body: file,
      })
      if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`)

      // Step 3: register the upload
      const regRes = await fetch(`/api/speaker/${token}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faculty_assignment_id: assignmentId,
          content_type: slot.type,
          storage_path: urlJson.path,
          public_url: urlJson.publicUrl,
          original_filename: file.name,
          file_size_bytes: file.size,
          mime_type: mime,
        }),
      })
      const regJson = await regRes.json()
      if (!regRes.ok) throw new Error(regJson.error || "Failed to register upload")

      toast.success(`${slot.label} uploaded`)
      queryClient.invalidateQueries({ queryKey: ["speaker-content", token] })
      onChange()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  function pickFile() {
    fileRef.current?.click()
  }

  const disabled = deadlinePassed || uploading

  return (
    <div
      className={cn(
        "rounded-md border border-white/15 bg-white/5 p-3 sm:p-4",
        !existing && !deadlinePassed && "border-dashed"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white/80 shrink-0">
          <SlotIcon type={slot.type} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white">{slot.label}</span>
            {existing && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 text-white/70 border-white/30 bg-transparent">
                v{existing.version}
              </Badge>
            )}
          </div>
          {existing ? (
            <div className="mt-1 text-xs text-white/60 truncate">
              <span className="text-white/80">{existing.original_filename || "file"}</span>
              {existing.file_size_bytes != null && (
                <span> · {formatBytes(existing.file_size_bytes)}</span>
              )}
              <span> · uploaded {relativeTime(existing.uploaded_at)}</span>
            </div>
          ) : (
            <div className="mt-1 text-xs text-white/50">No file yet</div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {existing ? (
            <>
              {existing.public_url && (
                <Button
                  asChild
                  size="sm"
                  variant="secondary"
                  className="h-8 text-xs"
                >
                  <a
                    href={existing.public_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={existing.original_filename || undefined}
                    aria-label={`Download ${slot.label}`}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Download
                  </a>
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs border-white/30 text-white hover:bg-white/10 hover:text-white bg-transparent"
                onClick={pickFile}
                disabled={disabled}
                aria-label={`Replace ${slot.label}`}
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Replace className="h-3.5 w-3.5 mr-1" />
                )}
                Replace
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-red-300 hover:text-red-200 hover:bg-red-500/10"
                onClick={() => {
                  if (window.confirm(`Delete ${slot.label}?`)) {
                    deleteMutation.mutate(existing.id)
                  }
                }}
                disabled={disabled || deleteMutation.isPending}
                aria-label={`Delete ${slot.label}`}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 text-xs"
              onClick={pickFile}
              disabled={disabled}
              aria-label={`Upload ${slot.label}`}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5 mr-1" />
              )}
              Upload
            </Button>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={slot.accept}
        aria-label={`${slot.label} file`}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
    </div>
  )
}

function SlotIcon({ type }: { type: ContentType }) {
  switch (type) {
    case "slides":
      return <FileType className="h-4 w-4" />
    case "handout":
      return <FileText className="h-4 w-4" />
    case "video":
      return <Video className="h-4 w-4" />
    case "poster":
      return <ImageIcon className="h-4 w-4" />
    case "supplementary":
      return <FileArchive className="h-4 w-4" />
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const diff = Date.now() - then
  const min = Math.round(diff / 60000)
  if (min < 1) return "just now"
  if (min < 60) return `${min} min ago`
  const hours = Math.round(min / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function guessMimeFromName(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? ""
  const map: Record<string, string> = {
    pdf: "application/pdf",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    zip: "application/zip",
  }
  return map[ext] ?? ""
}
