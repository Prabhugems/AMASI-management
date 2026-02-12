"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  FileText,
  Loader2,
  Search,
  CheckCircle,
  Clock,
  Image,
  Presentation,
  Download,
  Users,
  MoreHorizontal,
  Edit,
  Link2,
  Copy,
  ExternalLink,
  Send,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Speaker = {
  id: string
  attendee_name: string
  attendee_email: string
  custom_fields: {
    bio_submitted?: boolean
    photo_submitted?: boolean
    presentation_submitted?: boolean
    documents_submitted?: boolean
    portal_token?: string
  } | null
}

export default function SpeakerDocumentsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "complete" | "pending">("all")
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null)
  const [linkDialogSpeaker, setLinkDialogSpeaker] = useState<Speaker | null>(null)

  // Edit form state
  const [editForm, setEditForm] = useState({
    bio_submitted: false,
    photo_submitted: false,
    presentation_submitted: false,
  })

  // Fetch speakers
  const { data: speakers, isLoading } = useQuery({
    queryKey: ["speaker-documents", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_name, attendee_email, custom_fields")
        .eq("event_id", eventId)
        .or("attendee_designation.ilike.%speaker%,attendee_designation.ilike.%faculty%,attendee_designation.ilike.%chairperson%,attendee_designation.ilike.%moderator%")
        .order("attendee_name")

      return (data || []) as Speaker[]
    },
  })

  // Update speaker documents mutation
  const updateDocuments = useMutation({
    mutationFn: async ({ speakerId, updates }: { speakerId: string; updates: any }) => {
      // Get current custom_fields
      const { data: current } = await (supabase as any)
        .from("registrations")
        .select("custom_fields")
        .eq("id", speakerId)
        .single()

      const newCustomFields = {
        ...(current?.custom_fields || {}),
        ...updates,
        documents_submitted: updates.bio_submitted && updates.photo_submitted,
      }

      const { error } = await (supabase as any)
        .from("registrations")
        .update({ custom_fields: newCustomFields })
        .eq("id", speakerId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["speaker-documents", eventId] })
      toast.success("Document status updated")
      setEditingSpeaker(null)
    },
    onError: () => {
      toast.error("Failed to update")
    },
  })

  // Generate portal token mutation
  const generateToken = useMutation({
    mutationFn: async (speakerId: string) => {
      const token = crypto.randomUUID()

      const { data: current } = await (supabase as any)
        .from("registrations")
        .select("custom_fields")
        .eq("id", speakerId)
        .single()

      const { error } = await (supabase as any)
        .from("registrations")
        .update({
          custom_fields: {
            ...(current?.custom_fields || {}),
            portal_token: token,
          },
        })
        .eq("id", speakerId)

      if (error) throw error
      return token
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["speaker-documents", eventId] })
      toast.success("Portal link generated")
    },
  })

  // Filter speakers
  const filteredSpeakers = useMemo(() => {
    if (!speakers) return []
    return speakers.filter(s => {
      const matchesSearch =
        s.attendee_name.toLowerCase().includes(search.toLowerCase()) ||
        s.attendee_email.toLowerCase().includes(search.toLowerCase())

      const isComplete = s.custom_fields?.bio_submitted && s.custom_fields?.photo_submitted
      const matchesFilter =
        filter === "all" ||
        (filter === "complete" && isComplete) ||
        (filter === "pending" && !isComplete)

      return matchesSearch && matchesFilter
    })
  }, [speakers, search, filter])

  // Stats
  const stats = useMemo(() => {
    if (!speakers) return { total: 0, complete: 0, pending: 0, bioCount: 0, photoCount: 0, presentationCount: 0 }
    const bioCount = speakers.filter(s => s.custom_fields?.bio_submitted).length
    const photoCount = speakers.filter(s => s.custom_fields?.photo_submitted).length
    const presentationCount = speakers.filter(s => s.custom_fields?.presentation_submitted).length
    const complete = speakers.filter(s => s.custom_fields?.bio_submitted && s.custom_fields?.photo_submitted).length
    return {
      total: speakers.length,
      complete,
      pending: speakers.length - complete,
      bioCount,
      photoCount,
      presentationCount,
    }
  }, [speakers])

  const openEditDialog = (speaker: Speaker) => {
    setEditForm({
      bio_submitted: speaker.custom_fields?.bio_submitted || false,
      photo_submitted: speaker.custom_fields?.photo_submitted || false,
      presentation_submitted: speaker.custom_fields?.presentation_submitted || false,
    })
    setEditingSpeaker(speaker)
  }

  const handleSaveEdit = () => {
    if (!editingSpeaker) return
    updateDocuments.mutate({
      speakerId: editingSpeaker.id,
      updates: editForm,
    })
  }

  const getPortalLink = (speaker: Speaker) => {
    if (!speaker.custom_fields?.portal_token) return null
    return `${window.location.origin}/speaker-portal/${speaker.custom_fields.portal_token}`
  }

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link)
    toast.success("Link copied to clipboard")
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Speaker Documents</h1>
          <p className="text-muted-foreground">Track bio, photo, and presentation submissions</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export All
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
        <div
          className={cn(
            "bg-card rounded-lg border p-4 cursor-pointer transition-colors",
            filter === "all" && "ring-2 ring-primary"
          )}
          onClick={() => setFilter("all")}
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div
          className={cn(
            "bg-card rounded-lg border p-4 cursor-pointer transition-colors",
            filter === "complete" && "ring-2 ring-primary"
          )}
          onClick={() => setFilter("complete")}
        >
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Complete</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.complete}</p>
        </div>
        <div
          className={cn(
            "bg-card rounded-lg border p-4 cursor-pointer transition-colors",
            filter === "pending" && "ring-2 ring-primary"
          )}
          onClick={() => setFilter("pending")}
        >
          <div className="flex items-center gap-2 text-amber-500">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Pending</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.pending}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-blue-500">
            <FileText className="h-4 w-4" />
            <span className="text-sm">Bios</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.bioCount}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-purple-500">
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image className="h-4 w-4" />
            <span className="text-sm">Photos</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.photoCount}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-orange-500">
            <Presentation className="h-4 w-4" />
            <span className="text-sm">Presentations</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.presentationCount}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search speakers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Speaker</TableHead>
              <TableHead className="text-center">Bio</TableHead>
              <TableHead className="text-center">Photo</TableHead>
              <TableHead className="text-center">Presentation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Portal Link</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSpeakers.map((speaker) => {
              const isComplete = speaker.custom_fields?.bio_submitted && speaker.custom_fields?.photo_submitted
              const portalLink = getPortalLink(speaker)

              return (
                <TableRow key={speaker.id} className={cn(!isComplete && "bg-amber-50/30")}>
                  <TableCell>
                    <p className="font-medium">{speaker.attendee_name}</p>
                    <p className="text-xs text-muted-foreground">{speaker.attendee_email}</p>
                  </TableCell>
                  <TableCell className="text-center">
                    {speaker.custom_fields?.bio_submitted ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <Clock className="h-5 w-5 text-amber-400 mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {speaker.custom_fields?.photo_submitted ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <Clock className="h-5 w-5 text-amber-400 mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {speaker.custom_fields?.presentation_submitted ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <Clock className="h-5 w-5 text-gray-300 mx-auto" />
                    )}
                  </TableCell>
                  <TableCell>
                    {isComplete ? (
                      <Badge className="bg-green-500 text-white">Complete</Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-500">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {portalLink ? (
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyLink(portalLink)}
                          title="Copy link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(portalLink, "_blank")}
                          title="Open link"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateToken.mutate(speaker.id)}
                        disabled={generateToken.isPending}
                      >
                        <Link2 className="h-4 w-4 mr-1" />
                        Generate
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(speaker)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Status
                        </DropdownMenuItem>
                        {portalLink && (
                          <DropdownMenuItem onClick={() => copyLink(portalLink)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Portal Link
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setLinkDialogSpeaker(speaker)}>
                          <Link2 className="h-4 w-4 mr-2" />
                          View Portal Link
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Send className="h-4 w-4 mr-2" />
                          Send Reminder
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingSpeaker} onOpenChange={() => setEditingSpeaker(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Document Status</DialogTitle>
          </DialogHeader>
          {editingSpeaker && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Update document status for <span className="font-medium">{editingSpeaker.attendee_name}</span>
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="bio"
                    checked={editForm.bio_submitted}
                    onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, bio_submitted: !!checked }))}
                  />
                  <Label htmlFor="bio" className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    Bio Received
                  </Label>
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="photo"
                    checked={editForm.photo_submitted}
                    onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, photo_submitted: !!checked }))}
                  />
                  <Label htmlFor="photo" className="flex items-center gap-2">
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image className="h-4 w-4 text-purple-500" />
                    Photo Received
                  </Label>
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="presentation"
                    checked={editForm.presentation_submitted}
                    onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, presentation_submitted: !!checked }))}
                  />
                  <Label htmlFor="presentation" className="flex items-center gap-2">
                    <Presentation className="h-4 w-4 text-orange-500" />
                    Presentation Received
                  </Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSpeaker(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateDocuments.isPending}>
              {updateDocuments.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Portal Link Dialog */}
      <Dialog open={!!linkDialogSpeaker} onOpenChange={() => setLinkDialogSpeaker(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Speaker Portal Link</DialogTitle>
          </DialogHeader>
          {linkDialogSpeaker && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Portal link for <span className="font-medium">{linkDialogSpeaker.attendee_name}</span>
              </p>

              {getPortalLink(linkDialogSpeaker) ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={getPortalLink(linkDialogSpeaker) || ""}
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyLink(getPortalLink(linkDialogSpeaker)!)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this link with the speaker to let them submit their documents.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => window.open(getPortalLink(linkDialogSpeaker)!, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Portal
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        generateToken.mutate(linkDialogSpeaker.id)
                      }}
                    >
                      <Link2 className="h-4 w-4 mr-2" />
                      Regenerate Link
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Link2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">No portal link generated yet</p>
                  <Button
                    onClick={() => generateToken.mutate(linkDialogSpeaker.id)}
                    disabled={generateToken.isPending}
                  >
                    {generateToken.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Generate Portal Link
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
