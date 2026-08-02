"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Search,
  Loader2,
  Pencil,
  Check,
  X,
  Mail,
  Eye,
  Download,
  Send,
  Undo2,
  UserCheck,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useConfirm } from "@/hooks/use-confirm"

interface SearchResult {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_phone: string | null
  attendee_designation: string | null
  attendee_institution: string | null
  status: string
  ticket_type: { name: string } | null
}

interface CheckinRow {
  id: string
  checkin_list_id: string
  checked_in_at: string
  checked_in_by: string | null
  checked_out_at: string | null
  reversed_at: string | null
  reversed_by: string | null
  reversal_reason: string | null
  station_id: string | null
  checkin_lists: { name: string } | null
  kiosk_stations: { name: string } | null
}

interface CheckinListOption {
  id: string
  name: string
}

// Help desk screen (work order §4) -- fast, keyboard-first, laptop-only
// admin tool. Search focused on load, minimum clicks to a reprint. Every
// mutating action here (name edit, manual check-in, reversal) hits its own
// audit-logged /api/help-desk/* route -- see those routes' comments for why
// they're dedicated rather than reusing the general-purpose registration/
// check-in endpoints.
export default function HelpDeskPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()
  const confirm = useConfirm()

  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState("")
  const [selectedListId, setSelectedListId] = useState<string>("")
  const [showBadgeModal, setShowBadgeModal] = useState(false)
  const [badgePdfUrl, setBadgePdfUrl] = useState<string | null>(null)
  const [loadingBadge, setLoadingBadge] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250)
    return () => clearTimeout(t)
  }, [query])

  const { data: results, isFetching: searching } = useQuery({
    queryKey: ["help-desk-search", eventId, debouncedQuery],
    queryFn: async () => {
      const res = await fetch(
        `/api/help-desk/search?event_id=${encodeURIComponent(eventId)}&q=${encodeURIComponent(debouncedQuery)}`
      )
      if (!res.ok) throw new Error("Search failed")
      const json = await res.json()
      return json.data as SearchResult[]
    },
    enabled: debouncedQuery.trim().length >= 2,
  })

  const { data: selected } = useQuery({
    queryKey: ["help-desk-registration", selectedId],
    queryFn: () => (results || []).find((r) => r.id === selectedId) || null,
    enabled: !!selectedId,
    initialData: () => (results || []).find((r) => r.id === selectedId) || null,
  })

  const { data: checkins, isLoading: loadingCheckins } = useQuery({
    queryKey: ["help-desk-checkins", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/help-desk/registrations/${selectedId}/checkins`)
      if (!res.ok) throw new Error("Failed to load check-ins")
      const json = await res.json()
      return json.data as CheckinRow[]
    },
    enabled: !!selectedId,
  })

  const { data: checkinLists } = useQuery({
    queryKey: ["help-desk-checkin-lists", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/checkin-lists?event_id=${encodeURIComponent(eventId)}&active_only=true`)
      if (!res.ok) throw new Error("Failed to load check-in lists")
      const json = await res.json()
      return (json.data || []) as CheckinListOption[]
    },
  })

  const saveNameMutation = useMutation({
    mutationFn: async (attendee_name: string) => {
      const res = await fetch(`/api/help-desk/registrations/${selectedId}/name`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendee_name }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save name")
      return res.json()
    },
    onSuccess: (_data, attendee_name) => {
      toast.success("Name updated")
      setEditingName(false)
      queryClient.setQueryData<SearchResult[]>(["help-desk-search", eventId, debouncedQuery], (old) =>
        old?.map((r) => (r.id === selectedId ? { ...r, attendee_name } : r))
      )
      queryClient.invalidateQueries({ queryKey: ["help-desk-registration", selectedId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const checkInMutation = useMutation({
    mutationFn: async (checkinListId: string) => {
      const res = await fetch(`/api/help-desk/registrations/${selectedId}/checkins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkin_list_id: checkinListId }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to check in")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Checked in")
      queryClient.invalidateQueries({ queryKey: ["help-desk-checkins", selectedId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const reverseMutation = useMutation({
    mutationFn: async ({ recordId, reason }: { recordId: string; reason?: string }) => {
      const res = await fetch(`/api/help-desk/checkins/${recordId}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to reverse")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Check-in reversed")
      queryClient.invalidateQueries({ queryKey: ["help-desk-checkins", selectedId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSelect = (r: SearchResult) => {
    setSelectedId(r.id)
    setEditingName(false)
    setSelectedListId("")
    queryClient.setQueryData(["help-desk-registration", r.id], r)
  }

  const handleViewBadge = async () => {
    if (!selected) return
    setShowBadgeModal(true)
    setLoadingBadge(true)
    setBadgePdfUrl(null)
    try {
      const res = await fetch("/api/badges/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, single_registration_id: selected.id }),
      })
      if (!res.ok) throw new Error("Failed to generate badge")
      const blob = await res.blob()
      setBadgePdfUrl(URL.createObjectURL(blob))
    } catch {
      toast.error("Failed to generate badge preview")
      setShowBadgeModal(false)
    } finally {
      setLoadingBadge(false)
    }
  }

  const handleCloseBadgeModal = () => {
    setShowBadgeModal(false)
    if (badgePdfUrl) {
      URL.revokeObjectURL(badgePdfUrl)
      setBadgePdfUrl(null)
    }
  }

  const handleEmailBadge = async () => {
    if (!selected) return
    setSendingEmail(true)
    try {
      const res = await fetch("/api/badges/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_id: selected.id, event_id: eventId }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to send email")
      toast.success(`Badge sent to ${selected.attendee_email}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send badge email")
    } finally {
      setSendingEmail(false)
    }
  }

  const handleReverse = async (row: CheckinRow) => {
    const ok = await confirm({
      title: "Reverse this check-in?",
      description: `This marks the ${row.checkin_lists?.name || "list"} check-in at ${new Date(row.checked_in_at).toLocaleString()} as a mistake. The record is kept, not deleted, and this delegate can be checked in again.`,
      variant: "destructive",
      confirmText: "Reverse",
    })
    if (!ok) return
    reverseMutation.mutate({ recordId: row.id })
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-xl font-bold text-foreground">Help Desk</h1>
        <p className="text-sm text-muted-foreground">
          Search a delegate, then edit, check in, reprint, or reverse a check-in.
        </p>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Search + results */}
        <div className="w-[380px] shrink-0 border-r border-border flex flex-col min-h-0">
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, phone, email, or reg#…"
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {searching && (
              <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Searching…
              </div>
            )}
            {!searching && debouncedQuery.trim().length >= 2 && (results?.length ?? 0) === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No matches.</p>
            )}
            {debouncedQuery.trim().length < 2 && (
              <p className="p-4 text-sm text-muted-foreground">Type at least 2 characters to search.</p>
            )}
            {results?.map((r) => (
              <button
                key={r.id}
                onClick={() => handleSelect(r)}
                className={`w-full text-left px-4 py-3 border-b border-border hover:bg-muted transition-colors ${
                  selectedId === r.id ? "bg-muted" : ""
                }`}
              >
                <p className="text-sm font-medium text-foreground truncate">{r.attendee_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {r.registration_number} · {r.attendee_email}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Search for a delegate to get started.
            </div>
          ) : (
            <div className="max-w-2xl space-y-6">
              {/* Identity + name edit */}
              <div className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-start justify-between gap-3">
                  {editingName ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        autoFocus
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && nameDraft.trim()) saveNameMutation.mutate(nameDraft.trim())
                          if (e.key === "Escape") setEditingName(false)
                        }}
                        className="text-lg font-bold h-9"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => nameDraft.trim() && saveNameMutation.mutate(nameDraft.trim())}
                        disabled={saveNameMutation.isPending}
                      >
                        {saveNameMutation.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Check className="size-4" />
                        )}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditingName(false)}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-foreground">{selected.attendee_name}</h2>
                      <button
                        onClick={() => {
                          setNameDraft(selected.attendee_name)
                          setEditingName(true)
                        }}
                        className="text-muted-foreground hover:text-foreground"
                        title="Edit name"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {selected.registration_number} · {selected.attendee_email}
                  {selected.attendee_phone ? ` · ${selected.attendee_phone}` : ""}
                </p>
                {(selected.attendee_designation || selected.attendee_institution) && (
                  <p className="text-sm text-muted-foreground">
                    {[selected.attendee_designation, selected.attendee_institution].filter(Boolean).join(" · ")}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={handleViewBadge}>
                    <Eye className="size-4 mr-1.5" /> View &amp; print badge
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleEmailBadge} disabled={sendingEmail}>
                    {sendingEmail ? (
                      <Loader2 className="size-4 mr-1.5 animate-spin" />
                    ) : (
                      <Mail className="size-4 mr-1.5" />
                    )}
                    Email badge
                  </Button>
                </div>
              </div>

              {/* Manual check-in */}
              <div className="bg-card border border-border rounded-lg p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <UserCheck className="size-4" /> Check in to a list
                </h3>
                <div className="flex gap-2">
                  <Select value={selectedListId} onValueChange={setSelectedListId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Choose a list…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(checkinLists || []).map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => selectedListId && checkInMutation.mutate(selectedListId)}
                    disabled={!selectedListId || checkInMutation.isPending}
                  >
                    {checkInMutation.isPending ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : null}
                    Check in
                  </Button>
                </div>
              </div>

              {/* Scan history */}
              <div className="bg-card border border-border rounded-lg p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Clock className="size-4" /> Check-in history
                </h3>
                {loadingCheckins ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Loading…
                  </div>
                ) : !checkins || checkins.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No check-ins yet.</p>
                ) : (
                  <div className="space-y-2">
                    {checkins.map((row) => {
                      const status = row.reversed_at ? "reversed" : row.checked_out_at ? "checked out" : "active"
                      return (
                        <div
                          key={row.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {row.checkin_lists?.name || "Unknown list"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {new Date(row.checked_in_at).toLocaleString()}
                              {row.kiosk_stations?.name ? ` · ${row.kiosk_stations.name}` : ""}
                              {row.checked_in_by ? ` · by ${row.checked_in_by}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                status === "active"
                                  ? "bg-emerald-500/15 text-emerald-700"
                                  : status === "reversed"
                                    ? "bg-red-500/15 text-red-700"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {status}
                            </span>
                            {status === "active" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReverse(row)}
                                disabled={reverseMutation.isPending}
                              >
                                <Undo2 className="size-3.5 mr-1" /> Reverse
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Badge preview / print */}
      <Dialog open={showBadgeModal} onOpenChange={handleCloseBadgeModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Badge{selected ? ` — ${selected.attendee_name}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="bg-muted rounded-lg overflow-hidden flex items-center justify-center min-h-[400px]">
            {loadingBadge ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Generating badge…</p>
              </div>
            ) : badgePdfUrl ? (
              <iframe src={badgePdfUrl} className="w-full h-[500px] border-0" title="Badge preview" />
            ) : (
              <p className="text-muted-foreground">Failed to load badge</p>
            )}
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Use your browser&apos;s print dialog (Ctrl/Cmd+P) inside the preview to print.
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" variant="outline" onClick={handleCloseBadgeModal}>
              Close
            </Button>
            {badgePdfUrl && selected && (
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => {
                  const a = document.createElement("a")
                  a.href = badgePdfUrl
                  a.download = `badge-${selected.registration_number}.pdf`
                  a.click()
                }}
              >
                <Download className="size-4 mr-2" /> Download
              </Button>
            )}
            <Button className="flex-1" onClick={handleEmailBadge} disabled={sendingEmail}>
              {sendingEmail ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Send className="size-4 mr-2" />
              )}
              Email
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
