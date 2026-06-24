"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  Mail, Phone, MapPin, Building2, Globe, Linkedin, Twitter, BookOpen,
  Pencil, ChevronLeft, Calendar, Clock, CheckCircle2, AlertCircle,
  Download, FileText, FileType, Image as ImageIcon, Video, FileArchive,
  Shield, IndianRupee, AlertTriangle,
} from "lucide-react"
import { HonorariumPipeline } from "@/components/speaker/honorarium-pipeline"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { EditProfileSheet } from "@/components/speaker/edit-profile-sheet"

type FacultyRow = {
  id: string
  title: string | null
  name: string
  email: string | null
  phone: string | null
  designation: string | null
  institution: string | null
  city: string | null
  state: string | null
  bio: string | null
  bio_markdown: string | null
  expertise_tags: string[] | null
  headshot_urls: Array<{ url: string; label?: string; is_primary?: boolean }> | null
  youtube_reel_url: string | null
  photo_url: string | null
  linkedin: string | null
  twitter: string | null
  orcid_id: string | null
  website: string | null
  researchgate: string | null
  pubmed_id: string | null
  status: string | null
  created_at: string
}

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
  display_order: number
  responded_at: string | null
  invitation_sent_at: string | null
}

type ContentType = "slides" | "handout" | "video" | "poster" | "supplementary"

type SpeakerContentRow = {
  id: string
  faculty_assignment_id: string
  faculty_id: string | null
  faculty_email: string | null
  content_type: ContentType
  storage_path: string
  public_url: string | null
  original_filename: string | null
  file_size_bytes: number | null
  mime_type: string | null
  version: number
  uploaded_at: string
}

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  slides: "Slides",
  handout: "Handout",
  video: "Video",
  poster: "Poster",
  supplementary: "Supplementary materials",
}

export default function SpeakerWorkbenchPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const speakerId = params.speakerId as string
  const supabase = createClient()
  const [editOpen, setEditOpen] = useState(false)

  const { data: faculty, isLoading: facultyLoading, error: facultyError } = useQuery({
    queryKey: ["faculty", speakerId],
    queryFn: async () => {
      const res = await fetch(`/api/faculty/${speakerId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load faculty")
      return json.data as FacultyRow
    },
  })

  // Assignments for this event — match by faculty_id OR email fallback (many legacy rows have NULL faculty_id).
  // Filter in JS rather than building a PostgREST .or() string with the email — emails can contain characters
  // (commas, parens) that break PostgREST filter parsing, and the per-event row count is small.
  const { data: assignments = [] } = useQuery({
    queryKey: ["session-speakers-for-faculty", eventId, speakerId, faculty?.email],
    enabled: !!faculty,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faculty_assignments")
        .select("id, session_id, session_name, session_date, start_time, end_time, hall, role, topic_title, status, display_order, responded_at, invitation_sent_at, faculty_id, faculty_email")
        .eq("event_id", eventId)
        .order("session_date", { ascending: true })
        .order("display_order", { ascending: true })
      if (error) throw error
      const email = (faculty as FacultyRow).email?.toLowerCase() ?? null
      type Row = Assignment & { faculty_id: string | null; faculty_email: string | null }
      return ((data ?? []) as Row[]).filter((row) => {
        if (row.faculty_id === speakerId) return true
        if (email && row.faculty_email && row.faculty_email.toLowerCase() === email) return true
        return false
      }) as Assignment[]
    },
  })

  const assignmentIds = assignments.map((a) => a.id)
  const { data: speakerContent = [], isLoading: contentLoading } = useQuery({
    queryKey: ["speaker-content-admin", eventId, speakerId, assignmentIds.join(",")],
    enabled: assignmentIds.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        assignmentIds.map(async (id) => {
          const res = await fetch(
            `/api/events/${eventId}/speaker-content?assignment_id=${encodeURIComponent(id)}`
          )
          if (!res.ok) return [] as SpeakerContentRow[]
          const json = await res.json()
          return (json.data ?? json.content ?? []) as SpeakerContentRow[]
        })
      )
      return results.flat()
    },
  })

  if (facultyLoading) {
    return (
      <div className="p-6 space-y-4" role="status" aria-label="Loading speaker profile">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-10 w-full mb-2" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (facultyError || !faculty) {
    return (
      <div className="p-6">
        <EmptyState
          icon={AlertCircle}
          title="Speaker not found"
          description={(facultyError as Error)?.message ?? "This faculty profile does not exist."}
          action={{
            label: "Back to All Speakers",
            onClick: () => router.push(`/events/${eventId}/speakers/list`),
            variant: "outline",
          }}
        />
      </div>
    )
  }

  const primaryPhoto =
    faculty.headshot_urls?.find((h) => h.is_primary)?.url ??
    faculty.headshot_urls?.[0]?.url ??
    faculty.photo_url ??
    undefined

  const initials = faculty.name
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const confirmedCount = assignments.filter((a) => a.status === "confirmed").length
  const profileCompleteness = computeCompleteness(faculty)

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/events/${eventId}/speakers/list`}
          aria-label="Back to all speakers"
          className="hover:text-foreground inline-flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          All Speakers
        </Link>
        <span>/</span>
        <span className="text-foreground">{faculty.name}</span>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            <Avatar className="h-24 w-24 flex-shrink-0 ring-2 ring-border">
              <AvatarImage src={primaryPhoto} alt={faculty.name} />
              <AvatarFallback className="text-xl">{initials || "?"}</AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold">
                    {faculty.title ? `${faculty.title} ` : ""}{faculty.name}
                  </h1>
                  {faculty.designation && (
                    <p className="text-muted-foreground">{faculty.designation}</p>
                  )}
                  {faculty.institution && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {faculty.institution}
                      {faculty.city && <span>· {faculty.city}</span>}
                    </p>
                  )}
                </div>
                <Button size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit profile
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <Badge variant="secondary">
                  {assignments.length} session{assignments.length === 1 ? "" : "s"}
                </Badge>
                {confirmedCount > 0 && (
                  <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {confirmedCount} confirmed
                  </Badge>
                )}
                <Badge variant="outline">
                  Profile {profileCompleteness}% complete
                </Badge>
                {faculty.status && faculty.status !== "active" && (
                  <Badge variant="destructive">{faculty.status}</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sessions">Sessions ({assignments.length})</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="disclosure">Disclosure</TabsTrigger>
          <TabsTrigger value="honorarium">Honorarium</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Bio</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">
                {faculty.bio_markdown || faculty.bio || (
                  <span className="text-muted-foreground italic">No bio yet.</span>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {faculty.email && (
                  <ContactRow icon={Mail} label="Email" value={faculty.email} href={`mailto:${faculty.email}`} />
                )}
                {faculty.phone && (
                  <ContactRow icon={Phone} label="Phone" value={faculty.phone} href={`tel:${faculty.phone}`} />
                )}
                {(faculty.city || faculty.state) && (
                  <ContactRow icon={MapPin} label="Location" value={[faculty.city, faculty.state].filter(Boolean).join(", ")} />
                )}
              </CardContent>
            </Card>

            {faculty.expertise_tags && faculty.expertise_tags.length > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Expertise</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {faculty.expertise_tags.map((tag) => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Online</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {!hasAnySocial(faculty) && (
                  <p className="text-muted-foreground italic">No social links yet.</p>
                )}
                {faculty.linkedin && <SocialRow icon={Linkedin} label="LinkedIn" href={faculty.linkedin} />}
                {faculty.twitter && <SocialRow icon={Twitter} label="Twitter / X" href={`https://twitter.com/${faculty.twitter.replace(/^@/, "")}`} />}
                {faculty.website && <SocialRow icon={Globe} label="Website" href={faculty.website} />}
                {faculty.orcid_id && <SocialRow icon={BookOpen} label={`ORCID ${faculty.orcid_id}`} href={`https://orcid.org/${faculty.orcid_id}`} />}
              </CardContent>
            </Card>

            {faculty.youtube_reel_url && (
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle className="text-base">Intro reel</CardTitle>
                </CardHeader>
                <CardContent>
                  <a
                    href={faculty.youtube_reel_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    {faculty.youtube_reel_url}
                  </a>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-3">
          {assignments.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No sessions assigned"
              description="This speaker has no sessions linked to this event yet."
            />
          ) : (
            assignments.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-4 flex flex-wrap items-start gap-4 justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{a.topic_title || a.session_name || "Untitled session"}</div>
                    <div className="text-sm text-muted-foreground flex flex-wrap gap-3 mt-1">
                      {a.session_date && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(a.session_date)}
                        </span>
                      )}
                      {a.start_time && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {a.start_time}{a.end_time ? `–${a.end_time}` : ""}
                        </span>
                      )}
                      {a.hall && <span>· {a.hall}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline">{a.role}</Badge>
                    <StatusBadge status={a.status} />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="content" className="space-y-3">
          <SpeakerContentTab
            assignments={assignments}
            content={speakerContent}
            loading={contentLoading}
          />
        </TabsContent>

        <TabsContent value="disclosure">
          <SpeakerDisclosureTab eventId={eventId} facultyId={speakerId} />
        </TabsContent>

        <TabsContent value="honorarium">
          <SpeakerHonorariumTab eventId={eventId} facultyId={speakerId} />
        </TabsContent>

        <TabsContent value="activity" className="space-y-3">
          {(() => {
            const hasInvitations = assignments.some((a) => a.invitation_sent_at)
            const hasResponses = assignments.some((a) => a.responded_at)
            if (!hasInvitations && !hasResponses) {
              return (
                <EmptyState
                  icon={Calendar}
                  title="No activity yet"
                  description={`Profile created ${formatDateTime(faculty.created_at)}. Invitations and responses will appear here once this speaker is engaged for the event.`}
                />
              )
            }
            return (
              <Card>
                <CardContent className="p-4 text-sm space-y-2">
                  <div>
                    <span className="text-muted-foreground">Profile created: </span>
                    {formatDateTime(faculty.created_at)}
                  </div>
                  {hasInvitations && (
                    <div className="border-t pt-2">
                      <div className="font-medium text-xs uppercase text-muted-foreground tracking-wide mb-2">
                        Recent invitations
                      </div>
                      {assignments
                        .filter((a) => a.invitation_sent_at)
                        .slice(0, 5)
                        .map((a) => (
                          <div key={a.id} className="text-xs text-muted-foreground">
                            {formatDateTime(a.invitation_sent_at)} — {a.session_name || "session"} ({a.role})
                          </div>
                        ))}
                    </div>
                  )}
                  {hasResponses && (
                    <div className="border-t pt-2">
                      <div className="font-medium text-xs uppercase text-muted-foreground tracking-wide mb-2">
                        Recent responses
                      </div>
                      {assignments
                        .filter((a) => a.responded_at)
                        .slice(0, 5)
                        .map((a) => (
                          <div key={a.id} className="text-xs text-muted-foreground">
                            {formatDateTime(a.responded_at)} — {a.status} ({a.session_name || "session"})
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })()}
        </TabsContent>
      </Tabs>

      <EditProfileSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        faculty={faculty}
      />
    </div>
  )
}

function ContactRow({
  icon: Icon, label, value, href,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; href?: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        {href ? (
          <a href={href} className="text-foreground hover:underline break-words">{value}</a>
        ) : (
          <div className="text-foreground break-words">{value}</div>
        )}
      </div>
    </div>
  )
}

function SocialRow({
  icon: Icon, label, href,
}: { icon: React.ComponentType<{ className?: string }>; label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-foreground hover:text-primary"
    >
      <Icon className="h-4 w-4" />
      <span className="text-sm">{label}</span>
    </a>
  )
}

function StatusBadge({ status }: { status: string }) {
  const palette: Record<string, string> = {
    confirmed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    invited: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
    declined: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
    change_requested: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    cancelled: "bg-slate-500/15 text-slate-700 dark:text-slate-400",
  }
  return (
    <Badge variant="secondary" className={palette[status] ?? ""}>
      {status.replace("_", " ")}
    </Badge>
  )
}

function PhasePlaceholder({
  phase, title, description,
}: { phase: string; title: string; description: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center space-y-2">
        <Badge variant="outline" className="mb-2">{phase}</Badge>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
      </CardContent>
    </Card>
  )
}

function hasAnySocial(f: FacultyRow): boolean {
  return !!(f.linkedin || f.twitter || f.website || f.orcid_id || f.researchgate)
}

function computeCompleteness(f: FacultyRow): number {
  const checks = [
    !!(f.bio_markdown || f.bio),
    !!(f.expertise_tags && f.expertise_tags.length > 0),
    !!(f.headshot_urls && f.headshot_urls.length > 0) || !!f.photo_url,
    !!f.designation,
    !!f.institution,
    !!(f.linkedin || f.twitter || f.website || f.orcid_id),
    !!f.phone,
    !!f.youtube_reel_url,
  ]
  const score = checks.filter(Boolean).length
  return Math.round((score / checks.length) * 100)
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  })
}

function formatDateTime(date: string | null): string {
  if (!date) return "—"
  return new Date(date).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  })
}

function formatBytes(bytes: number | null): string {
  if (bytes == null || bytes === 0) return "—"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

function ContentTypeIcon({ type }: { type: ContentType }) {
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

function SpeakerContentTab({
  assignments,
  content,
  loading,
}: {
  assignments: Assignment[]
  content: SpeakerContentRow[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-3" role="status" aria-label="Loading speaker content">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (content.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No content yet"
        description="This speaker hasn't uploaded anything yet."
      />
    )
  }

  const assignmentsWithContent = assignments.filter((a) =>
    content.some((c) => c.faculty_assignment_id === a.id)
  )

  return (
    <div className="space-y-3">
      {assignmentsWithContent.map((a) => {
        const rows = content.filter((c) => c.faculty_assignment_id === a.id)
        return (
          <Card key={a.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {a.topic_title || a.session_name || "Untitled session"}
              </CardTitle>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 mt-1">
                {a.session_date && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(a.session_date)}
                  </span>
                )}
                {a.start_time && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {a.start_time}{a.end_time ? `–${a.end_time}` : ""}
                  </span>
                )}
                {a.hall && <span>· {a.hall}</span>}
                <Badge variant="outline" className="ml-auto capitalize">{a.role}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center gap-3 rounded-md border bg-card p-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
                    <ContentTypeIcon type={row.content_type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {CONTENT_TYPE_LABELS[row.content_type]}
                      </span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0">
                        v{row.version}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      <span className="text-foreground">{row.original_filename || "file"}</span>
                      <span> · {formatBytes(row.file_size_bytes)}</span>
                      <span> · {formatDateTime(row.uploaded_at)}</span>
                    </div>
                  </div>
                  {row.public_url && (
                    <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                      <a
                        href={row.public_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={row.original_filename || undefined}
                        aria-label={`Download ${CONTENT_TYPE_LABELS[row.content_type]}`}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        Download
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

type DisclosureRow = {
  id: string
  version: number
  has_conflict: boolean
  signed_at: string
  entities: Array<{ org?: string; relationship?: string; compensation_type?: string }>
  disclosure_text: string | null
  pdf_storage_path: string | null
}

function SpeakerDisclosureTab({ eventId, facultyId }: { eventId: string; facultyId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["disclosures", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/disclosures`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load disclosures")
      return json
    },
  })

  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-lg" />
  }

  type Entry = { faculty: { id: string }; disclosure: DisclosureRow | null }
  const entries = (data?.data ?? []) as Entry[]
  const entry = entries.find((e) => e.faculty?.id === facultyId)
  const disclosure = entry?.disclosure ?? null

  if (!disclosure) {
    return (
      <EmptyState
        icon={Shield}
        title="No disclosure on file"
        description="This speaker hasn't signed a financial disclosure for this event yet."
      />
    )
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {disclosure.has_conflict ? (
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Conflict declared
                </Badge>
              ) : (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  No conflict
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                v{disclosure.version} · signed {new Date(disclosure.signed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          </div>
          {disclosure.pdf_storage_path && (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const res = await fetch(`/api/events/${eventId}/disclosures/${disclosure.id}/signed-pdf`)
                const json = await res.json()
                if (res.ok && json.url) window.open(json.url, "_blank")
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download signed PDF
            </Button>
          )}
        </div>

        {disclosure.has_conflict && disclosure.entities.length > 0 && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-2">
              Disclosed entities
            </div>
            <ul className="space-y-1">
              {disclosure.entities.map((e, i) => (
                <li key={i}>
                  <span className="font-medium">{e.org || "Unnamed"}</span>
                  {e.relationship && <span className="text-muted-foreground"> — {e.relationship}</span>}
                  {e.compensation_type && <span className="text-muted-foreground"> ({e.compensation_type})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {disclosure.disclosure_text && (
          <div className="text-sm">
            <div className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">Notes</div>
            <p className="whitespace-pre-wrap">{disclosure.disclosure_text}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

type EventFacultyRow = {
  id: string
  faculty_id: string
  honorarium_applicable: boolean | null
  honorarium_amount: number | null
  honorarium_currency: string | null
  honorarium_status: string | null
  honorarium_paid_date: string | null
  honorarium_reference: string | null
  payment_method: string | null
  tds_deducted: number | null
}

function SpeakerHonorariumTab({ eventId, facultyId }: { eventId: string; facultyId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["honoraria", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/honoraria`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load honoraria")
      return json
    },
  })

  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-lg" />
  }

  type Entry = { faculty_id: string } & EventFacultyRow
  const rows = ((data?.data ?? []) as Entry[]).filter((r) => r.faculty_id === facultyId)
  const row = rows[0]

  if (!row) {
    return (
      <EmptyState
        icon={IndianRupee}
        title="No honorarium record"
        description="This speaker has no honorarium entry for this event yet."
      />
    )
  }

  const status = (row.honorarium_status ?? "pending") as
    | "not_eligible" | "pending" | "approved" | "processing" | "paid" | "rejected"
  const amount = row.honorarium_amount ?? 0
  const currency = row.honorarium_currency ?? "INR"
  const fmtAmount = new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 })
    .format(amount)

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold">{fmtAmount}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {row.honorarium_applicable === false ? "Not applicable" : "Honorarium"}
            </div>
          </div>
          <Link href={`/events/${eventId}/speakers/honoraria`}>
            <Button size="sm" variant="outline">
              Manage in pipeline
            </Button>
          </Link>
        </div>

        <HonorariumPipeline status={status} />

        {(row.honorarium_paid_date || row.honorarium_reference || row.payment_method || row.tds_deducted) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t text-sm">
            {row.honorarium_paid_date && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Paid date</div>
                <div>{new Date(row.honorarium_paid_date).toLocaleDateString("en-IN")}</div>
              </div>
            )}
            {row.payment_method && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Method</div>
                <div className="capitalize">{row.payment_method}</div>
              </div>
            )}
            {row.honorarium_reference && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Reference</div>
                <div className="font-mono text-xs">{row.honorarium_reference}</div>
              </div>
            )}
            {row.tds_deducted != null && row.tds_deducted > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">TDS deducted</div>
                <div>{new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(row.tds_deducted)}</div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
