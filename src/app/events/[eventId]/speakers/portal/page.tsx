"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Link2,
  Loader2,
  Search,
  Copy,
  ExternalLink,
  RefreshCw,
  CheckCircle,
} from "lucide-react"
import { toast } from "sonner"

type Speaker = {
  id: string
  attendee_name: string
  attendee_email: string
  custom_fields: {
    portal_token?: string
    portal_last_accessed?: string
  } | null
}

export default function SpeakerPortalPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Fetch speakers
  const { data: speakers, isLoading } = useQuery({
    queryKey: ["speaker-portal", eventId],
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

  // Generate token mutation
  const generateTokenMutation = useMutation({
    mutationFn: async (speakerId: string) => {
      const token = crypto.randomUUID()
      const speaker = speakers?.find(s => s.id === speakerId)

      await (supabase as any)
        .from("registrations")
        .update({
          custom_fields: {
            ...speaker?.custom_fields,
            portal_token: token,
          },
        })
        .eq("id", speakerId)

      return token
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["speaker-portal", eventId] })
      toast.success("Portal link generated")
    },
  })

  // Filter speakers
  const filteredSpeakers = useMemo(() => {
    if (!speakers) return []
    return speakers.filter(s =>
      s.attendee_name.toLowerCase().includes(search.toLowerCase()) ||
      s.attendee_email.toLowerCase().includes(search.toLowerCase())
    )
  }, [speakers, search])

  const getPortalUrl = (token: string) => {
    return `${window.location.origin}/speaker-portal/${token}`
  }

  const copyLink = (speaker: Speaker) => {
    if (!speaker.custom_fields?.portal_token) return
    const url = getPortalUrl(speaker.custom_fields.portal_token)
    navigator.clipboard.writeText(url)
    setCopiedId(speaker.id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success("Link copied to clipboard")
  }

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "Never"
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
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
      <div>
        <h1 className="text-2xl font-bold">Speaker Portal Links</h1>
        <p className="text-muted-foreground">Generate and manage portal access for speakers</p>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Link2 className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-800">Speaker Portal</h3>
            <p className="text-sm text-blue-600 mt-1">
              Each speaker gets a unique link to access their portal where they can submit
              their bio, photo, presentation, and travel preferences.
            </p>
          </div>
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
              <TableHead>Portal Status</TableHead>
              <TableHead>Last Accessed</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSpeakers.map((speaker) => {
              const hasToken = !!speaker.custom_fields?.portal_token

              return (
                <TableRow key={speaker.id}>
                  <TableCell>
                    <p className="font-medium">{speaker.attendee_name}</p>
                    <p className="text-xs text-muted-foreground">{speaker.attendee_email}</p>
                  </TableCell>
                  <TableCell>
                    {hasToken ? (
                      <Badge className="bg-green-500 text-white">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Not Generated
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(speaker.custom_fields?.portal_last_accessed)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {hasToken ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyLink(speaker)}
                          >
                            {copiedId === speaker.id ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                          >
                            <a
                              href={getPortalUrl(speaker.custom_fields?.portal_token ?? '')}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => generateTokenMutation.mutate(speaker.id)}
                            disabled={generateTokenMutation.isPending}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => generateTokenMutation.mutate(speaker.id)}
                          disabled={generateTokenMutation.isPending}
                        >
                          <Link2 className="h-4 w-4 mr-2" />
                          Generate Link
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
