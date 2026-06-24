"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Search, Users, Building2, ExternalLink, Plus, ChevronLeft, ChevronRight, CheckCircle2, Info, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { AddToEventDialog } from "@/components/speaker/add-to-event-dialog"

type FacultyRow = {
  id: string
  title: string | null
  name: string
  email: string | null
  phone: string | null
  designation: string | null
  institution: string | null
  city: string | null
  photo_url: string | null
  headshot_urls: Array<{ url: string; is_primary?: boolean }> | null
  expertise_tags: string[] | null
  bio_markdown: string | null
}

type SessionLink = {
  faculty_id: string | null
  faculty_email: string | null
}

const PAGE_SIZE = 60

export default function SpeakersDirectoryPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(0)
  const [inEventOnly, setInEventOnly] = useState(false)
  const [addTarget, setAddTarget] = useState<FacultyRow | null>(null)

  // Debounce search to avoid hammering the DB on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(0)
    }, 250)
    return () => clearTimeout(t)
  }, [search])

  // Load this event's assignments once — used both to count sessions per faculty AND
  // (when inEventOnly is on) to scope the faculty query.
  const { data: sessionLinks = [], isLoading: linksLoading } = useQuery({
    queryKey: ["faculty-session-counts", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faculty_assignments")
        .select("faculty_id, faculty_email")
        .eq("event_id", eventId)
      if (error) throw error
      return (data ?? []) as SessionLink[]
    },
  })

  const sessionCountByFaculty = useMemo(() => {
    const byId = new Map<string, number>()
    const byEmail = new Map<string, number>()
    for (const s of sessionLinks) {
      if (s.faculty_id) {
        byId.set(s.faculty_id, (byId.get(s.faculty_id) ?? 0) + 1)
      } else if (s.faculty_email) {
        const key = s.faculty_email.toLowerCase()
        byEmail.set(key, (byEmail.get(key) ?? 0) + 1)
      }
    }
    return (f: FacultyRow) => {
      const fromId = byId.get(f.id) ?? 0
      const fromEmail = f.email ? (byEmail.get(f.email.toLowerCase()) ?? 0) : 0
      return fromId + fromEmail
    }
  }, [sessionLinks])

  // Set of faculty ids + emails in this event — used when inEventOnly is toggled.
  const inEventKeys = useMemo(() => {
    const ids = new Set<string>()
    const emails = new Set<string>()
    for (const s of sessionLinks) {
      if (s.faculty_id) ids.add(s.faculty_id)
      else if (s.faculty_email) emails.add(s.faculty_email.toLowerCase())
    }
    return { ids, emails }
  }, [sessionLinks])

  // Server-side paginated faculty fetch with search.
  const { data: pageData, isLoading: pageLoading } = useQuery({
    queryKey: ["faculty-directory", debouncedSearch, page, inEventOnly, sessionLinks.length],
    enabled: !linksLoading,
    queryFn: async () => {
      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from("faculty")
        .select(
          "id, title, name, email, phone, designation, institution, city, photo_url, headshot_urls, expertise_tags, bio_markdown",
          { count: "exact" }
        )
        .order("name", { ascending: true })

      if (debouncedSearch) {
        // Search across name, institution, designation, email. PostgREST or() takes a
        // comma-separated string; we wrap the term in % for ilike. The term is sanitized
        // for the PostgREST quoting rules (commas and parens are the dangerous chars).
        const q = debouncedSearch.replace(/[(),]/g, "")
        const pattern = `%${q}%`
        query = query.or(
          [
            `name.ilike.${pattern}`,
            `institution.ilike.${pattern}`,
            `designation.ilike.${pattern}`,
            `email.ilike.${pattern}`,
          ].join(",")
        )
      }

      if (inEventOnly) {
        const idList = Array.from(inEventKeys.ids)
        // Scope by faculty_id when we have any matches; otherwise no rows.
        if (idList.length === 0 && inEventKeys.emails.size === 0) {
          return { rows: [] as FacultyRow[], total: 0 }
        }
        // Build OR of id-in-list + email-in-list (PostgREST `in.()` is comma-joined inside parens).
        const idClause = idList.length > 0 ? `id.in.(${idList.join(",")})` : null
        const emailClause =
          inEventKeys.emails.size > 0
            ? `email.in.(${Array.from(inEventKeys.emails).map((e) => `"${e}"`).join(",")})`
            : null
        const clauses = [idClause, emailClause].filter(Boolean).join(",")
        if (clauses) query = query.or(clauses)
      }

      const { data, error, count } = await query.range(from, to)
      if (error) throw error
      return { rows: (data ?? []) as FacultyRow[], total: count ?? 0 }
    },
  })

  const rows = pageData?.rows ?? []
  const total = pageData?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const showingFrom = total === 0 ? 0 : page * PAGE_SIZE + 1
  const showingTo = Math.min((page + 1) * PAGE_SIZE, total)

  // The event has assignment rows but none of them carry a faculty_id or email —
  // they were imported as plain names, so the directory can't match them. Surface
  // this so the user doesn't think the toggle is broken.
  const hasUnlinkedAssignments =
    sessionLinks.length > 0 && inEventKeys.ids.size === 0 && inEventKeys.emails.size === 0

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Speakers directory</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Master faculty list — assign any of them to a session in this event.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, institution, designation, email…"
              className="pl-9"
            />
            {(search !== debouncedSearch || (search.length > 0 && pageLoading)) && (
              <Loader2 className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant={inEventOnly ? "default" : "outline"}
            onClick={() => { setInEventOnly((v) => !v); setPage(0) }}
          >
            {inEventOnly ? <CheckCircle2 className="h-4 w-4 mr-2" /> : null}
            In this event only
          </Button>
          <span className="text-sm text-muted-foreground">
            {pageLoading || linksLoading
              ? "Loading…"
              : `${showingFrom}–${showingTo} of ${total.toLocaleString()}`}
          </span>
        </CardContent>
      </Card>

      {hasUnlinkedAssignments && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 flex items-start gap-3 text-sm">
            <Info className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="font-medium">
                This event has {sessionLinks.length} speaker assignments, but none are linked to faculty profiles.
              </p>
              <p className="text-muted-foreground mt-1">
                The rows were imported as plain names (no email or ID). &ldquo;In this event only&rdquo; can&rsquo;t match them
                until you run the name matching pass. For now, browse all faculty and assign them via &ldquo;Add to event&rdquo;.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {linksLoading || pageLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={inEventOnly ? "No speakers in this event yet" : "No speakers match"}
          description={
            inEventOnly
              ? "Add someone from the master directory below — toggle off the filter to browse all faculty."
              : debouncedSearch ? "Try a different search term." : "No faculty profiles yet."
          }
          action={
            debouncedSearch || inEventOnly
              ? { label: "Clear filters", onClick: () => { setSearch(""); setInEventOnly(false); setPage(0) }, variant: "outline" }
              : undefined
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {rows.map((f) => (
              <SpeakerDirectoryCard
                key={f.id}
                faculty={f}
                eventId={eventId}
                sessionCount={sessionCountByFaculty(f)}
                onAddToEvent={() => setAddTarget(f)}
              />
            ))}
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {pageCount}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={page >= pageCount - 1}
                  aria-label="Next page"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {addTarget && (
        <AddToEventDialog
          open={!!addTarget}
          onClose={() => setAddTarget(null)}
          eventId={eventId}
          faculty={{
            id: addTarget.id,
            name: addTarget.name,
            email: addTarget.email,
            phone: addTarget.phone,
          }}
        />
      )}
    </div>
  )
}

function SpeakerDirectoryCard({
  faculty: f,
  eventId,
  sessionCount,
  onAddToEvent,
}: {
  faculty: FacultyRow
  eventId: string
  sessionCount: number
  onAddToEvent: () => void
}) {
  const photo =
    f.headshot_urls?.find((h) => h.is_primary)?.url ??
    f.headshot_urls?.[0]?.url ??
    f.photo_url ??
    undefined
  const initials = f.name
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
  const inEvent = sessionCount > 0

  return (
    <Card className="h-full flex flex-col group">
      <CardContent className="p-5 flex flex-col h-full">
        <Link
          href={`/events/${eventId}/speakers/${f.id}`}
          className="flex items-start gap-3 mb-3"
        >
          <Avatar className="h-14 w-14 ring-2 ring-border">
            <AvatarImage src={photo} alt={f.name} />
            <AvatarFallback>{initials || "?"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate group-hover:text-primary transition-colors">
              {f.title ? `${f.title} ` : ""}{f.name}
            </div>
            {f.designation && (
              <div className="text-xs text-muted-foreground truncate">{f.designation}</div>
            )}
          </div>
          <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </Link>

        {f.institution && (
          <div className="text-xs text-muted-foreground flex items-start gap-1 mb-3">
            <Building2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="line-clamp-2">
              {f.institution}{f.city ? ` · ${f.city}` : ""}
            </span>
          </div>
        )}

        {f.expertise_tags && f.expertise_tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {f.expertise_tags.slice(0, 3).map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
                {t}
              </Badge>
            ))}
            {f.expertise_tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground self-center">
                +{f.expertise_tags.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto pt-3 border-t flex items-center justify-between gap-2">
          {inEvent ? (
            <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {sessionCount} session{sessionCount === 1 ? "" : "s"}
            </Badge>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={(e) => { e.preventDefault(); onAddToEvent() }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add to event
            </Button>
          )}
          {inEvent && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={(e) => { e.preventDefault(); onAddToEvent() }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Another
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
