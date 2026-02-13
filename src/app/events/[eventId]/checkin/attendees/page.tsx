"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Loader2,
  Search,
  CheckCircle,
  Clock,
  Download,
  Mail,
  Eye,
  Send,
} from "lucide-react"
import { toast } from "sonner"

type Attendee = {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_phone?: string
  attendee_designation?: string
  attendee_institution?: string
  ticket_type?: { name: string }
  checked_in: boolean
  checked_in_at?: string
}

export default function AllAttendeesPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  const [search, setSearch] = useState("")
  const [showBadgeModal, setShowBadgeModal] = useState(false)
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null)
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)
  const [badgePdfUrl, setBadgePdfUrl] = useState<string | null>(null)
  const [loadingBadge, setLoadingBadge] = useState(false)

  // Fetch default badge template
  const { data: defaultTemplate } = useQuery({
    queryKey: ["default-badge-template", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("badge_templates")
        .select("id, name")
        .eq("event_id", eventId)
        .eq("is_default", true)
        .maybeSingle()
      return data
    },
  })

  // Fetch attendees
  const { data: attendees, isLoading } = useQuery({
    queryKey: ["all-attendees", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, registration_number, attendee_name, attendee_email, attendee_phone, attendee_designation, attendee_institution, checked_in, checked_in_at, ticket_type:ticket_types(name)")
        .eq("event_id", eventId)
        .eq("status", "confirmed")
        .order("attendee_name")

      return (data || []) as Attendee[]
    },
  })

  // Filter attendees by search
  const filteredAttendees = useMemo(() => {
    if (!attendees) return []
    if (!search.trim()) return attendees

    const searchLower = search.toLowerCase()
    return attendees.filter(a =>
      a.attendee_name.toLowerCase().includes(searchLower) ||
      a.attendee_email.toLowerCase().includes(searchLower) ||
      a.registration_number.toLowerCase().includes(searchLower) ||
      (a.attendee_phone && String(a.attendee_phone).includes(search))
    )
  }, [attendees, search])

  // View badge - generate PDF and display
  const handleViewBadge = async (attendee: Attendee) => {
    if (!defaultTemplate) {
      toast.error("No badge template found. Please create a badge template first.")
      return
    }

    setSelectedAttendee(attendee)
    setShowBadgeModal(true)
    setLoadingBadge(true)
    setBadgePdfUrl(null)

    try {
      const res = await fetch("/api/badges/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          template_id: defaultTemplate.id,
          single_registration_id: attendee.id,
        }),
      })

      if (!res.ok) {
        throw new Error("Failed to generate badge")
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setBadgePdfUrl(url)
    } catch (_error) {
      toast.error("Failed to generate badge preview")
      setShowBadgeModal(false)
    } finally {
      setLoadingBadge(false)
    }
  }

  // Cleanup PDF URL when modal closes
  const handleCloseModal = () => {
    setShowBadgeModal(false)
    if (badgePdfUrl) {
      URL.revokeObjectURL(badgePdfUrl)
      setBadgePdfUrl(null)
    }
    setSelectedAttendee(null)
  }

  // Send badge via email
  const handleSendBadge = async (attendee: Attendee) => {
    setSendingEmail(attendee.id)
    try {
      const res = await fetch("/api/badges/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: attendee.id,
          event_id: eventId,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to send email")
      }

      toast.success(`Badge sent to ${attendee.attendee_email}`)
    } catch (error: any) {
      toast.error(error.message || "Failed to send badge email")
    } finally {
      setSendingEmail(null)
    }
  }

  // Export list
  const exportList = () => {
    const headers = ["Reg#", "Name", "Email", "Phone", "Designation", "Institution", "Ticket"]
    const rows = filteredAttendees.map(a => [
      a.registration_number,
      a.attendee_name,
      a.attendee_email,
      a.attendee_phone || "",
      a.attendee_designation || "",
      a.attendee_institution || "",
      a.ticket_type?.name || "",
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `attendees-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("List exported")
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">All Attendees</h1>
          <p className="text-muted-foreground">Search attendees and send/view their e-badge</p>
        </div>
        <Button variant="outline" onClick={exportList}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, phone, or reg#..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {filteredAttendees.length} of {attendees?.length || 0} attendees
        </p>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Reg#</TableHead>
              <TableHead>Attendee</TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAttendees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {search ? "No attendees match your search" : "No attendees found"}
                </TableCell>
              </TableRow>
            ) : (
              filteredAttendees.map((attendee) => (
                <TableRow key={attendee.id}>
                  <TableCell className="font-mono text-sm">{attendee.registration_number}</TableCell>
                  <TableCell>
                    <p className="font-medium">{attendee.attendee_name}</p>
                    <p className="text-xs text-muted-foreground">{attendee.attendee_email}</p>
                    {attendee.attendee_designation && (
                      <p className="text-xs text-muted-foreground">{attendee.attendee_designation}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {attendee.ticket_type?.name || "-"}
                  </TableCell>
                  <TableCell>
                    {attendee.checked_in ? (
                      <Badge className="bg-green-500 text-white">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Checked In
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewBadge(attendee)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Badge
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendBadge(attendee)}
                        disabled={sendingEmail === attendee.id}
                      >
                        {sendingEmail === attendee.id ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4 mr-1" />
                        )}
                        Send
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Badge Modal */}
      <Dialog open={showBadgeModal} onOpenChange={handleCloseModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              E-Badge - {selectedAttendee?.attendee_name}
            </DialogTitle>
          </DialogHeader>

          {selectedAttendee && (
            <div className="space-y-4">
              {/* Badge Preview */}
              <div className="bg-muted rounded-lg overflow-hidden flex items-center justify-center min-h-[400px]">
                {loadingBadge ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Generating badge...</p>
                  </div>
                ) : badgePdfUrl ? (
                  <iframe
                    src={badgePdfUrl}
                    className="w-full h-[500px] border-0"
                    title="Badge Preview"
                  />
                ) : (
                  <p className="text-muted-foreground">Failed to load badge</p>
                )}
              </div>

              {/* Attendee Info */}
              <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{selectedAttendee.attendee_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedAttendee.registration_number} | {selectedAttendee.ticket_type?.name || "General"}
                  </p>
                </div>
              </div>

              {/* Instructions */}
              <p className="text-sm text-muted-foreground text-center">
                Show this screen or take a photo/screenshot to present at the check-in counter
              </p>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={handleCloseModal}
                >
                  Close
                </Button>
                {badgePdfUrl && (
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => {
                      const a = document.createElement("a")
                      a.href = badgePdfUrl
                      a.download = `badge-${selectedAttendee.registration_number}.pdf`
                      a.click()
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                )}
                <Button
                  className="flex-1"
                  onClick={() => handleSendBadge(selectedAttendee)}
                  disabled={sendingEmail === selectedAttendee.id}
                >
                  {sendingEmail === selectedAttendee.id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send to Email
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
